import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { LeaveBalanceEntity } from '../balance/entities/leave-balance.entity';
import { SyncService } from './sync.service';

export interface ReconciliationResult {
  checked: number;
  updated: number;
  errors: string[];
}

@Injectable()
export class ReconciliationService {
  constructor(
    @InjectRepository(LeaveBalanceEntity)
    private readonly balanceRepository: Repository<LeaveBalanceEntity>,
    private readonly syncService: SyncService,
  ) {}

  async reconcileStaleBalances(staleAfterMs = 6 * 60 * 60 * 1000): Promise<ReconciliationResult> {
    const result: ReconciliationResult = {
      checked: 0,
      updated: 0,
      errors: [],
    };

    const cutoff = new Date(Date.now() - staleAfterMs);
    const staleBalances = await this.balanceRepository.find({
      where: { lastSyncedAt: LessThan(cutoff) },
    });

    result.checked = staleBalances.length;

    for (const balance of staleBalances) {
      try {
        const beforeTotal = balance.totalDays;
        const beforeUsed = balance.usedDays;

        const updated = await this.syncService.pullBalance(
          balance.employeeId,
          balance.locationId,
          balance.leaveType,
        );

        if (updated.totalDays !== beforeTotal || updated.usedDays !== beforeUsed) {
          result.updated++;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(
          `Failed to sync balance for ${balance.employeeId}/${balance.locationId}/${balance.leaveType}: ${errorMsg}`,
        );
      }
    }

    return result;
  }
}

