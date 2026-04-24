import { Body, Controller, Post } from '@nestjs/common';
import { BalanceService } from '../balance/balance.service';

@Controller('hcm/simulate')
export class SimulateController {
  constructor(private readonly balanceService: BalanceService) {}

  @Post('anniversary')
  addAnniversaryBonus(
    @Body()
    request: {
      employeeId: string;
      locationId: string;
      leaveType: string;
      bonusDays: number;
    },
  ): { success: boolean } {
    this.balanceService.addBonusdays(
      request.employeeId,
      request.locationId,
      request.leaveType,
      request.bonusDays,
    );
    return { success: true };
  }

  @Post('year-reset')
  yearReset(
    @Body()
    request: {
      employeeId: string;
      locationId: string;
      leaveType: string;
      newTotalDays: number;
    },
  ): { success: boolean } {
    this.balanceService.yearReset(
      request.employeeId,
      request.locationId,
      request.leaveType,
      request.newTotalDays,
    );
    return { success: true };
  }

  @Post('error')
  simulateError(
    @Body()
    request: {
      failNextRequests: number;
    },
  ): { success: boolean } {
    this.balanceService.setFailNextRequests(request.failNextRequests);
    return { success: true };
  }

  @Post('set-balance')
  setBalance(
    @Body()
    request: {
      employeeId: string;
      locationId: string;
      leaveType: string;
      totalDays: number;
      usedDays: number;
    },
  ): { success: boolean } {
    this.balanceService.setBalance(
      request.employeeId,
      request.locationId,
      request.leaveType,
      request.totalDays,
      request.usedDays,
    );
    return { success: true };
  }

  @Post('reset')
  resetState(): { success: boolean } {
    this.balanceService.resetState();
    return { success: true };
  }
}
