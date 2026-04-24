/**
 * HMAC Validation E2E Test
 *
 * Invariant: /api/sync/* endpoints validate HMAC-SHA256 signature and reject invalid requests.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { LeaveBalanceEntity } from '../../src/balance/entities/leave-balance.entity';
import { TimeOffRequestEntity } from '../../src/requests/entities/time-off-request.entity';
import { AuditLogEntity } from '../../src/audit/entities/audit-log.entity';
import { SyncEventEntity } from '../../src/sync/entities/sync-event.entity';
import { generateHmacSignature } from '../helpers/hmac.helper';

describe('HMAC Validation E2E', () => {
  let app: INestApplication;
  const secret = 'test-secret';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['.env'],
          ignoreEnvFile: true,
          load: [
            () => ({
              HCM_BASE_URL: 'http://localhost:3001',
              HCM_BATCH_SECRET: secret,
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
  });

  afterAll(async () => {
    await app.close();
  });

  it('should reject batch sync without signature', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/sync/hcm/batch')
      .send({ balances: [] });

    expect(res.status).toBe(401);
  });

  it('should reject batch sync with invalid signature', async () => {
    const batch = { balances: [] };
    const res = await request(app.getHttpServer())
      .post('/api/sync/hcm/batch')
      .set('X-HCM-Signature', 'invalid-signature')
      .send(batch);

    expect(res.status).toBe(401);
  });

  it('should accept batch sync with valid signature', async () => {
    const batch = { balances: [] };
    const signature = generateHmacSignature(batch, secret);

    const res = await request(app.getHttpServer())
      .post('/api/sync/hcm/batch')
      .set('X-HCM-Signature', signature)
      .send(batch);

    expect(res.status).toBe(201);
  });
});
