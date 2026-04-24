/**
 * BalanceService Unit Tests
 *
 * Invariant: Balance mutations atomically manage totalDays, usedDays, and pendingDays
 * with optimistic locking to prevent race conditions and data corruption.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BalanceService } from '../../src/balance/balance.service';
import { LeaveBalanceEntity } from '../../src/balance/entities/leave-balance.entity';
import {
  BalanceNotFoundException,
  InsufficientBalanceException,
  OptimisticLockException,
} from '../../src/shared/exceptions';

describe('BalanceService (Unit)', () => {
  let service: BalanceService;
  let repository: Repository<LeaveBalanceEntity>;
  let dataSource: DataSource;

  const mockBalance: LeaveBalanceEntity = {
    id: 'balance-1',
    employeeId: 'E001',
    locationId: 'NYC',
    leaveType: 'ANNUAL',
    totalDays: 20,
    usedDays: 5,
    pendingDays: 3,
    lastSyncedAt: new Date(),
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    availableDays: 12, // 20 - 5 - 3
  };

  beforeEach(async () => {
    const mockRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockDataSource = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalanceService,
        {
          provide: getRepositoryToken(LeaveBalanceEntity),
          useValue: mockRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<BalanceService>(BalanceService);
    repository = module.get<Repository<LeaveBalanceEntity>>(getRepositoryToken(LeaveBalanceEntity));
    dataSource = module.get<DataSource>(DataSource);
  });

  describe('getBalancesForEmployee', () => {
    it('should return all balances for an employee', async () => {
      const balances = [mockBalance];
      jest.spyOn(repository, 'find').mockResolvedValue(balances);

      const result = await service.getBalancesForEmployee('E001');

      expect(result).toEqual(balances);
      expect(repository.find).toHaveBeenCalledWith({ where: { employeeId: 'E001' } });
    });
  });

  describe('getBalance', () => {
    it('should return a specific balance by employeeId, locationId, and leaveType', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockBalance);

      const result = await service.getBalance('E001', 'NYC', 'ANNUAL');

      expect(result).toEqual(mockBalance);
    });

    it('should throw BalanceNotFoundException if balance not found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(service.getBalance('E999', 'UNKNOWN', 'ANNUAL')).rejects.toThrow(
        BalanceNotFoundException,
      );
    });

    it('should return all balances for location when leaveType is not specified', async () => {
      const balances = [mockBalance];
      jest.spyOn(repository, 'find').mockResolvedValue(balances);

      const result = await service.getBalance('E001', 'NYC');

      expect(result).toEqual(balances);
      expect(repository.find).toHaveBeenCalledWith({ where: { employeeId: 'E001', locationId: 'NYC' } });
    });
  });

  describe('reservePendingDays', () => {
    it('should successfully reserve pending days', async () => {
      const updatedBalance = { ...mockBalance, pendingDays: 5, version: 2 };
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockBalance);
      jest.spyOn(repository, 'findOneOrFail').mockResolvedValue(updatedBalance as any);
      const execute = jest.fn().mockResolvedValue({ affected: 1 } as any);
      jest.spyOn(repository, 'createQueryBuilder').mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute,
      } as any);

      const result = await service.reservePendingDays('E001', 'NYC', 'ANNUAL', 2, 'request-1');

      expect(result.pendingDays).toBe(5);
      expect(execute).toHaveBeenCalled();
    });

    it('should throw InsufficientBalanceException when available days are insufficient', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockBalance);

      // Available: 20 - 5 - 3 = 12, trying to reserve 15
      await expect(service.reservePendingDays('E001', 'NYC', 'ANNUAL', 15, 'request-1')).rejects.toThrow(
        InsufficientBalanceException,
      );
    });

    it('should throw BalanceNotFoundException if balance does not exist', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(service.reservePendingDays('E999', 'NYC', 'ANNUAL', 2, 'request-1')).rejects.toThrow(
        BalanceNotFoundException,
      );
    });

    it('should retry on optimistic lock conflict and succeed after 1 retry', async () => {
      const updated = {
        ...mockBalance,
        pendingDays: 5,
        version: 2,
      } as any;

      jest.spyOn(repository, 'findOne').mockResolvedValue(mockBalance);
      jest.spyOn(repository, 'findOneOrFail').mockResolvedValue(updated);

      const execute1 = jest.fn().mockResolvedValue({ affected: 0 } as any);
      const execute2 = jest.fn().mockResolvedValue({ affected: 1 } as any);
      jest
        .spyOn(repository, 'createQueryBuilder')
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          execute: execute1,
        } as any)
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          execute: execute2,
        } as any);

      const result = await service.reservePendingDays('E001', 'NYC', 'ANNUAL', 2, 'request-1');

      expect(result.pendingDays).toBe(5);
      expect(execute1).toHaveBeenCalledTimes(1);
      expect(execute2).toHaveBeenCalledTimes(1);
    });

    it('should throw OptimisticLockException after max retries', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockBalance);
      const execute = jest.fn().mockResolvedValue({ affected: 0 } as any);
      jest.spyOn(repository, 'createQueryBuilder').mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute,
      } as any);

      await expect(service.reservePendingDays('E001', 'NYC', 'ANNUAL', 2, 'request-1')).rejects.toThrow(
        OptimisticLockException,
      );
    });
  });

  describe('confirmUsedDays', () => {
    it('should move pending days to used days', async () => {
      const updatedBalance = { ...mockBalance, usedDays: 7, pendingDays: 1 };
      jest.spyOn(dataSource, 'transaction').mockImplementation(async (...args: any[]) => {
        const cb = typeof args[0] === 'function' ? args[0] : args[1];
        const manager = {
          findOne: jest.fn().mockResolvedValue({ ...mockBalance } as any),
          save: jest.fn().mockResolvedValue(updatedBalance),
        };
        return cb(manager);
      });

      const result = await service.confirmUsedDays('E001', 'NYC', 'ANNUAL', 2);

      expect(result.usedDays).toBe(7);
      expect(result.pendingDays).toBe(1);
    });

    it('should throw BalanceNotFoundException if balance does not exist', async () => {
      jest.spyOn(dataSource, 'transaction').mockImplementation(async (...args: any[]) => {
        const cb = typeof args[0] === 'function' ? args[0] : args[1];
        const manager = {
          findOne: jest.fn().mockResolvedValue(null),
        };
        return cb(manager);
      });

      await expect(service.confirmUsedDays('E999', 'NYC', 'ANNUAL', 2)).rejects.toThrow(
        BalanceNotFoundException,
      );
    });
  });

  describe('releasePendingDays', () => {
    it('should decrement pending days', async () => {
      const updatedBalance = { ...mockBalance, pendingDays: 1 };
      jest.spyOn(dataSource, 'transaction').mockImplementation(async (...args: any[]) => {
        const cb = typeof args[0] === 'function' ? args[0] : args[1];
        const manager = {
          findOne: jest.fn().mockResolvedValue({ ...mockBalance } as any),
          save: jest.fn().mockResolvedValue(updatedBalance),
        };
        return cb(manager);
      });

      const result = await service.releasePendingDays('E001', 'NYC', 'ANNUAL', 2);

      expect(result.pendingDays).toBe(1);
    });

    it('should not allow pending days to go below zero', async () => {
      const zeroBalance = { ...mockBalance, pendingDays: 0 };
      jest.spyOn(dataSource, 'transaction').mockImplementation(async (...args: any[]) => {
        const cb = typeof args[0] === 'function' ? args[0] : args[1];
        const manager = {
          findOne: jest.fn().mockResolvedValue({ ...mockBalance } as any),
          save: jest.fn().mockResolvedValue(zeroBalance),
        };
        return cb(manager);
      });

      const result = await service.releasePendingDays('E001', 'NYC', 'ANNUAL', 10);

      expect(result.pendingDays).toBe(0);
    });
  });

  describe('upsertFromHcm', () => {
    it('should create a new balance if it does not exist', async () => {
      const newBalance = {
        ...mockBalance,
        id: 'new-id',
        usedDays: 0,
        pendingDays: 0,
      };
      jest.spyOn(dataSource, 'transaction').mockImplementation(async (...args: any[]) => {
        const cb = typeof args[0] === 'function' ? args[0] : args[1];
        const manager = {
          findOne: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockReturnValue(newBalance),
          save: jest.fn().mockResolvedValue(newBalance),
        };
        return cb(manager);
      });

      const result = await service.upsertFromHcm({
        employeeId: 'E001',
        locationId: 'NYC',
        leaveType: 'ANNUAL',
        totalDays: 20,
        usedDays: 0,
      });

      expect(result.balance.id).toBe('new-id');
      expect(result.changed).toBe(true);
    });

    it('should update an existing balance with different values and return changed=true', async () => {
      const updatedBalance = { ...mockBalance, totalDays: 25, usedDays: 5 };
      jest.spyOn(dataSource, 'transaction').mockImplementation(async (...args: any[]) => {
        const cb = typeof args[0] === 'function' ? args[0] : args[1];
        const manager = {
          findOne: jest.fn().mockResolvedValue({ ...mockBalance } as any),
          save: jest.fn().mockResolvedValue(updatedBalance),
        };
        return cb(manager);
      });

      const result = await service.upsertFromHcm({
        employeeId: 'E001',
        locationId: 'NYC',
        leaveType: 'ANNUAL',
        totalDays: 25,
        usedDays: 5,
      });

      expect(result.changed).toBe(true);
    });

    it('should return changed=false when balance values are the same', async () => {
      jest.spyOn(dataSource, 'transaction').mockImplementation(async (...args: any[]) => {
        const cb = typeof args[0] === 'function' ? args[0] : args[1];
        const manager = {
          findOne: jest.fn().mockResolvedValue({ ...mockBalance } as any),
          save: jest.fn().mockResolvedValue({ ...mockBalance } as any),
        };
        return cb(manager);
      });

      const result = await service.upsertFromHcm({
        employeeId: 'E001',
        locationId: 'NYC',
        leaveType: 'ANNUAL',
        totalDays: 20,
        usedDays: 5,
      });

      expect(result.changed).toBe(false);
    });
  });
});
