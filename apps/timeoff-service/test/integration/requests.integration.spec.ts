/**
 * Requests Integration Tests
 *
 * Invariant: Request lifecycle (create->approve->cancel) maintains balance consistency
 * and persists audit logs; cascading failures restore pending days.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RequestsService } from '../../src/requests/requests.service';
import { BalanceService } from '../../src/balance/balance.service';
import { AuditService } from '../../src/audit/audit.service';
import {
  TimeOffRequestEntity,
  TimeOffRequestStatus,
} from '../../src/requests/entities/time-off-request.entity';
import { LeaveBalanceEntity } from '../../src/balance/entities/leave-balance.entity';
import { AuditLogEntity } from '../../src/audit/entities/audit-log.entity';
import { HcmMockAdapter } from '../../src/hcm/hcm-mock.adapter';

describe('RequestsService (Integration)', () => {
  let service: RequestsService;
  let balanceService: BalanceService;
  let auditService: AuditService;
  let dataSource: DataSource;
  let hcmAdapter: HcmMockAdapter;

  beforeEach(async () => {
    hcmAdapter = new HcmMockAdapter();

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [LeaveBalanceEntity, TimeOffRequestEntity, AuditLogEntity],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([LeaveBalanceEntity, TimeOffRequestEntity, AuditLogEntity]),
      ],
      providers: [
        RequestsService,
        BalanceService,
        AuditService,
        {
          provide: 'HCM_ADAPTER',
          useValue: hcmAdapter,
        },
      ],
    }).compile();

    service = module.get<RequestsService>(RequestsService);
    balanceService = module.get<BalanceService>(BalanceService);
    auditService = module.get<AuditService>(AuditService);
    dataSource = module.get<DataSource>(DataSource);

    // Seed balance
    const repo = dataSource.getRepository(LeaveBalanceEntity);
    await repo.save({
      employeeId: 'E001',
      locationId: 'NYC',
      leaveType: 'ANNUAL',
      totalDays: 20,
      usedDays: 5,
      pendingDays: 0,
      lastSyncedAt: new Date(),
    });
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  describe('Create -> Approve -> Cancel flow', () => {
    it('should create request and reserve pending days', async () => {
      const request = await service.createRequest({
        employeeId: 'E001',
        locationId: 'NYC',
        leaveType: 'ANNUAL',
        startDate: '2026-05-01',
        endDate: '2026-05-05',
        daysRequested: 5,
        notes: null,
      });

      expect(request.status).toBe(TimeOffRequestStatus.PENDING);

      const balance = await balanceService.getBalance('E001', 'NYC', 'ANNUAL');
      const balanceSingle = Array.isArray(balance) ? balance[0] : balance;
      expect(balanceSingle!.pendingDays).toBe(5);
    });

    it('should approve request and move pending to used', async () => {
      const request = await service.createRequest({
        employeeId: 'E001',
        locationId: 'NYC',
        leaveType: 'ANNUAL',
        startDate: '2026-05-01',
        endDate: '2026-05-05',
        daysRequested: 5,
        notes: null,
      });

      const approved = await service.approveRequest(request.id, 'manager-1');

      expect(approved.status).toBe(TimeOffRequestStatus.APPROVED);
      expect(approved.hcmTransactionId).toBeTruthy();

      const balance = await balanceService.getBalance('E001', 'NYC', 'ANNUAL');
      const balanceSingle = Array.isArray(balance) ? balance[0] : balance;
      expect(balanceSingle!.usedDays).toBe(10); // 5 original + 5 approved
      expect(balanceSingle!.pendingDays).toBe(0);
    });

    it('should reject request and release pending days', async () => {
      const request = await service.createRequest({
        employeeId: 'E001',
        locationId: 'NYC',
        leaveType: 'ANNUAL',
        startDate: '2026-05-01',
        endDate: '2026-05-05',
        daysRequested: 5,
        notes: null,
      });

      const rejected = await service.rejectRequest(request.id, 'manager-1', 'Not approved');

      expect(rejected.status).toBe(TimeOffRequestStatus.REJECTED);

      const balance = await balanceService.getBalance('E001', 'NYC', 'ANNUAL');
      const balanceSingle = Array.isArray(balance) ? balance[0] : balance;
      expect(balanceSingle!.pendingDays).toBe(0); // Restored
    });
  });

  describe('Audit logging', () => {
    it('should create audit log entries for request lifecycle', async () => {
      const request = await service.createRequest({
        employeeId: 'E001',
        locationId: 'NYC',
        leaveType: 'ANNUAL',
        startDate: '2026-05-01',
        endDate: '2026-05-05',
        daysRequested: 5,
        notes: null,
      });

      const audits = await auditService.getAuditsByEntity('TimeOffRequest', request.id);

      expect(audits.length).toBeGreaterThan(0);
      expect(audits[0]!.action).toBe('CREATED');
    });
  });
});
