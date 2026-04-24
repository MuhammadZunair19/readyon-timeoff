import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeOffRequestEntity } from './entities/time-off-request.entity';
import { RequestsService } from './requests.service';
import { RequestsController } from './requests.controller';
import { BalanceModule } from '../balance/balance.module';
import { AuditModule } from '../audit/audit.module';
import { HcmModule } from '../hcm/hcm.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TimeOffRequestEntity]),
    BalanceModule,
    AuditModule,
    HcmModule,
  ],
  providers: [RequestsService],
  controllers: [RequestsController],
  exports: [RequestsService],
})
export class RequestsModule {}
