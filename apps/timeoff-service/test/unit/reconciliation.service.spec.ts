/**
 * ReconciliationService Unit Tests - Simplified Version
 *
 * Focus on integration points and error handling.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReconciliationCronService } from '../../src/sync/reconciliation.cron';
import { ReconciliationService } from '../../src/sync/reconciliation.service';
import { LeaveBalanceEntity } from '../../src/balance/entities/leave-balance.entity';

describe('ReconciliationService (Unit)', () => {
  let cronService: ReconciliationCronService;
  let reconciliationService: ReconciliationService;

  beforeEach(async () => {
    const mockReconciliationService = {
      reconcileStaleBalances: jest.fn().mockResolvedValue({
        checked: 5,
        updated: 2,
        errors: [],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReconciliationCronService,
        {
          provide: ReconciliationService,
          useValue: mockReconciliationService,
        },
      ],
    }).compile();

    cronService = module.get<ReconciliationCronService>(ReconciliationCronService);
    reconciliationService = module.get<ReconciliationService>(ReconciliationService);
  });

  describe('Basic Reconciliation', () => {
    it('should call reconcileStaleBalances', async () => {
      await cronService.reconcile();

      expect(reconciliationService.reconcileStaleBalances).toHaveBeenCalled();
    });

    it('should handle successful reconciliation', async () => {
      jest
        .spyOn(reconciliationService, 'reconcileStaleBalances')
        .mockResolvedValue({ checked: 5, updated: 3, errors: [] });

      await cronService.reconcile();

      expect(reconciliationService.reconcileStaleBalances).toHaveBeenCalled();
    });

    it('should handle reconciliation with errors', async () => {
      jest.spyOn(reconciliationService, 'reconcileStaleBalances').mockResolvedValue({
        checked: 5,
        updated: 2,
        errors: ['Failed to sync E001/NYC/ANNUAL'],
      });

      await cronService.reconcile();

      expect(reconciliationService.reconcileStaleBalances).toHaveBeenCalled();
    });

    it('should handle no changes detected', async () => {
      jest.spyOn(reconciliationService, 'reconcileStaleBalances').mockResolvedValue({
        checked: 5,
        updated: 0,
        errors: [],
      });

      await cronService.reconcile();

      expect(reconciliationService.reconcileStaleBalances).toHaveBeenCalled();
    });

    it('should handle service errors gracefully', async () => {
      jest
        .spyOn(reconciliationService, 'reconcileStaleBalances')
        .mockRejectedValue(new Error('Service error'));

      await expect(cronService.reconcile()).rejects.toThrow('Service error');
    });

    it('should handle HCM unavailability', async () => {
      jest.spyOn(reconciliationService, 'reconcileStaleBalances').mockResolvedValue({
        checked: 0,
        updated: 0,
        errors: ['HCM service unavailable'],
      });

      await cronService.reconcile();

      expect(reconciliationService.reconcileStaleBalances).toHaveBeenCalled();
    });

    it('should handle timeout during reconciliation', async () => {
      jest
        .spyOn(reconciliationService, 'reconcileStaleBalances')
        .mockImplementation(
          () =>
            new Promise((resolve) =>
              setTimeout(() => resolve({ checked: 0, updated: 0, errors: ['Timeout'] }), 100),
            ),
        );

      await cronService.reconcile();

      expect(reconciliationService.reconcileStaleBalances).toHaveBeenCalled();
    });

    it('should support multiple consecutive reconciliations', async () => {
      jest.spyOn(reconciliationService, 'reconcileStaleBalances').mockResolvedValue({
        checked: 5,
        updated: 2,
        errors: [],
      });

      await cronService.reconcile();
      await cronService.reconcile();
      await cronService.reconcile();

      expect(reconciliationService.reconcileStaleBalances).toHaveBeenCalledTimes(3);
    });

    it('should handle large batch updates', async () => {
      jest.spyOn(reconciliationService, 'reconcileStaleBalances').mockResolvedValue({
        checked: 1000,
        updated: 500,
        errors: [],
      });

      await cronService.reconcile();

      expect(reconciliationService.reconcileStaleBalances).toHaveBeenCalled();
    });

    it('should track errors per employee', async () => {
      jest.spyOn(reconciliationService, 'reconcileStaleBalances').mockResolvedValue({
        checked: 5,
        updated: 3,
        errors: [
          'Failed E001/NYC/ANNUAL',
          'Failed E002/SF/ANNUAL',
        ],
      });

      await cronService.reconcile();

      expect(reconciliationService.reconcileStaleBalances).toHaveBeenCalled();
    });
  });
});

import { SyncService } from '../../src/sync/sync.service';

describe('ReconciliationService (Implementation Unit)', () => {
  let reconciliationService: ReconciliationService;
  let balanceRepository: jest.Mocked<Repository<LeaveBalanceEntity>>;
  let syncService: jest.Mocked<SyncService>;

  beforeEach(async () => {
    const mockBalanceRepo = {
      find: jest.fn(),
    };

    const mockSyncService = {
      pullBalance: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReconciliationService,
        {
          provide: getRepositoryToken(LeaveBalanceEntity),
          useValue: mockBalanceRepo,
        },
        {
          provide: SyncService,
          useValue: mockSyncService,
        },
      ],
    }).compile();

    reconciliationService = module.get<ReconciliationService>(ReconciliationService);
    balanceRepository = module.get(getRepositoryToken(LeaveBalanceEntity)) as any;
    syncService = module.get(SyncService) as any;
  });

  describe('reconcileStaleBalances', () => {
    it('should return empty result if no stale balances', async () => {
      balanceRepository.find.mockResolvedValue([]);
      
      const result = await reconciliationService.reconcileStaleBalances();
      
      expect(result.checked).toBe(0);
      expect(result.updated).toBe(0);
      expect(result.errors).toEqual([]);
    });

    it('should sync balances and report updates', async () => {
      balanceRepository.find.mockResolvedValue([
        { employeeId: 'E1', locationId: 'L1', leaveType: 'ANNUAL', totalDays: 10, usedDays: 2 } as any,
        { employeeId: 'E2', locationId: 'L2', leaveType: 'SICK', totalDays: 5, usedDays: 1 } as any,
      ]);

      // First balance changes, second stays the same
      syncService.pullBalance.mockResolvedValueOnce({ totalDays: 15, usedDays: 2 } as any)
                             .mockResolvedValueOnce({ totalDays: 5, usedDays: 1 } as any);

      const result = await reconciliationService.reconcileStaleBalances();
      
      expect(result.checked).toBe(2);
      expect(result.updated).toBe(1);
      expect(result.errors).toEqual([]);
    });

    it('should handle errors for individual balances and continue', async () => {
      balanceRepository.find.mockResolvedValue([
        { employeeId: 'E1', locationId: 'L1', leaveType: 'ANNUAL', totalDays: 10, usedDays: 2 } as any,
        { employeeId: 'E2', locationId: 'L2', leaveType: 'SICK', totalDays: 5, usedDays: 1 } as any,
      ]);

      syncService.pullBalance.mockRejectedValueOnce(new Error('HCM Sync Failed'))
                             .mockResolvedValueOnce({ totalDays: 5, usedDays: 2 } as any); // changed

      const result = await reconciliationService.reconcileStaleBalances();
      
      expect(result.checked).toBe(2);
      expect(result.updated).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to sync balance for E1/L1/ANNUAL: HCM Sync Failed');
    });

    it('should handle non-Error objects thrown during sync', async () => {
      balanceRepository.find.mockResolvedValue([
        { employeeId: 'E1', locationId: 'L1', leaveType: 'ANNUAL', totalDays: 10, usedDays: 2 } as any,
      ]);

      syncService.pullBalance.mockRejectedValueOnce('Some string error');

      const result = await reconciliationService.reconcileStaleBalances();
      
      expect(result.checked).toBe(1);
      expect(result.errors[0]).toContain('Some string error');
    });
  });
});
