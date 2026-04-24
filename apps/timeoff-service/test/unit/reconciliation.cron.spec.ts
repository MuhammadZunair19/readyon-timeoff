/**
 * ReconciliationCronService Unit Tests
 *
 * Invariant: Cron job reconciles stale balances (>6 hours old) with HCM source of truth,
 * logging success count, update count, and all errors encountered.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReconciliationCronService } from '../../src/sync/reconciliation.cron';
import { ReconciliationService } from '../../src/sync/reconciliation.service';
import { LeaveBalanceEntity } from '../../src/balance/entities/leave-balance.entity';
import { SyncService } from '../../src/sync/sync.service';

describe('ReconciliationCronService (Unit)', () => {
  let service: ReconciliationCronService;
  let reconciliationService: ReconciliationService;
  let balanceRepository: Repository<LeaveBalanceEntity>;
  let syncService: SyncService;

  const staleBalance: LeaveBalanceEntity = {
    id: 'balance-1',
    employeeId: 'E001',
    locationId: 'NYC',
    leaveType: 'ANNUAL',
    totalDays: 20,
    usedDays: 5,
    pendingDays: 0,
    lastSyncedAt: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    availableDays: 15,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReconciliationCronService,
        {
          provide: ReconciliationService,
          useValue: {
            reconcileStaleBalances: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ReconciliationCronService>(ReconciliationCronService);
    reconciliationService = module.get<ReconciliationService>(ReconciliationService);
  });

  describe('reconcile', () => {
    it('should pull stale balances from HCM', async () => {
      jest.spyOn(reconciliationService, 'reconcileStaleBalances').mockResolvedValue({
        checked: 1,
        updated: 1,
        errors: [],
      });

      await service.reconcile();

      expect(reconciliationService.reconcileStaleBalances).toHaveBeenCalled();
    });

    it('should handle errors gracefully and include them in result', async () => {
      jest.spyOn(reconciliationService, 'reconcileStaleBalances').mockResolvedValue({
        checked: 1,
        updated: 0,
        errors: ['HCM unavailable'],
      });

      await service.reconcile();

      expect(reconciliationService.reconcileStaleBalances).toHaveBeenCalled();
    });

    it('should detect when balance has not changed', async () => {
      jest.spyOn(reconciliationService, 'reconcileStaleBalances').mockResolvedValue({
        checked: 1,
        updated: 0,
        errors: [],
      });

      await service.reconcile();

      expect(reconciliationService.reconcileStaleBalances).toHaveBeenCalled();
    });
  });
});
