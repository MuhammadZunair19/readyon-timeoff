import { Test, TestingModule } from '@nestjs/testing';
import { HcmMockAdapter } from '../../src/hcm/hcm-mock.adapter';
import { HcmInsufficientBalanceError } from '../../src/shared/exceptions';

describe('HcmMockAdapter (Unit)', () => {
  let adapter: HcmMockAdapter;

  beforeEach(() => {
    adapter = new HcmMockAdapter();
  });

  describe('getBalance', () => {
    it('should throw Error if balance not found', async () => {
      await expect(adapter.getBalance('E999', 'NYC', 'ANNUAL')).rejects.toThrow('Balance not found: E999/NYC/ANNUAL');
    });
  });

  describe('fileTimeOff', () => {
    it('should throw Error if balance not found', async () => {
      await expect(
        adapter.fileTimeOff({
          employeeId: 'E999',
          locationId: 'NYC',
          leaveType: 'ANNUAL',
          startDate: '2026-05-01',
          endDate: '2026-05-05',
          daysRequested: 5,
          idempotencyKey: 'key-123',
        }),
      ).rejects.toThrow('Balance not found: E999/NYC/ANNUAL');
    });

    it('should return existing transaction id if idempotency key matches', async () => {
      const dto = {
        employeeId: 'E001',
        locationId: 'NYC',
        leaveType: 'ANNUAL',
        startDate: '2026-05-01',
        endDate: '2026-05-05',
        daysRequested: 5,
        idempotencyKey: 'idem-1',
      };
      
      const first = await adapter.fileTimeOff(dto);
      const second = await adapter.fileTimeOff(dto);

      expect(first.transactionId).toBe(second.transactionId);
      expect(second.status).toBe('SUCCESS');
    });

    it('should throw HcmInsufficientBalanceError if available < requested', async () => {
      await expect(
        adapter.fileTimeOff({
          employeeId: 'E001',
          locationId: 'NYC',
          leaveType: 'ANNUAL',
          startDate: '2026-05-01',
          endDate: '2026-05-05',
          daysRequested: 50,
          idempotencyKey: 'key-large',
        }),
      ).rejects.toThrow(HcmInsufficientBalanceError);
    });
  });

  describe('reverseTimeOff', () => {
    it('should throw Error if transaction not found', async () => {
      await expect(adapter.reverseTimeOff('UNKNOWN')).rejects.toThrow('Transaction not found: UNKNOWN');
    });
  });

  describe('getBatchBalances', () => {
    it('should handle malformed keys in internal map gracefully', async () => {
      // Intentionally insert a malformed key
      (adapter as any).balances.set('MALFORMED', { totalDays: 1, usedDays: 0 });
      
      const batch = await adapter.getBatchBalances();
      
      // The output should skip 'MALFORMED'
      const malformed = batch.find(b => b.employeeId === 'MALFORMED');
      expect(malformed).toBeUndefined();
    });
  });

  describe('test helper methods', () => {
    it('should set and get internal balance', () => {
      adapter.setBalance('E-TEST', 'LOC', 'TYPE', 10, 2);
      
      const balance = adapter.getInternalBalance('E-TEST', 'LOC', 'TYPE');
      expect(balance).toBeDefined();
      expect(balance?.totalDays).toBe(10);
      expect(balance?.usedDays).toBe(2);
    });
  });
});
