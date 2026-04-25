/**
 * HcmAdapter Unit Tests
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
              const config: any = {
                HCM_BASE_URL: 'http://hcm.test:3001',
                HCM_TIMEOUT_MS: 5000,
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    adapter = module.get(HcmAdapter);
    httpService = module.get(HttpService);
  });

  // ===== SUCCESS =====
  describe('Success', () => {
    it('getBalance success', async () => {
      httpService.get.mockReturnValue(of({ data: { totalDays: 10 } } as any));

      const res = await adapter.getBalance('E1', 'L1', 'T1');
      expect(res.totalDays).toBe(10);
    });

    it('fileTimeOff success', async () => {
      httpService.post.mockReturnValue(
        of({ data: { status: 'SUCCESS', transactionId: 'TXN' } } as any),
      );

      const res = await adapter.fileTimeOff({} as any);
      expect(res.status).toBe('SUCCESS');
    });

    it('reverseTimeOff success', async () => {
      httpService.delete.mockReturnValue(of({ data: {} } as any));
      await expect(adapter.reverseTimeOff('TXN')).resolves.not.toThrow();
    });
  });

  // ===== ERROR BRANCHES =====
  describe('Error Handling', () => {
    it('timeout → HcmUnavailableError', async () => {
      httpService.get.mockReturnValue(throwError(() => new Error('ECONNABORTED')));

      await expect(adapter.getBalance('E', 'L', 'T')).rejects.toThrow(
        HcmUnavailableError,
      );
    });

    it('network error → HcmUnavailableError', async () => {
      httpService.post.mockReturnValue(throwError(() => new Error('ECONNREFUSED')));

      await expect(adapter.fileTimeOff({} as any)).rejects.toThrow(
        HcmUnavailableError,
      );
    });

    it('Axios 422 INSUFFICIENT_BALANCE', async () => {
      const err = new AxiosError();
      err.response = {
        status: 422,
        data: { code: 'INSUFFICIENT_BALANCE' },
      } as any;

      httpService.post.mockReturnValue(throwError(() => err));

      await expect(adapter.fileTimeOff({} as any)).rejects.toThrow(
        HcmInsufficientBalanceError,
      );
    });

    it('Axios 422 INVALID_DIMENSION', async () => {
      const err = new AxiosError();
      err.response = {
        status: 422,
        data: { code: 'INVALID_DIMENSION' },
      } as any;

      httpService.get.mockReturnValue(throwError(() => err));

      await expect(adapter.getBalance('E', 'L', 'T')).rejects.toThrow(
        HcmInvalidDimensionError,
      );
    });

    it('Axios 5xx → HcmUnavailableError', async () => {
      const err = new AxiosError();
      err.response = { status: 500 } as any;

      httpService.get.mockReturnValue(throwError(() => err));

      await expect(adapter.getBalance('E', 'L', 'T')).rejects.toThrow(
        HcmUnavailableError,
      );
    });

    it('Axios error without response', async () => {
      const err = new AxiosError('Network');
      

      httpService.get.mockReturnValue(throwError(() => err));

      await expect(adapter.getBalance('E', 'L', 'T')).rejects.toThrow(
        HcmUnavailableError,
      );
    });

    it('unexpected status (400)', async () => {
      const err = new AxiosError();
      err.response = { status: 400 } as any;

      httpService.get.mockReturnValue(throwError(() => err));

      await expect(adapter.getBalance('E', 'L', 'T')).rejects.toThrow(
        HcmUnavailableError,
      );
    });
  });

  // ===== EDGE CASES =====
  describe('Edge Cases', () => {
    it('null response → error', async () => {
      httpService.get.mockReturnValue(of(null as any));

      await expect(adapter.getBalance('E', 'L', 'T')).rejects.toThrow(
        HcmUnavailableError,
      );
    });

    it('missing data → error', async () => {
      httpService.get.mockReturnValue(of({} as any));

      await expect(adapter.getBalance('E', 'L', 'T')).rejects.toThrow(
        HcmUnavailableError,
      );
    });

    it('fileTimeOff null response', async () => {
      httpService.post.mockReturnValue(of(null as any));

      await expect(adapter.fileTimeOff({} as any)).rejects.toThrow(
        HcmUnavailableError,
      );
    });

    it('reverseTimeOff timeout', async () => {
      httpService.delete.mockReturnValue(throwError(() => new Error('ETIMEDOUT')));

      await expect(adapter.reverseTimeOff('TXN')).rejects.toThrow(
        HcmUnavailableError,
      );
    });

    it('string error passthrough', async () => {
      httpService.get.mockReturnValue(throwError(() => 'String error'));

      await expect(adapter.getBalance('E', 'L', 'T')).rejects.toThrow(
        'String error',
      );
    });

    it('already mapped error passthrough', async () => {
      httpService.get.mockReturnValue(
        throwError(() => new HcmInsufficientBalanceError('Handled')),
      );

      await expect(adapter.getBalance('E', 'L', 'T')).rejects.toThrow('Handled');
    });
  });
});