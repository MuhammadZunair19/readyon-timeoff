/**
 * RequestsService Unit Tests
 *
 * Invariant: Request lifecycle transitions atomically update balance state and persist
 * audit logs; HCM failures trigger compensating balance adjustments (releasePendingDays).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { RequestsService } from '../../src/requests/requests.service';
import {
  TimeOffRequestEntity,
  TimeOffRequestStatus,
} from '../../src/requests/entities/time-off-request.entity';
import { BalanceService } from '../../src/balance/balance.service';
import { AuditService } from '../../src/audit/audit.service';
import {
  InvalidStateTransitionException,
  RequestNotFoundException,
} from '../../src/shared/exceptions';
import { HcmMockAdapter } from '../../src/hcm/hcm-mock.adapter';

describe('RequestsService (Unit)', () => {
  let service: RequestsService;
  let requestRepository: Repository<TimeOffRequestEntity>;
  let balanceService: BalanceService;
  let auditService: AuditService;
  let hcmAdapter: HcmMockAdapter;
  let dataSource: DataSource;

  const mockRequest: TimeOffRequestEntity = {
    id: 'request-1',
    employeeId: 'E001',
    locationId: 'NYC',
    leaveType: 'ANNUAL',
    startDate: '2026-05-01',
    endDate: '2026-05-05',
    daysRequested: 5,
    status: TimeOffRequestStatus.PENDING,
    managerId: null,
    hcmTransactionId: null,
    rejectionReason: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    hcmAdapter = new HcmMockAdapter();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestsService,
        {
          provide: getRepositoryToken(TimeOffRequestEntity),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: BalanceService,
          useValue: {
            reservePendingDays: jest.fn(),
            confirmUsedDays: jest.fn(),
            releasePendingDays: jest.fn(),
            getBalance: jest.fn(),
            upsertFromHcm: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn(),
          },
        },
        {
          provide: 'HCM_ADAPTER',
          useValue: hcmAdapter,
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RequestsService>(RequestsService);
    requestRepository = module.get<Repository<TimeOffRequestEntity>>(
      getRepositoryToken(TimeOffRequestEntity),
    );
    balanceService = module.get<BalanceService>(BalanceService);
    auditService = module.get<AuditService>(AuditService);
    dataSource = module.get<DataSource>(DataSource);
  });

  describe('getRequest', () => {
    it('should return a request by id', async () => {
      jest.spyOn(requestRepository, 'findOne').mockResolvedValue(mockRequest);

      const result = await service.getRequest('request-1');

      expect(result).toEqual(mockRequest);
    });

    it('should throw RequestNotFoundException if request not found', async () => {
      jest.spyOn(requestRepository, 'findOne').mockResolvedValue(null);

      await expect(service.getRequest('nonexistent')).rejects.toThrow(RequestNotFoundException);
    });
  });

  describe('createRequest', () => {
    it('should create a new request in PENDING status', async () => {
      const newRequest = { ...mockRequest, id: 'new-id' };
      jest.spyOn(dataSource, 'transaction').mockImplementation(async (...args: any[]) => {
        const cb = typeof args[0] === 'function' ? args[0] : args[1];
        const manager = {
          findOne: jest.fn().mockResolvedValue({
            employeeId: 'E001',
            locationId: 'NYC',
            leaveType: 'ANNUAL',
            totalDays: 20,
            usedDays: 5,
            pendingDays: 0,
          }),
          create: jest.fn().mockReturnValue(newRequest),
          save: jest.fn().mockResolvedValue(newRequest),
        };
        return cb(manager);
      });
      jest.spyOn(balanceService, 'reservePendingDays').mockResolvedValue({} as any);
      jest.spyOn(auditService, 'log').mockResolvedValue({} as any);

      const result = await service.createRequest({
        employeeId: 'E001',
        locationId: 'NYC',
        leaveType: 'ANNUAL',
        startDate: '2026-05-01',
        endDate: '2026-05-05',
        daysRequested: 5,
        notes: null,
      });

      expect(result.status).toBe(TimeOffRequestStatus.PENDING);
      expect(balanceService.reservePendingDays).toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalled();
    });
  });

  describe('rejectRequest', () => {
    it('should reject a PENDING request and release pending days', async () => {
      const rejectedRequest = { ...mockRequest, status: TimeOffRequestStatus.REJECTED, rejectionReason: 'Not approved' };
      jest.spyOn(requestRepository, 'findOne').mockResolvedValue(mockRequest);
      jest.spyOn(requestRepository, 'save').mockResolvedValue(rejectedRequest);
      jest.spyOn(balanceService, 'releasePendingDays').mockResolvedValue({} as any);
      jest.spyOn(auditService, 'log').mockResolvedValue({} as any);

      jest.spyOn(dataSource, 'transaction').mockImplementation(async (...args: any[]) => {
        const cb = typeof args[0] === 'function' ? args[0] : args[1];
        return cb({});
      });

      const result = await service.rejectRequest('request-1', 'manager-1', 'Not approved');

      expect(result.status).toBe(TimeOffRequestStatus.REJECTED);
      expect(result.rejectionReason).toBe('Not approved');
      expect(balanceService.releasePendingDays).toHaveBeenCalled();
    });

    it('should throw InvalidStateTransitionException if not PENDING', async () => {
      const approvedRequest = { ...mockRequest, status: TimeOffRequestStatus.APPROVED };
      jest.spyOn(requestRepository, 'findOne').mockResolvedValue(approvedRequest);
      jest.spyOn(dataSource, 'transaction').mockImplementation(async (...args: any[]) => {
        const cb = typeof args[0] === 'function' ? args[0] : args[1];
        return cb({});
      });

      await expect(service.rejectRequest('request-1', 'manager-1', 'Reason')).rejects.toThrow(
        InvalidStateTransitionException,
      );
    });
  });

  describe('listRequests', () => {
    it('should list requests filtered by employeeId and status', async () => {
      jest.spyOn(requestRepository, 'createQueryBuilder').mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockRequest]),
      } as any);

      const result = await service.listRequests({
        employeeId: 'E001',
        status: TimeOffRequestStatus.PENDING,
      });

      expect(result).toEqual([mockRequest]);
    });

    it('should filter requests by employeeId only', async () => {
      const req1 = { ...mockRequest, employeeId: 'E001' };
      const req2 = { ...mockRequest, employeeId: 'E002' };
      
      jest.spyOn(requestRepository, 'createQueryBuilder').mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([req1]),
      } as any);

      const result = await service.listRequests({
        employeeId: 'E001',
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.employeeId).toBe('E001');
    });

    it('should filter requests by status only', async () => {
      const approvedReq = { ...mockRequest, status: TimeOffRequestStatus.APPROVED };
      
      jest.spyOn(requestRepository, 'createQueryBuilder').mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([approvedReq]),
      } as any);

      const result = await service.listRequests({
        status: TimeOffRequestStatus.APPROVED,
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.status).toBe(TimeOffRequestStatus.APPROVED);
    });
  });

  describe('Edge Cases - Concurrent Operations', () => {
    it('should not allow double cancellation', async () => {
      const cancelledRequest = { ...mockRequest, status: TimeOffRequestStatus.CANCELLED };
      jest.spyOn(requestRepository, 'findOne').mockResolvedValue(cancelledRequest);
      jest.spyOn(dataSource, 'transaction').mockImplementation(async (...args: any[]) => {
        const cb = typeof args[0] === 'function' ? args[0] : args[1];
        return cb({});
      });

      await expect(service.cancelRequest('request-1', 'E001')).rejects.toThrow(
        InvalidStateTransitionException,
      );
    });

    it('should not allow approval of cancelled request', async () => {
      const cancelledRequest = { ...mockRequest, status: TimeOffRequestStatus.CANCELLED };
      jest.spyOn(requestRepository, 'findOne').mockResolvedValue(cancelledRequest);
      jest.spyOn(dataSource, 'transaction').mockImplementation(async (...args: any[]) => {
        const cb = typeof args[0] === 'function' ? args[0] : args[1];
        return cb({});
      });

      await expect(service.approveRequest('request-1', 'MGR-001')).rejects.toThrow(
        InvalidStateTransitionException,
      );
    });

    it('should handle HCM timeout during approval gracefully', async () => {
      jest.spyOn(requestRepository, 'findOne').mockResolvedValue(mockRequest);
      jest.spyOn(balanceService, 'getBalance').mockResolvedValue({
        id: 'balance-1',
        employeeId: 'E001',
        locationId: 'NYC',
        leaveType: 'ANNUAL',
        totalDays: 20,
        usedDays: 5,
        pendingDays: 0,
        lastSyncedAt: new Date(),
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        availableDays: 15,
      });

      hcmAdapter.fileTimeOff = jest.fn().mockRejectedValue(new Error('ETIMEDOUT'));

      jest.spyOn(dataSource, 'transaction').mockImplementation(async (...args: any[]) => {
        const cb = typeof args[0] === 'function' ? args[0] : args[1];
        return cb({
          findOne: jest.fn().mockResolvedValue(mockRequest),
          save: jest.fn(),
          update: jest.fn(),
        });
      });

      const result = await service.approveRequest('request-1', 'MGR-001');

      expect(result.status).toBe(TimeOffRequestStatus.HCM_FAILED);
    });

    it('should not approve request if HCM rejects it', async () => {
      jest.spyOn(requestRepository, 'findOne').mockResolvedValue(mockRequest);
      jest.spyOn(balanceService, 'getBalance').mockResolvedValue({
        id: 'balance-1',
        employeeId: 'E001',
        locationId: 'NYC',
        leaveType: 'ANNUAL',
        totalDays: 20,
        usedDays: 5,
        pendingDays: 0,
        lastSyncedAt: new Date(),
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        availableDays: 15,
      });

      hcmAdapter.fileTimeOff = jest
        .fn()
        .mockResolvedValue({ status: 'REJECTED', rejectionReason: 'Employee on leave' });

      jest.spyOn(dataSource, 'transaction').mockImplementation(async (...args: any[]) => {
        const cb = typeof args[0] === 'function' ? args[0] : args[1];
        return cb({
          findOne: jest.fn().mockResolvedValue(mockRequest),
          save: jest.fn(),
          update: jest.fn(),
        });
      });

      const result = await service.approveRequest('request-1', 'MGR-001');

      expect(result.status).toBe(TimeOffRequestStatus.HCM_FAILED);
    });
  });

  describe('Edge Cases - Request Cancellation', () => {
    it('should cancel approved request with HCM reversal', async () => {
      const approvedRequest = {
        ...mockRequest,
        status: TimeOffRequestStatus.APPROVED,
        hcmTransactionId: 'TXN-123',
      };

      jest.spyOn(requestRepository, 'findOne').mockResolvedValue(approvedRequest);
      jest.spyOn(requestRepository, 'save').mockResolvedValue({
        ...approvedRequest,
        status: TimeOffRequestStatus.CANCELLED,
      });

      hcmAdapter.reverseTimeOff = jest.fn().mockResolvedValue(undefined);
      jest.spyOn(balanceService, 'releasePendingDays').mockResolvedValue({} as any);
      jest.spyOn(auditService, 'log').mockResolvedValue({} as any);

      jest.spyOn(dataSource, 'transaction').mockImplementation(async (...args: any[]) => {
        const cb = typeof args[0] === 'function' ? args[0] : args[1];
        return cb({});
      });

      const result = await service.cancelRequest('request-1', 'E001');

      expect(result.status).toBe(TimeOffRequestStatus.CANCELLED);
      expect(hcmAdapter.reverseTimeOff).toHaveBeenCalledWith('TXN-123');
    });
  });
});

