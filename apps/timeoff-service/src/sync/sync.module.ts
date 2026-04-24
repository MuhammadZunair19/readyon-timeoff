import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncEventEntity } from './entities/sync-event.entity';
import { LeaveBalanceEntity } from '../balance/entities/leave-balance.entity';
import { TimeOffRequestEntity } from '../requests/entities/time-off-request.entity';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { ReconciliationCronService } from './reconciliation.cron';
import { ReconciliationService } from './reconciliation.service';
import { BalanceModule } from '../balance/balance.module';
import { HcmModule } from '../hcm/hcm.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SyncEventEntity, LeaveBalanceEntity, TimeOffRequestEntity]),
    BalanceModule,
    HcmModule,
  ],
  providers: [SyncService, ReconciliationService, ReconciliationCronService],
  controllers: [SyncController],
  exports: [SyncService],
})
export class SyncModule {}
