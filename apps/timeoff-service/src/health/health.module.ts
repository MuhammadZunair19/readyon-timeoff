import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HcmModule } from '../hcm/hcm.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveBalanceEntity } from '../balance/entities/leave-balance.entity';

@Module({
  imports: [HcmModule, TypeOrmModule.forFeature([LeaveBalanceEntity])],
  controllers: [HealthController],
})
export class HealthModule {}
