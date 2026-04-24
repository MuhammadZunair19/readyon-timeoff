/**
 * HcmAdapter Unit Tests
 *
 * Invariant: HcmAdapter correctly handles all HCM API interactions including
 * timeouts, errors, and edge cases while maintaining data integrity.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { AxiosError } from 'axios';
import { HcmAdapter } from '../../src/hcm/hcm.adapter';
import {
  HcmUnavailableError,
  HcmInsufficientBalanceError,
  HcmInvalidDimensionError,
} from '../../src/shared/exceptions';

describe('HcmAdapter (Unit)', () => {
  let adapter: HcmAdapter;
  let httpService: jest.Mocked<HttpService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HcmAdapter,
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
            post: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              const config: Record<string, any> = {
                HCM_BASE_URL: 'http://hcm.test:3001',
                HCM_TIMEOUT_MS: 5000,
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    adapter = module.get<HcmAdapter>(HcmAdapter);
    httpService = module.get(HttpService) as jest.Mocked<HttpService>;
    configService = module.get(ConfigService) as jest.Mocked<ConfigService>;
  });

  // ===== Phase 1: Success Scenarios =====

  describe('Success Scenarios', () => {
    it('should successfully get balance from HCM', async () => {
      const mockResponse = {
        data: {
          employeeId: 'E001',
          locationId: 'NYC',
          leaveType: 'ANNUAL',
          totalDays: 20,
          usedDays: 5,
        },
      };

      httpService.get.mockReturnValue(of(mockResponse as any));

      const result = await adapter.getBalance('E001', 'NYC', 'ANNUAL');

      expect(result).toEqual(mockResponse.data);
      expect(httpService.get).toHaveBeenCalledWith(
        'http://hcm.test:3001/hcm/balances/E001/NYC/ANNUAL',
        expect.objectContaining({ timeout: 5000 }),
      );
    });

    it('should successfully file time-off with HCM', async () => {
      const mockResponse = {
        data: {
          transactionId: 'TXN-12345',
          status: 'SUCCESS',
        },
      };

      httpService.post.mockReturnValue(of(mockResponse as any));

      const result = await adapter.fileTimeOff({
        employeeId: 'E001',
        locationId: 'NYC',
        leaveType: 'ANNUAL',
        startDate: '2026-05-01',
        endDate: '2026-05-05',
        daysRequested: 5,
        idempotencyKey: 'key-123',
      });

      expect(result.status).toBe('SUCCESS');
      expect(result.transactionId).toBe('TXN-12345');
      expect(httpService.post).toHaveBeenCalledWith(
        'http://hcm.test:3001/hcm/time-off',
        expect.objectContaining({ employeeId: 'E001' }),
        expect.objectContaining({ timeout: 5000 }),
      );
    });

    it('should handle HCM rejection response', async () => {
      const mockResponse = {
        data: {
          status: 'REJECTED',
          rejectionReason: 'Insufficient balance',
        },
      };

      httpService.post.mockReturnValue(of(mockResponse as any));

      const result = await adapter.fileTimeOff({
        employeeId: 'E001',
        locationId: 'NYC',
        leaveType: 'ANNUAL',
        startDate: '2026-05-01',
        endDate: '2026-05-05',
        daysRequested: 5,
        idempotencyKey: 'key-123',
      });

      expect(result.status).toBe('REJECTED');
      expect(result.rejectionReason).toBe('Insufficient balance');
    });

    it('should successfully reverse time-off', async () => {
      httpService.delete.mockReturnValue(of({ data: { success: true } } as any));

      await expect(adapter.reverseTimeOff('TXN-12345')).resolves.not.toThrow();

      expect(httpService.delete).toHaveBeenCalledWith(
        'http://hcm.test:3001/hcm/time-off/TXN-12345',
        expect.objectContaining({ timeout: 5000 }),
      );
    });

    it('should get batch balances from HCM', async () => {
      const mockResponse = {
        data: [
          {
            employeeId: 'E001',
            locationId: 'NYC',
            leaveType: 'ANNUAL',
            totalDays: 20,
            usedDays: 5,
          },
          {
            employeeId: 'E002',
            locationId: 'SF',
            leaveType: 'ANNUAL',
            totalDays: 15,
            usedDays: 3,
          },
        ],
      };

      httpService.get.mockReturnValue(of(mockResponse as any));

      const result = await adapter.getBatchBalances();

      expect(result).toHaveLength(2);
      expect(result[0]!.employeeId).toBe('E001');
      expect(result[1]!.employeeId).toBe('E002');
      expect(httpService.get).toHaveBeenCalledWith(
        'http://hcm.test:3001/hcm/batch/balances',
        expect.objectContaining({ timeout: 5000 }),
      );
    });
  });

  // ===== Phase 2: Error Scenarios =====

  describe('Error Scenarios', () => {
    it('should throw HcmUnavailableError on timeout', async () => {
      httpService.get.mockReturnValue(
        throwError(() => new Error('ECONNABORTED')),
      );

      await expect(adapter.getBalance('E001', 'NYC', 'ANNUAL')).rejects.toThrow(
        HcmUnavailableError,
      );
    });

    it('should throw HcmInsufficientBalanceError on 422 INSUFFICIENT_BALANCE', async () => {
      const axiosError = new AxiosError();
      axiosError.response = {
        status: 422,
        data: { code: 'INSUFFICIENT_BALANCE', message: 'Not enough days' },
      } as any;

      httpService.post.mockReturnValue(throwError(() => axiosError));

      await expect(
        adapter.fileTimeOff({
          employeeId: 'E001',
          locationId: 'NYC',
          leaveType: 'ANNUAL',
          startDate: '2026-05-01',
          endDate: '2026-05-05',
          daysRequested: 5,
          idempotencyKey: 'key-123',
        }),
      ).rejects.toThrow(HcmInsufficientBalanceError);
    });

    it('should throw HcmInvalidDimensionError on 422 INVALID_DIMENSION', async () => {
      const axiosError = new AxiosError();
      axiosError.response = {
        status: 422,
        data: { code: 'INVALID_DIMENSION', message: 'Invalid location' },
      } as any;

      httpService.get.mockReturnValue(throwError(() => axiosError));

      await expect(adapter.getBalance('E001', 'INVALID', 'ANNUAL')).rejects.toThrow(
        HcmInvalidDimensionError,
      );
    });

    it('should throw HcmUnavailableError on 5xx error', async () => {
      const axiosError = new AxiosError();
      axiosError.response = { status: 503 } as any;

      httpService.get.mockReturnValue(throwError(() => axiosError));

      await expect(adapter.getBalance('E001', 'NYC', 'ANNUAL')).rejects.toThrow(
        HcmUnavailableError,
      );
    });

    it('should throw HcmUnavailableError when response is null (timeout)', async () => {
      httpService.get.mockReturnValue(of(null as any));

      await expect(adapter.getBalance('E001', 'NYC', 'ANNUAL')).rejects.toThrow(
        HcmUnavailableError,
      );
    });

    it('should throw HcmUnavailableError on network error', async () => {
      httpService.post.mockReturnValue(
        throwError(() => new Error('ECONNREFUSED')),
      );

      await expect(
        adapter.fileTimeOff({
          employeeId: 'E001',
          locationId: 'NYC',
          leaveType: 'ANNUAL',
          startDate: '2026-05-01',
          endDate: '2026-05-05',
          daysRequested: 5,
          idempotencyKey: 'key-123',
        }),
      ).rejects.toThrow(HcmUnavailableError);
    });

    it('should throw HcmUnavailableError on delete timeout', async () => {
      httpService.delete.mockReturnValue(throwError(() => new Error('ETIMEDOUT')));

      await expect(adapter.reverseTimeOff('TXN-12345')).rejects.toThrow(
        HcmUnavailableError,
      );
    });
  });

  // ===== Phase 3: Edge Cases =====

  describe('Edge Cases', () => {
    it('should handle zero balance', async () => {
      const mockResponse = {
        data: {
          employeeId: 'E001',
          locationId: 'NYC',
          leaveType: 'ANNUAL',
          totalDays: 0,
          usedDays: 0,
        },
      };

      httpService.get.mockReturnValue(of(mockResponse as any));

      const result = await adapter.getBalance('E001', 'NYC', 'ANNUAL');

      expect(result.totalDays).toBe(0);
    });

    it('should handle fractional days', async () => {
      const mockResponse = {
        data: {
          employeeId: 'E001',
          locationId: 'NYC',
          leaveType: 'ANNUAL',
          totalDays: 20.5,
          usedDays: 2.25,
        },
      };

      httpService.get.mockReturnValue(of(mockResponse as any));

      const result = await adapter.getBalance('E001', 'NYC', 'ANNUAL');

      expect(result.totalDays).toBe(20.5);
      expect(result.usedDays).toBe(2.25);
    });

    it('should handle very large balance', async () => {
      const mockResponse = {
        data: {
          employeeId: 'E001',
          locationId: 'NYC',
          leaveType: 'ANNUAL',
          totalDays: 999999,
          usedDays: 50000,
        },
      };

      httpService.get.mockReturnValue(of(mockResponse as any));

      const result = await adapter.getBalance('E001', 'NYC', 'ANNUAL');

      expect(result.totalDays).toBe(999999);
    });

    it('should handle multiple employees in batch', async () => {
      const mockResponse = {
        data: Array.from({ length: 100 }, (_, i) => ({
          employeeId: `E${String(i).padStart(3, '0')}`,
          locationId: 'NYC',
          leaveType: 'ANNUAL',
          totalDays: 20,
          usedDays: 5,
        })),
      };

      httpService.get.mockReturnValue(of(mockResponse as any));

      const result = await adapter.getBatchBalances();

      expect(result).toHaveLength(100);
      expect(result[0]!.employeeId).toBe('E000');
      expect(result[99]!.employeeId).toBe('E099');
    });

    it('should handle empty batch response', async () => {
      const mockResponse = {
        data: [],
      };

      httpService.get.mockReturnValue(of(mockResponse as any));

      const result = await adapter.getBatchBalances();

      expect(result).toEqual([]);
    });

    it('should preserve transaction ID in file response', async () => {
      const mockResponse = {
        data: {
          transactionId: 'TXN-LONGID-123456789',
          status: 'SUCCESS',
        },
      };

      httpService.post.mockReturnValue(of(mockResponse as any));

      const result = await adapter.fileTimeOff({
        employeeId: 'E001',
        locationId: 'NYC',
        leaveType: 'ANNUAL',
        startDate: '2026-05-01',
        endDate: '2026-05-05',
        daysRequested: 5,
        idempotencyKey: 'key-123',
      });

      expect(result.transactionId).toBe('TXN-LONGID-123456789');
    });

    it('should handle empty error message from HCM', async () => {
      const axiosError = new AxiosError();
      axiosError.response = {
        status: 422,
        data: { code: 'INSUFFICIENT_BALANCE' },
      } as any;

      httpService.get.mockReturnValue(throwError(() => axiosError));

      await expect(adapter.getBalance('E001', 'NYC', 'ANNUAL')).rejects.toThrow(
        'Insufficient balance in HCM',
      );
    });
  });
});
