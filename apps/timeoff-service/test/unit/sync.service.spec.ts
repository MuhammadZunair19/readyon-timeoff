/**
 * SyncService Unit Tests
 *
 * Invariant: Sync operations deduplicate based on SHA256 idempotencyKey and atomically
 * flag REQUIRES_REVIEW requests when balance decreases below pending request thresholds.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { SyncService } from '../../src/sync/sync.service';
import {
  SyncEventEntity,
  SyncEventStatus,
  SyncEventSource,
} from '../../src/sync/entities/sync-event.entity';
import { LeaveBalanceEntity } from '../../src/balance/entities/leave-balance.entity';
import {
  TimeOffRequestEntity,
  TimeOffRequestStatus,
} from '../../src/requests/entities/time-off-request.entity';
import { BalanceService } from '../../src/balance/balance.service';
import { HcmMockAdapter } from '../../src/hcm/hcm-mock.adapter';

describe('SyncService (Unit)', () => {
  let service: SyncService;
  let syncEventRepository: Repository<SyncEventEntity>;
  let balanceRepository: Repository<LeaveBalanceEntity>;
  let requestRepository: Repository<TimeOffRequestEntity>;
  let balanceService: BalanceService;
  let hcmAdapter: HcmMockAdapter;

  beforeEach(async () => {
    hcmAdapter = new HcmMockAdapter();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        {
          provide: getRepositoryToken(SyncEventEntity),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn((v) => v),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(LeaveBalanceEntity),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(TimeOffRequestEntity),
          useValue: {
            find: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: BalanceService,
          useValue: {
            upsertFromHcm: jest.fn(),
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

    service = module.get<SyncService>(SyncService);
    syncEventRepository = module.get<Repository<SyncEventEntity>>(getRepositoryToken(SyncEventEntity));
    balanceRepository = module.get<Repository<LeaveBalanceEntity>>(getRepositoryToken(LeaveBalanceEntity));
    requestRepository = module.get<Repository<TimeOffRequestEntity>>(getRepositoryToken(TimeOffRequestEntity));
    balanceService = module.get<BalanceService>(BalanceService);
  });

  describe('processHcmEvent', () => {
    it('should skip processing if event is already processed (idempotency)', async () => {
      const existingEvent = {
        id: 'sync-1',
        idempotencyKey: 'key-1',
        status: SyncEventStatus.PROCESSED,
      };
      jest.spyOn(syncEventRepository, 'findOne').mockResolvedValue(existingEvent as any);

      await service.processHcmEvent({
        eventType: 'ANNIVERSARY',
        payload: {},
        employeeId: 'E001',
        locationId: 'NYC',
        leaveType: 'ANNUAL',
        totalDays: 25,
        usedDays: 5,
      });

      // Should return early without creating a new sync event
      expect(syncEventRepository.save).not.toHaveBeenCalled();
    });

    it('should process new HCM event and flag REQUIRES_REVIEW requests', async () => {
      jest.spyOn(syncEventRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(syncEventRepository, 'save').mockResolvedValue({} as any);
      jest
        .spyOn(balanceService, 'upsertFromHcm')
        .mockResolvedValue({ balance: {} as any, changed: true });
      jest.spyOn(balanceRepository, 'findOne').mockResolvedValue({ availableDays: 5 } as any);
      jest.spyOn(requestRepository, 'find').mockResolvedValue([
        {
          id: 'req-1',
          daysRequested: 10,
          status: TimeOffRequestStatus.PENDING,
        } as any,
      ]);
      jest.spyOn(requestRepository, 'save').mockResolvedValue({} as any);

      await service.processHcmEvent({
        eventType: 'YEAR_RESET',
        payload: {},
        employeeId: 'E001',
        locationId: 'NYC',
        leaveType: 'ANNUAL',
        totalDays: 15,
        usedDays: 0,
      });

      expect(balanceService.upsertFromHcm).toHaveBeenCalled();
      expect(requestRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: TimeOffRequestStatus.REQUIRES_REVIEW }),
      );
    });
  });

  describe('pullBalance', () => {
    it('should pull balance from HCM and upsert', async () => {
      jest.spyOn(balanceService, 'upsertFromHcm').mockResolvedValue({
        balance: { id: 'balance-1' } as any,
        changed: true,
      });

      const result = await service.pullBalance('E001', 'NYC', 'ANNUAL');

      expect(result.id).toBe('balance-1');
      expect(balanceService.upsertFromHcm).toHaveBeenCalled();
    });
  });
});
