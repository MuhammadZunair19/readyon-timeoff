import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BalanceNotFoundException, InsufficientBalanceException, OptimisticLockException } from '../shared/exceptions';
import { LeaveBalanceEntity } from './entities/leave-balance.entity';
import { HcmBalanceDto } from '../hcm/hcm.adapter.interface';

export interface UpsertResult {
  balance: LeaveBalanceEntity;
  changed: boolean;
}

@Injectable()
export class BalanceService {
  private readonly maxRetries: number;

  constructor(
    @InjectRepository(LeaveBalanceEntity)
    private readonly balanceRepository: Repository<LeaveBalanceEntity>,
    private readonly dataSource: DataSource,
  ) {
    this.maxRetries = Number(process.env['OPTIMISTIC_LOCK_RETRIES'] ?? 10);
  }

  async getBalancesForEmployee(employeeId: string): Promise<LeaveBalanceEntity[]> {
    return this.balanceRepository.find({
      where: { employeeId },
    });
  }

  async getBalance(
    employeeId: string,
    locationId: string,
    leaveType?: string,
  ): Promise<LeaveBalanceEntity | LeaveBalanceEntity[]> {
    if (leaveType) {
      const balance = await this.balanceRepository.findOne({
        where: { employeeId, locationId, leaveType },
      });

      if (!balance) {
        throw new BalanceNotFoundException(
          `Balance not found for employee ${employeeId}, location ${locationId}, leave type ${leaveType}`,
        );
      }

      return balance;
    }

    const balances = await this.balanceRepository.find({
      where: { employeeId, locationId },
    });

    if (balances.length === 0) {
      throw new BalanceNotFoundException(
        `No balances found for employee ${employeeId}, location ${locationId}`,
      );
    }

    return balances;
  }

  async reservePendingDays(
    employeeId: string,
    locationId: string,
    leaveType: string,
    days: number,
    requestId: string,
  ): Promise<LeaveBalanceEntity> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const balance = await this.balanceRepository.findOne({
          where: { employeeId, locationId, leaveType },
        });

        if (!balance) {
          throw new BalanceNotFoundException(
            `Balance not found for employee ${employeeId}, location ${locationId}, leave type ${leaveType}`,
          );
        }

        const availableDays = balance.totalDays - balance.usedDays - balance.pendingDays;
        if (availableDays < days) {
          throw new InsufficientBalanceException(
            `Insufficient balance. Available: ${availableDays}, Requested: ${days}`,
          );
        }

        const nextVersion = (balance.version ?? 0) + 1;
        const qb = this.balanceRepository
          .createQueryBuilder()
          .update(LeaveBalanceEntity)
          .set({
            pendingDays: balance.pendingDays + days,
            version: nextVersion,
          })
          .where('id = :id', { id: balance.id });

        if (balance.version == null) {
          qb.andWhere('version IS NULL');
        } else {
          qb.andWhere('version = :version', { version: balance.version });
        }

        const result = await qb.execute();

        if (result.affected === 0) {
          throw new OptimisticLockException(
            `Optimistic lock conflict for balance ${balance.id}`,
          );
        }

        return this.balanceRepository.findOneOrFail({ where: { id: balance.id } });
      } catch (error) {
        if (error instanceof OptimisticLockException && attempt < this.maxRetries) {
          lastError = error;
          // Continue to retry
          continue;
        }

        throw error;
      }
    }

    throw lastError || new OptimisticLockException(
      `Failed to reserve pending days after ${this.maxRetries} retries`,
    );
  }

  async confirmUsedDays(
    employeeId: string,
    locationId: string,
    leaveType: string,
    days: number,
  ): Promise<LeaveBalanceEntity> {
    return this.dataSource.transaction(async (manager) => {
      const balance = await manager.findOne(LeaveBalanceEntity, {
        where: { employeeId, locationId, leaveType },
      });

      if (!balance) {
        throw new BalanceNotFoundException(
          `Balance not found for employee ${employeeId}, location ${locationId}, leave type ${leaveType}`,
        );
      }

      balance.usedDays += days;
      balance.pendingDays = Math.max(0, balance.pendingDays - days);
      balance.lastSyncedAt = new Date();

      return manager.save(balance);
    });
  }

  async decrementUsedDays(
    employeeId: string,
    locationId: string,
    leaveType: string,
    days: number,
  ): Promise<LeaveBalanceEntity> {
    return this.dataSource.transaction(async (manager) => {
      const balance = await manager.findOne(LeaveBalanceEntity, {
        where: { employeeId, locationId, leaveType },
      });

      if (!balance) {
        throw new BalanceNotFoundException(
          `Balance not found for employee ${employeeId}, location ${locationId}, leave type ${leaveType}`,
        );
      }

      balance.usedDays = Math.max(0, balance.usedDays - days);
      balance.lastSyncedAt = new Date();
      return manager.save(balance);
    });
  }

  async releasePendingDays(
    employeeId: string,
    locationId: string,
    leaveType: string,
    days: number,
  ): Promise<LeaveBalanceEntity> {
    return this.dataSource.transaction(async (manager) => {
      const balance = await manager.findOne(LeaveBalanceEntity, {
        where: { employeeId, locationId, leaveType },
      });

      if (!balance) {
        throw new BalanceNotFoundException(
          `Balance not found for employee ${employeeId}, location ${locationId}, leave type ${leaveType}`,
        );
      }

      balance.pendingDays = Math.max(0, balance.pendingDays - days);
      return manager.save(balance);
    });
  }

  async upsertFromHcm(hcmBalance: HcmBalanceDto): Promise<UpsertResult> {
    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(LeaveBalanceEntity, {
        where: {
          employeeId: hcmBalance.employeeId,
          locationId: hcmBalance.locationId,
          leaveType: hcmBalance.leaveType,
        },
      });

      if (!existing) {
        // Create new balance
        const newBalance = manager.create(LeaveBalanceEntity, {
          employeeId: hcmBalance.employeeId,
          locationId: hcmBalance.locationId,
          leaveType: hcmBalance.leaveType,
          totalDays: hcmBalance.totalDays,
          usedDays: hcmBalance.usedDays,
          pendingDays: 0,
          lastSyncedAt: new Date(),
        });

        const saved = await manager.save(newBalance);
        return { balance: saved, changed: true };
      }

      // Check if changed
      const changed =
        existing.totalDays !== hcmBalance.totalDays ||
        existing.usedDays !== hcmBalance.usedDays;

      if (changed) {
        const updated = await manager.save(LeaveBalanceEntity, {
          ...existing,
          totalDays: hcmBalance.totalDays,
          usedDays: hcmBalance.usedDays,
          lastSyncedAt: new Date(),
        });

        return { balance: updated, changed: true };
      }

      // Just update lastSyncedAt
      existing.lastSyncedAt = new Date();
      const updated = await manager.save(existing);
      return { balance: updated, changed: false };
    });
  }
}
