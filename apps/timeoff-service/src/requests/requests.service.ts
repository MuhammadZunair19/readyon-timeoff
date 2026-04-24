import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  BalanceNotFoundException,
  HcmUnavailableError,
  HcmInsufficientBalanceError,
  HcmInvalidDimensionError,
  InsufficientBalanceException,
  InvalidStateTransitionException,
  RequestNotFoundException,
} from '../shared/exceptions';
import { IHcmAdapter } from '../hcm/hcm.adapter.interface';
import { BalanceService } from '../balance/balance.service';
import { AuditService } from '../audit/audit.service';
import { TimeOffRequestEntity, TimeOffRequestStatus } from './entities/time-off-request.entity';
import { CreateRequestDto } from './dto/create-request.dto';
import { ApproveRequestDto } from './dto/approve-request.dto';
import { RejectRequestDto } from './dto/reject-request.dto';

@Injectable()
export class RequestsService {
  constructor(
    @InjectRepository(TimeOffRequestEntity)
    private readonly requestRepository: Repository<TimeOffRequestEntity>,
    @Inject('HCM_ADAPTER')
    private readonly hcmAdapter: IHcmAdapter,
    private readonly balanceService: BalanceService,
    private readonly auditService: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  async createRequest(dto: CreateRequestDto): Promise<TimeOffRequestEntity> {
    return this.dataSource.transaction(async (manager) => {
      // Check balance availability
      const balance = await manager.findOne(
        (await import('../balance/entities/leave-balance.entity')).LeaveBalanceEntity,
        {
          where: {
            employeeId: dto.employeeId,
            locationId: dto.locationId,
            leaveType: dto.leaveType,
          },
        },
      );

      if (!balance) {
        throw new BalanceNotFoundException(
          `Balance not found for employee ${dto.employeeId}, location ${dto.locationId}, leave type ${dto.leaveType}`,
        );
      }

      const availableDays = balance.totalDays - balance.usedDays - balance.pendingDays;
      if (availableDays < dto.daysRequested) {
        throw new InsufficientBalanceException(
          `Insufficient balance. Available: ${availableDays}, Requested: ${dto.daysRequested}`,
        );
      }

      // Create request id up-front so we can use it for idempotency/traceability
      const requestId = uuidv4();

      // Reserve pending days
      await this.balanceService.reservePendingDays(
        dto.employeeId,
        dto.locationId,
        dto.leaveType,
        dto.daysRequested,
        requestId,
      );

      // Create request
      const request = manager.create(TimeOffRequestEntity, {
        id: requestId,
        employeeId: dto.employeeId,
        locationId: dto.locationId,
        leaveType: dto.leaveType,
        startDate: dto.startDate,
        endDate: dto.endDate,
        daysRequested: dto.daysRequested,
        status: TimeOffRequestStatus.PENDING,
        managerId: null,
        hcmTransactionId: null,
        rejectionReason: null,
        notes: dto.notes ?? null,
      });

      const saved = await manager.save(request);

      // Audit log
      await this.auditService.log({
        entityType: 'TimeOffRequest',
        entityId: saved.id,
        action: 'CREATED',
        actorId: dto.employeeId,
        beforeState: null,
        afterState: saved,
      });

      return saved;
    });
  }

  async approveRequest(
    requestId: string,
    managerId: string,
  ): Promise<TimeOffRequestEntity> {
    return this.dataSource.transaction(async (manager) => {
      const request = await manager.findOne(TimeOffRequestEntity, {
        where: { id: requestId },
      });

      if (!request) {
        throw new RequestNotFoundException(`Request not found: ${requestId}`);
      }

      if (request.status !== TimeOffRequestStatus.PENDING) {
        throw new InvalidStateTransitionException(
          `Cannot approve request with status ${request.status}`,
        );
      }

      const beforeState = { ...request };

      // Optionally re-sync HCM if SYNC_ON_APPROVE is enabled
      if (process.env['SYNC_ON_APPROVE'] === 'true') {
        try {
          await this.balanceService.upsertFromHcm(
            await this.hcmAdapter.getBalance(
              request.employeeId,
              request.locationId,
              request.leaveType,
            ),
          );
        } catch (error) {
          // Log but don't fail on sync errors
          console.warn('Failed to sync balance during approval:', error);
        }
      }

      // Re-check balance
      const balance = await manager.findOne(
        (await import('../balance/entities/leave-balance.entity')).LeaveBalanceEntity,
        {
          where: {
            employeeId: request.employeeId,
            locationId: request.locationId,
            leaveType: request.leaveType,
          },
        },
      );

      if (!balance) {
        throw new BalanceNotFoundException(
          `Balance not found for employee ${request.employeeId}, location ${request.locationId}, leave type ${request.leaveType}`,
        );
      }

      const availableDays = balance.totalDays - balance.usedDays - balance.pendingDays;
      if (availableDays < request.daysRequested) {
        // Balance decreased, reject request
        request.status = TimeOffRequestStatus.REJECTED;
        request.rejectionReason = 'Insufficient balance after re-check';
        request.managerId = managerId;

        await this.balanceService.releasePendingDays(
          request.employeeId,
          request.locationId,
          request.leaveType,
          request.daysRequested,
        );

        const updated = await manager.save(request);

        await this.auditService.log({
          entityType: 'TimeOffRequest',
          entityId: request.id,
          action: 'APPROVED_BUT_REJECTED_DUE_TO_BALANCE',
          actorId: managerId,
          beforeState,
          afterState: updated,
        });

        return updated;
      }

      // Call HCM fileTimeOff
      let hcmResponse;
      try {
        hcmResponse = await this.hcmAdapter.fileTimeOff({
          employeeId: request.employeeId,
          locationId: request.locationId,
          leaveType: request.leaveType,
          startDate: request.startDate,
          endDate: request.endDate,
          daysRequested: request.daysRequested,
          idempotencyKey: request.id,
        });
      } catch (error) {
        if (error instanceof HcmUnavailableError) {
          // Timeout or server error - set HCM_FAILED
          request.status = TimeOffRequestStatus.HCM_FAILED;
          request.managerId = managerId;
          const updated = await manager.save(request);

          await this.auditService.log({
            entityType: 'TimeOffRequest',
            entityId: request.id,
            action: 'APPROVAL_HCM_FAILED',
            actorId: managerId,
            beforeState,
            afterState: updated,
          });

          return updated;
        }

        if (
          error instanceof HcmInsufficientBalanceError ||
          error instanceof HcmInvalidDimensionError
        ) {
          // HCM rejected - release pending, set REJECTED
          await this.balanceService.releasePendingDays(
            request.employeeId,
            request.locationId,
            request.leaveType,
            request.daysRequested,
          );

          request.status = TimeOffRequestStatus.REJECTED;
          request.rejectionReason =
            error instanceof HcmInsufficientBalanceError
              ? 'Insufficient balance in HCM'
              : 'Invalid dimension in HCM';
          request.managerId = managerId;

          const updated = await manager.save(request);

          await this.auditService.log({
            entityType: 'TimeOffRequest',
            entityId: request.id,
            action: 'APPROVAL_HCM_REJECTED',
            actorId: managerId,
            beforeState,
            afterState: updated,
          });

          return updated;
        }

        throw error;
      }

      if (hcmResponse.status === 'REJECTED') {
        // HCM rejected
        await this.balanceService.releasePendingDays(
          request.employeeId,
          request.locationId,
          request.leaveType,
          request.daysRequested,
        );

        request.status = TimeOffRequestStatus.REJECTED;
        request.rejectionReason = hcmResponse.rejectionReason || 'Rejected by HCM';
        request.managerId = managerId;

        const updated = await manager.save(request);

        await this.auditService.log({
          entityType: 'TimeOffRequest',
          entityId: request.id,
          action: 'APPROVAL_HCM_REJECTED',
          actorId: managerId,
          beforeState,
          afterState: updated,
        });

        return updated;
      }

      // Success - confirm used days
      await this.balanceService.confirmUsedDays(
        request.employeeId,
        request.locationId,
        request.leaveType,
        request.daysRequested,
      );

      request.status = TimeOffRequestStatus.APPROVED;
      request.hcmTransactionId = hcmResponse.transactionId;
      request.managerId = managerId;

      const updated = await manager.save(request);

      await this.auditService.log({
        entityType: 'TimeOffRequest',
        entityId: request.id,
        action: 'APPROVED',
        actorId: managerId,
        beforeState,
        afterState: updated,
      });

      // Defensive: re-fetch HCM balance to detect drift
      try {
        const hcmBalance = await this.hcmAdapter.getBalance(
          request.employeeId,
          request.locationId,
          request.leaveType,
        );

        const currentBalance = await manager.findOne(
          (await import('../balance/entities/leave-balance.entity')).LeaveBalanceEntity,
          {
            where: {
              employeeId: request.employeeId,
              locationId: request.locationId,
              leaveType: request.leaveType,
            },
          },
        );

        if (
          currentBalance &&
          (currentBalance.usedDays !== hcmBalance.usedDays ||
            currentBalance.totalDays !== hcmBalance.totalDays)
        ) {
          await this.auditService.log({
            entityType: 'TimeOffRequest',
            entityId: request.id,
            action: 'BALANCE_ANOMALY',
            actorId: 'SYSTEM',
            beforeState: {
              dbUsedDays: currentBalance.usedDays,
              dbTotalDays: currentBalance.totalDays,
            },
            afterState: {
              hcmUsedDays: hcmBalance.usedDays,
              hcmTotalDays: hcmBalance.totalDays,
            },
          });
        }
      } catch (error) {
        console.warn('Failed to verify HCM balance after approval:', error);
      }

      return updated;
    });
  }

  async rejectRequest(
    requestId: string,
    managerId: string,
    reason: string,
  ): Promise<TimeOffRequestEntity> {
    return this.dataSource.transaction(async () => {
      const request = await this.requestRepository.findOne({
        where: { id: requestId },
      });

      if (!request) {
        throw new RequestNotFoundException(`Request not found: ${requestId}`);
      }

      if (request.status !== TimeOffRequestStatus.PENDING) {
        throw new InvalidStateTransitionException(
          `Cannot reject request with status ${request.status}`,
        );
      }

      const beforeState = { ...request };

      // Release pending days
      await this.balanceService.releasePendingDays(
        request.employeeId,
        request.locationId,
        request.leaveType,
        request.daysRequested,
      );

      request.status = TimeOffRequestStatus.REJECTED;
      request.rejectionReason = reason;
      request.managerId = managerId;

      const updated = await this.requestRepository.save(request);

      await this.auditService.log({
        entityType: 'TimeOffRequest',
        entityId: request.id,
        action: 'REJECTED',
        actorId: managerId,
        beforeState,
        afterState: updated,
      });

      return updated;
    });
  }

  async cancelRequest(requestId: string, actorId: string): Promise<TimeOffRequestEntity> {
    return this.dataSource.transaction(async () => {
      const request = await this.requestRepository.findOne({
        where: { id: requestId },
      });

      if (!request) {
        throw new RequestNotFoundException(`Request not found: ${requestId}`);
      }

      if (request.status === TimeOffRequestStatus.CANCELLED) {
        throw new InvalidStateTransitionException('Request is already cancelled');
      }

      if (request.status === TimeOffRequestStatus.REJECTED) {
        throw new InvalidStateTransitionException('Cannot cancel a rejected request');
      }

      const beforeState = { ...request };

      if (request.status === TimeOffRequestStatus.APPROVED && request.hcmTransactionId) {
        // Call HCM reverse
        try {
          await this.hcmAdapter.reverseTimeOff(request.hcmTransactionId);

          // Decrement used days
          await this.balanceService.decrementUsedDays(
            request.employeeId,
            request.locationId,
            request.leaveType,
            request.daysRequested,
          );
        } catch (error) {
          console.error('Failed to reverse HCM transaction:', error);
          throw error;
        }
      } else if (request.status === TimeOffRequestStatus.PENDING) {
        // Release pending days
        await this.balanceService.releasePendingDays(
          request.employeeId,
          request.locationId,
          request.leaveType,
          request.daysRequested,
        );
      }

      request.status = TimeOffRequestStatus.CANCELLED;

      const updated = await this.requestRepository.save(request);

      await this.auditService.log({
        entityType: 'TimeOffRequest',
        entityId: request.id,
        action: 'CANCELLED',
        actorId,
        beforeState,
        afterState: updated,
      });

      return updated;
    });
  }

  async listRequests(filters: {
    employeeId?: string;
    status?: TimeOffRequestStatus;
  }): Promise<TimeOffRequestEntity[]> {
    const query = this.requestRepository.createQueryBuilder('request');

    if (filters.employeeId) {
      query.where('request.employeeId = :employeeId', {
        employeeId: filters.employeeId,
      });
    }

    if (filters.status) {
      query.andWhere('request.status = :status', { status: filters.status });
    }

    return query.orderBy('request.createdAt', 'DESC').getMany();
  }

  async getRequest(requestId: string): Promise<TimeOffRequestEntity> {
    const request = await this.requestRepository.findOne({
      where: { id: requestId },
    });

    if (!request) {
      throw new RequestNotFoundException(`Request not found: ${requestId}`);
    }

    return request;
  }
}
