import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BalanceService } from './balance/balance.service';
import { BalanceController } from './balance/balance.controller';
import { SimulateController } from './simulate/simulate.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
  ],
  providers: [BalanceService],
  controllers: [BalanceController, SimulateController],
})
export class HcmAppModule {}
