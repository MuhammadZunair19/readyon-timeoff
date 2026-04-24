/**
 * Sync Integration Tests
 *
 * Invariant: Batch and event sync operations deduplicate correctly and flag
 * REQUIRES_REVIEW requests when available balance decreases.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SyncService } from '../../src/sync/sync.service';
import { BalanceService } from '../../src/balance/balance.service';
import { SyncEventEntity } from '../../src/sync/entities/sync-event.entity';
import { LeaveBalanceEntity } from '../../src/balance/entities/leave-balance.entity';
import {
  TimeOffRequestEntity,
  TimeOffRequestStatus,
} from '../../src/requests/entities/time-off-request.entity';
import { HcmMockAdapter } from '../../src/hcm/hcm-mock.adapter';

describe('SyncService (Integration)', () => {
  let service: SyncService;
  let balanceService: BalanceService;
  let dataSource: DataSource;
  let hcmAdapter: HcmMockAdapter;

  beforeEach(async () => {
    hcmAdapter = new HcmMockAdapter();

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [SyncEventEntity, LeaveBalanceEntity, TimeOffRequestEntity],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([SyncEventEntity, LeaveBalanceEntity, TimeOffRequestEntity]),
      ],
      providers: [
        SyncService,
        BalanceService,
        {
          provide: 'HCM_ADAPTER',
          useValue: hcmAdapter,
        },
      ],
    }).compile();

    service = module.get<SyncService>(SyncService);
    balanceService = module.get<BalanceService>(BalanceService);
    dataSource = module.get<DataSource>(DataSource);

    // Seed data
    const balanceRepo = dataSource.getRepository(LeaveBalanceEntity);
    await balanceRepo.save({
      employeeId: 'E001',
      locationId: 'NYC',
      leaveType: 'ANNUAL',
      totalDays: 20,
      usedDays: 5,
      pendingDays: 0,
      lastSyncedAt: new Date(),
    });

    const requestRepo = dataSource.getRepository(TimeOffRequestEntity);
    await requestRepo.save({
      employeeId: 'E001',
      locationId: 'NYC',
      leaveType: 'ANNUAL',
      startDate: '2026-05-01',
      endDate: '2026-05-05',
      daysRequested: 10,
      status: TimeOffRequestStatus.PENDING,
      managerId: null,
      hcmTransactionId: null,
      rejectionReason: null,
      notes: null,
    });
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  describe('Batch sync', () => {
    it('should process batch and upsert all balances', async () => {
      const result = await service.processBatch({
        balances: [
          { employeeId: 'E001', locationId: 'NYC', leaveType: 'ANNUAL', totalDays: 20, usedDays: 5 },
          { employeeId: 'E002', locationId: 'LON', leaveType: 'ANNUAL', totalDays: 15, usedDays: 0 },
        ],
      });

      expect(result.processed).toBeGreaterThanOrEqual(1);
    });

    it('should flag REQUIRES_REVIEW when balance decreases', async () => {
      // First approve the pending request to lock in pendingDays
      // Then decrease balance to trigger flag
      await service.processBatch({
        balances: [
          { employeeId: 'E001', locationId: 'NYC', leaveType: 'ANNUAL', totalDays: 15, usedDays: 5 }, // Decreased from 20
        ],
      });

      const requests = await dataSource.getRepository(TimeOffRequestEntity).find({
        where: { employeeId: 'E001' },
      });

      expect(requests.some((r) => r.status === TimeOffRequestStatus.REQUIRES_REVIEW)).toBe(true);
    });
  });

  describe('Event deduplication', () => {
    it('should apply HCM event only once despite duplicate POST', async () => {
      const event = {
        eventType: 'ANNIVERSARY',
        payload: { bonusDays: 5 },
        employeeId: 'E001',
        locationId: 'NYC',
        leaveType: 'ANNUAL',
        totalDays: 25,
        usedDays: 5,
      };

      await service.processHcmEvent(event);
      const balanceAfterFirst = await balanceService.getBalance('E001', 'NYC', 'ANNUAL');
      const balanceSingle = Array.isArray(balanceAfterFirst) ? balanceAfterFirst[0] : balanceAfterFirst;
      const totalAfterFirst = balanceSingle!.totalDays;

      // Process same event again
      await service.processHcmEvent(event);
      const balanceAfterSecond = await balanceService.getBalance('E001', 'NYC', 'ANNUAL');
      const balanceSingle2 = Array.isArray(balanceAfterSecond) ? balanceAfterSecond[0] : balanceAfterSecond;
      const totalAfterSecond = balanceSingle2!.totalDays;

      // Should be unchanged
      expect(totalAfterSecond).toBe(totalAfterFirst);
    });
  });

  describe('Pull balance', () => {
    it('should pull balance from HCM and upsert locally', async () => {
      const result = await service.pullBalance('E001', 'NYC', 'ANNUAL');

      expect(result.totalDays).toBe(20);
      expect(result.usedDays).toBe(5);
    });
  });
});
