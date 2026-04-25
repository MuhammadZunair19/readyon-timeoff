/**
 * RequestsService Unit Tests
 *
 * Invariant: Request lifecycle transitions atomically update balance state and persist
 * audit logs; HCM failures trigger compensating balance adjustments.
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
            decrementUsedDays: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: { log: jest.fn() },
        },
        {
          provide: 'HCM_ADAPTER',
          useValue: hcmAdapter,
        },
        {
          provide: DataSource,
          useValue: { transaction: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(RequestsService);
    requestRepository = module.get(getRepositoryToken(TimeOffRequestEntity));
    balanceService = module.get(BalanceService);
    auditService = module.get(AuditService);
    dataSource = module.get(DataSource);
  });

  // ===== Basic =====
  describe('getRequest', () => {
    it('returns request', async () => {
      jest.spyOn(requestRepository, 'findOne').mockResolvedValue(mockRequest);
      expect(await service.getRequest('id')).toEqual(mockRequest);
    });

    it('throws if not found', async () => {
      jest.spyOn(requestRepository, 'findOne').mockResolvedValue(null);
      await expect(service.getRequest('x')).rejects.toThrow(RequestNotFoundException);
    });
  });

  // ===== Create =====
  describe('createRequest', () => {
    it('creates pending request', async () => {
      jest.spyOn(dataSource, 'transaction').mockImplementation(async (cb: any) =>
        cb({
          findOne: jest.fn().mockResolvedValue({
            totalDays: 20,
            usedDays: 5,
            pendingDays: 0,
          }),
          create: jest.fn().mockReturnValue(mockRequest),
          save: jest.fn().mockResolvedValue(mockRequest),
        }),
      );

      await service.createRequest(mockRequest as any);

      expect(balanceService.reservePendingDays).toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalled();
    });
  });

  // ===== Reject =====
  describe('rejectRequest', () => {
    it('rejects pending request', async () => {
      jest.spyOn(dataSource, 'transaction').mockImplementation(async (cb: any) =>
        cb({
          findOne: jest.fn().mockResolvedValue(mockRequest),
          save: jest.fn().mockResolvedValue({
            ...mockRequest,
            status: TimeOffRequestStatus.REJECTED,
          }),
        }),
      );

      const res = await service.rejectRequest('id', 'mgr', 'reason');

      expect(res.status).toBe(TimeOffRequestStatus.REJECTED);
      expect(balanceService.releasePendingDays).toHaveBeenCalled();
    });
  });

  // ===== List =====
  describe('listRequests', () => {
    it('filters correctly', async () => {
      jest.spyOn(requestRepository, 'createQueryBuilder').mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockRequest]),
      } as any);

      const res = await service.listRequests({ employeeId: 'E001' });
      expect(res).toHaveLength(1);
    });
  });

  // ===== Approval Edge =====
  describe('Approval Edge Cases', () => {
    it('handles HCM timeout → HCM_FAILED', async () => {
      const req = { ...mockRequest };

      jest.spyOn(dataSource, 'transaction').mockImplementation(async (cb: any) =>
        cb({
          findOne: jest.fn().mockResolvedValue(req),
          save: jest.fn().mockResolvedValue({
            ...req,
            status: TimeOffRequestStatus.HCM_FAILED,
          }),
        }),
      );

      hcmAdapter.fileTimeOff = jest.fn().mockRejectedValue(new Error('timeout'));

      const res = await service.approveRequest('id', 'mgr');
      expect(res.status).toBe(TimeOffRequestStatus.HCM_FAILED);
    });
  });

  // ===== Cancel =====
  describe('Cancel Request', () => {
    it('cancels approved request', async () => {
      jest.spyOn(requestRepository, 'findOne').mockResolvedValue({
        ...mockRequest,
        status: TimeOffRequestStatus.APPROVED,
        hcmTransactionId: 'TXN',
      });

      hcmAdapter.reverseTimeOff = jest.fn();

      const res = await service.cancelRequest('id', 'E1');
      expect(res.status).toBe(TimeOffRequestStatus.CANCELLED);
    });
  });

  // ===== Missing Coverage =====
  describe('Missing Coverage Scenarios', () => {
    it('throws if balance missing', async () => {
      jest.spyOn(dataSource, 'transaction').mockImplementation(async (cb: any) =>
        cb({ findOne: jest.fn().mockResolvedValue(null) }),
      );

      await expect(service.createRequest(mockRequest as any)).rejects.toThrow();
    });

    it('rethrows unknown HCM error', async () => {
      jest.spyOn(dataSource, 'transaction').mockImplementation(async (cb: any) =>
        cb({
          findOne: jest.fn().mockResolvedValue(mockRequest),
        }),
      );

      hcmAdapter.fileTimeOff = jest.fn().mockRejectedValue(new Error('Unknown'));

      await expect(service.approveRequest('id', 'mgr')).rejects.toThrow('Unknown');
    });

    it('cancel fails if reverse fails', async () => {
      jest.spyOn(requestRepository, 'findOne').mockResolvedValue({
        ...mockRequest,
        status: TimeOffRequestStatus.APPROVED,
        hcmTransactionId: 'T1',
      });

      hcmAdapter.reverseTimeOff = jest.fn().mockRejectedValue(new Error('fail'));

      await expect(service.cancelRequest('id', 'E1')).rejects.toThrow('fail');
    });
  });

});