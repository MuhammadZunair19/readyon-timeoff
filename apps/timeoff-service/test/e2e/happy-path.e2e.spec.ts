/**
 * Happy Path E2E Test
 *
 * Invariant: Complete request lifecycle (pull sync -> submit -> approve -> cancel)
 * maintains balance consistency through HCM integration.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { LeaveBalanceEntity } from '../../src/balance/entities/leave-balance.entity';
import {
  TimeOffRequestEntity,
  TimeOffRequestStatus,
} from '../../src/requests/entities/time-off-request.entity';
import { AuditLogEntity } from '../../src/audit/entities/audit-log.entity';
import { SyncEventEntity } from '../../src/sync/entities/sync-event.entity';
import { HcmMockAdapter } from '../../src/hcm/hcm-mock.adapter';
import { seedBalance } from '../helpers/seed-balance.helper';

describe('Happy Path E2E', () => {
  let app: INestApplication;
  let hcmAdapter: HcmMockAdapter;

  beforeAll(async () => {
    hcmAdapter = new HcmMockAdapter();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['.env'],
          ignoreEnvFile: true,
          load: [
            () => ({
              HCM_BASE_URL: 'http://localhost:3001',
              HCM_BATCH_SECRET: 'test-secret',
              HCM_TIMEOUT_MS: 5000,
              SYNC_ON_APPROVE: true,
              RECONCILE_CRON: '0 */6 * * *',
              OPTIMISTIC_LOCK_RETRIES: 3,
              DB_PATH: ':memory:',
              PORT: 3000,
              MOCK_HCM_PORT: 3001,
            }),
          ],
        }),
        ScheduleModule.forRoot(),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [LeaveBalanceEntity, TimeOffRequestEntity, AuditLogEntity, SyncEventEntity],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([
          LeaveBalanceEntity,
          TimeOffRequestEntity,
          AuditLogEntity,
          SyncEventEntity,
        ]),
        AppModule,
      ],
      providers: [
        {
          provide: 'HCM_ADAPTER',
          useValue: hcmAdapter,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    // Seed balance
    const dataSource = moduleFixture.get('DataSource');
    await seedBalance(dataSource, 'E001', 'NYC', 'ANNUAL', 20, 5, 0);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should complete full lifecycle: create request -> approve -> cancel', async () => {
    // 1. Create request
    const createRes = await request(app.getHttpServer())
      .post('/api/time-off/requests')
      .send({
        employeeId: 'E001',
        locationId: 'NYC',
        leaveType: 'ANNUAL',
        startDate: '2026-05-01',
        endDate: '2026-05-05',
        daysRequested: 5,
        notes: 'Vacation',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.status).toBe(TimeOffRequestStatus.PENDING);
    const requestId = createRes.body.id;

    // 2. Verify balance reserved
    const balanceRes = await request(app.getHttpServer()).get('/api/employees/E001/balances/NYC');

    expect(balanceRes.status).toBe(200);
    expect(balanceRes.body[0].pendingDays).toBe(5);

    // 3. Approve request
    const approveRes = await request(app.getHttpServer())
      .post(`/api/time-off/requests/${requestId}/approve`)
      .send({ managerId: 'manager-1' });

    expect(approveRes.status).toBe(201);
    expect(approveRes.body.status).toBe(TimeOffRequestStatus.APPROVED);

    // 4. Verify balance updated
    const balanceRes2 = await request(app.getHttpServer()).get('/api/employees/E001/balances/NYC');

    expect(balanceRes2.body[0].usedDays).toBe(10); // 5 + 5
    expect(balanceRes2.body[0].pendingDays).toBe(0);

    // 5. Cancel request
    const cancelRes = await request(app.getHttpServer())
      .delete(`/api/time-off/requests/${requestId}`)
      .set('X-Actor-Id', 'E001');

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.status).toBe(TimeOffRequestStatus.CANCELLED);

    // 6. Verify balance restored via HCM reversal
    const balanceRes3 = await request(app.getHttpServer()).get('/api/employees/E001/balances/NYC');

    expect(balanceRes3.body[0].usedDays).toBe(5); // Back to original
  });
});
