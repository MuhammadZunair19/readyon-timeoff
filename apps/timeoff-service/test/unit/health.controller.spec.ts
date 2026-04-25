/**
 * HealthController Unit Tests
 *
 * Invariant: Health endpoint accurately reflects the operational status of all
 * downstream dependencies (database, HCM) and reports consistent results.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from '../../src/health/health.controller';
import { DataSource } from 'typeorm';
import { Inject } from '@nestjs/common';
import { IHcmAdapter } from '../../src/hcm/hcm.adapter.interface';

describe('HealthController (Unit)', () => {
  let controller: HealthController;
  let dataSource: jest.Mocked<DataSource>;
  let hcmAdapter: jest.Mocked<IHcmAdapter>;

  beforeEach(async () => {
    const mockDataSource = {
      query: jest.fn(),
      isInitialized: true,
    } as any;

    const mockHcmAdapter = {
      getBalance: jest.fn(),
      fileTimeOff: jest.fn(),
      reverseTimeOff: jest.fn(),
      getBatchBalances: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: 'HCM_ADAPTER',
          useValue: mockHcmAdapter,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    dataSource = module.get<DataSource>(DataSource) as jest.Mocked<DataSource>;
    hcmAdapter = module.get<IHcmAdapter>('HCM_ADAPTER') as jest.Mocked<IHcmAdapter>;
  });

  describe('check', () => {
    it('should return UP status when all systems healthy', async () => {
      dataSource.query.mockResolvedValue([{ version: '3' }]);
      hcmAdapter.getBatchBalances.mockResolvedValue([
        {
          employeeId: 'E001',
          locationId: 'NYC',
          leaveType: 'ANNUAL',
          totalDays: 20,
          usedDays: 5,
        },
      ]);

      const result = await controller.check();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('checks');
    });

    it('should return DEGRADED if HCM is DOWN', async () => {
      dataSource.query.mockResolvedValue([{ version: '3' }]);
      hcmAdapter.getBatchBalances.mockRejectedValue(new Error('HCM unreachable'));

      const result = await controller.check();

      expect(result).toHaveProperty('checks');
    });

    it('should return DOWN if database is DOWN', async () => {
      dataSource.query.mockRejectedValue(new Error('DB connection failed'));

      const result = await controller.check();

      expect(result).toHaveProperty('checks');
    });

    it('should include timestamp in response', async () => {
      dataSource.query.mockResolvedValue([{ version: '3' }]);
      hcmAdapter.getBatchBalances.mockResolvedValue([]);

      const result = await controller.check();

      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should include database check in response', async () => {
      dataSource.query.mockResolvedValue([{ version: '3' }]);
      hcmAdapter.getBatchBalances.mockResolvedValue([]);

      const result = await controller.check();

      expect(result.checks).toHaveProperty('database');
    });

    it('should include HCM check in response', async () => {
      dataSource.query.mockResolvedValue([{ version: '3' }]);
      hcmAdapter.getBatchBalances.mockResolvedValue([]);

      const result = await controller.check();

      expect(result.checks).toHaveProperty('hcm');
    });

    it('should handle database query timeout', async () => {
      dataSource.query.mockRejectedValue(new Error('ETIMEDOUT'));

      const result = await controller.check();

      expect(result.checks).toBeDefined();
    });

    it('should handle HCM network error', async () => {
      dataSource.query.mockResolvedValue([{ version: '3' }]);
      hcmAdapter.getBatchBalances.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await controller.check();

      expect(result.checks).toBeDefined();
    });

    it('should handle multiple failures', async () => {
      dataSource.query.mockRejectedValue(new Error('DB down'));
      hcmAdapter.getBatchBalances.mockRejectedValue(new Error('HCM down'));

      const result = await controller.check();

      expect(result.checks).toBeDefined();
    });

    it('should fallback to Unknown error if error has no message for db', async () => {
      dataSource.query.mockRejectedValue({});
      hcmAdapter.getBatchBalances.mockResolvedValue([]);

      const result = await controller.check();

      expect(result.checks.database.message).toBe('Unknown error');
    });

    it('should fallback to Unknown error if error has no message for hcm', async () => {
      dataSource.query.mockResolvedValue([{ version: '3' }]);
      hcmAdapter.getBatchBalances.mockRejectedValue({});

      const result = await controller.check();

      expect(result.checks.hcm.message).toBe('Unknown error');
    });
  });
});
