import { Controller, Get, Param } from '@nestjs/common';
import { BalanceService } from './balance.service';
import { BalanceResponseDto } from './dto/balance-response.dto';

@Controller('api/employees/:employeeId/balances')
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Get()
  async getBalances(@Param('employeeId') employeeId: string): Promise<BalanceResponseDto[]> {
    const balances = await this.balanceService.getBalancesForEmployee(employeeId);

    return balances.map((balance) => ({
      id: balance.id,
      employeeId: balance.employeeId,
      locationId: balance.locationId,
      leaveType: balance.leaveType,
      totalDays: balance.totalDays,
      usedDays: balance.usedDays,
      pendingDays: balance.pendingDays,
      availableDays: balance.availableDays,
      lastSyncedAt: balance.lastSyncedAt,
      createdAt: balance.createdAt,
      updatedAt: balance.updatedAt,
    }));
  }

  @Get(':locationId')
  async getBalanceByLocation(
    @Param('employeeId') employeeId: string,
    @Param('locationId') locationId: string,
  ): Promise<BalanceResponseDto[]> {
    const balances = await this.balanceService.getBalance(employeeId, locationId);

    const balanceArray = Array.isArray(balances) ? balances : [balances];

    return balanceArray.map((balance) => ({
      id: balance.id,
      employeeId: balance.employeeId,
      locationId: balance.locationId,
      leaveType: balance.leaveType,
      totalDays: balance.totalDays,
      usedDays: balance.usedDays,
      pendingDays: balance.pendingDays,
      availableDays: balance.availableDays,
      lastSyncedAt: balance.lastSyncedAt,
      createdAt: balance.createdAt,
      updatedAt: balance.updatedAt,
    }));
  }
}
