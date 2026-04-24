import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { createHash } from 'crypto';
import { IHcmAdapter } from '../hcm/hcm.adapter.interface';
import { BalanceService } from '../balance/balance.service';
import { SyncEventEntity, SyncEventSource, SyncEventStatus } from './entities/sync-event.entity';
import { HcmBatchDto } from './dto/hcm-batch.dto';
import { HcmEventDto } from './dto/hcm-event.dto';
import { LeaveBalanceEntity } from '../balance/entities/leave-balance.entity';
import { TimeOffRequestEntity, TimeOffRequestStatus } from '../requests/entities/time-off-request.entity';

@Injectable()
export class SyncService {
  constructor(
    @InjectRepository(SyncEventEntity)
    private readonly syncEventRepository: Repository<SyncEventEntity>,
    @InjectRepository(LeaveBalanceEntity)
    private readonly balanceRepository: Repository<LeaveBalanceEntity>,
    @InjectRepository(TimeOffRequestEntity)
    private readonly requestRepository: Repository<TimeOffRequestEntity>,
    @Inject('HCM_ADAPTER')
    private readonly hcmAdapter: IHcmAdapter,
    private readonly balanceService: BalanceService,
    private readonly dataSource: DataSource,
  ) {}

  async processBatch(batch: HcmBatchDto): Promise<{ processed: number; flagged: number }> {
    return this.dataSource.transaction(async (manager) => {
      let processed = 0;
      let flagged = 0;

      for (const balanceDto of batch.balances) {
        const oldBalance = await manager.findOne(LeaveBalanceEntity, {
          where: {
            employeeId: balanceDto.employeeId,
            locationId: balanceDto.locationId,
            leaveType: balanceDto.leaveType,
          },
        });

        const { changed } = await this.balanceService.upsertFromHcm(balanceDto);
        if (changed) {
          processed++;

          // If balance decreased, flag PENDING requests
          if (oldBalance) {
            const oldAvailable =
              oldBalance.totalDays - oldBalance.usedDays - oldBalance.pendingDays;
            const newBalance = await manager.findOne(LeaveBalanceEntity, {
              where: {
                employeeId: balanceDto.employeeId,
                locationId: balanceDto.locationId,
                leaveType: balanceDto.leaveType,
              },
            });

            if (newBalance) {
              const newAvailable = newBalance.availableDays;

              if (newAvailable < oldAvailable) {
                // Find PENDING requests that exceed new available
                const pendingRequests = await manager.find(TimeOffRequestEntity, {
                  where: {
                    employeeId: balanceDto.employeeId,
                    locationId: balanceDto.locationId,
                    leaveType: balanceDto.leaveType,
                    status: TimeOffRequestStatus.PENDING,
                  },
                });

                for (const request of pendingRequests) {
                  if (request.daysRequested >= newAvailable) {
                    request.status = TimeOffRequestStatus.REQUIRES_REVIEW;
                    await manager.save(request);
                    flagged++;
                  }
                }
              }
            }
          }
        }
      }

      return { processed, flagged };
    });
  }

  async processHcmEvent(event: HcmEventDto): Promise<void> {
    // Compute SHA256 idempotencyKey
    const payloadStr = JSON.stringify(event);
    const idempotencyKey = createHash('sha256').update(payloadStr).digest('hex');

    // Check for duplicate
    const existing = await this.syncEventRepository.findOne({
      where: { idempotencyKey },
    });

    if (existing) {
      // Already processed, skip
      return;
    }

    // Create sync event record
    const syncEvent = this.syncEventRepository.create({
      source: SyncEventSource.HCM_EVENT,
      idempotencyKey,
      payload: event,
      status: SyncEventStatus.PENDING,
    });

    await this.syncEventRepository.save(syncEvent);

    try {
      // Upsert balance
      await this.balanceService.upsertFromHcm({
        employeeId: event.employeeId,
        locationId: event.locationId,
        leaveType: event.leaveType,
        totalDays: event.totalDays,
        usedDays: event.usedDays,
      });

      // Find PENDING requests that exceed available
      const newBalance = await this.balanceRepository.findOne({
        where: {
          employeeId: event.employeeId,
          locationId: event.locationId,
          leaveType: event.leaveType,
        },
      });

      if (newBalance) {
        const availableDays = newBalance.availableDays;
        const pendingRequests = await this.requestRepository.find({
          where: {
            employeeId: event.employeeId,
            locationId: event.locationId,
            leaveType: event.leaveType,
            status: TimeOffRequestStatus.PENDING,
          },
        });

        for (const request of pendingRequests) {
          if (request.daysRequested > availableDays) {
            request.status = TimeOffRequestStatus.REQUIRES_REVIEW;
            await this.requestRepository.save(request);
          }
        }
      }

      // Mark as processed
      syncEvent.status = SyncEventStatus.PROCESSED;
      syncEvent.processedAt = new Date();
      await this.syncEventRepository.save(syncEvent);
    } catch (error) {
      syncEvent.status = SyncEventStatus.FAILED;
      syncEvent.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.syncEventRepository.save(syncEvent);
      throw error;
    }
  }

  async pullBalance(
    employeeId: string,
    locationId: string,
    leaveType: string,
  ): Promise<LeaveBalanceEntity> {
    const hcmBalance = await this.hcmAdapter.getBalance(
      employeeId,
      locationId,
      leaveType,
    );

    const { balance } = await this.balanceService.upsertFromHcm(hcmBalance);
    return balance;
  }

  async getPendingSyncEvents(): Promise<SyncEventEntity[]> {
    return this.syncEventRepository.find({
      where: { status: SyncEventStatus.PENDING },
      order: { createdAt: 'ASC' },
    });
  }
}
