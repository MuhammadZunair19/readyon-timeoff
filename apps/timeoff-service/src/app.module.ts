import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import Joi from 'joi';
import { DataSource } from 'typeorm';
import { AuditModule } from './audit/audit.module';
import { BalanceModule } from './balance/balance.module';
import { RequestsModule } from './requests/requests.module';
import { SyncModule } from './sync/sync.module';
import { HealthModule } from './health/health.module';
import { HcmModule } from './hcm/hcm.module';

@Module({
  imports: [
    ...(process.env['NODE_ENV'] === 'test'
      ? []
      : [
          ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ['.env'],
            validationSchema: Joi.object({
              HCM_BASE_URL: Joi.string().uri().default('http://localhost:3001'),
              HCM_BATCH_SECRET: Joi.string().min(1).default('supersecretkey'),
              HCM_TIMEOUT_MS: Joi.number().integer().min(1).default(5000),
              SYNC_ON_APPROVE: Joi.boolean().default(true),
              RECONCILE_CRON: Joi.string().min(1).default('0 */6 * * *'),
              OPTIMISTIC_LOCK_RETRIES: Joi.number().integer().min(0).default(10),
              DB_PATH: Joi.string().min(1).default('./data/timeoff.sqlite'),
              PORT: Joi.number().integer().min(1).default(3000),
              MOCK_HCM_PORT: Joi.number().integer().min(1).default(3001),
            }),
          }),
        ]),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'better-sqlite3',
        database: process.env['DB_PATH'] ?? './data/timeoff.sqlite',
        synchronize: true,
        autoLoadEntities: true,
      }),
    }),
    HcmModule,
    AuditModule,
    BalanceModule,
    RequestsModule,
    SyncModule,
    HealthModule,
  ],
  providers: [
    // Convenience alias for tests that call module.get('DataSource')
    { provide: 'DataSource', useExisting: DataSource },
  ],
})
export class AppModule {}

