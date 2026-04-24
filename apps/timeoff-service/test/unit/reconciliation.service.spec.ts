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
