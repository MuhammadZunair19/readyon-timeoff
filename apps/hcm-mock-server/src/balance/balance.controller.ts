import { BadRequestException, Body, Controller, Delete, Get, HttpException, HttpStatus, Param, Post } from '@nestjs/common';
import { BalanceService } from './balance.service';

interface FileTimeOffRequest {
  employeeId: string;
  locationId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  daysRequested: number;
  idempotencyKey: string;
}

interface FileTimeOffResponse {
  transactionId: string;
  status: 'SUCCESS' | 'REJECTED';
  rejectionReason?: string;
}

interface BalanceResponse {
  employeeId: string;
  locationId: string;
  leaveType: string;
  totalDays: number;
  usedDays: number;
}

@Controller('hcm')
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Get('balances/:employeeId/:locationId/:leaveType')
  getBalance(
    @Param('employeeId') employeeId: string,
    @Param('locationId') locationId: string,
    @Param('leaveType') leaveType: string,
  ): BalanceResponse {
    try {
      const balance = this.balanceService.getBalance(employeeId, locationId, leaveType);
      return {
        employeeId,
        locationId,
        leaveType,
        totalDays: balance.totalDays,
        usedDays: balance.usedDays,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('Simulated HCM error')) {
        throw new HttpException('HCM Error', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      throw new HttpException('Balance not found', HttpStatus.NOT_FOUND);
    }
  }

  @Post('time-off')
  fileTimeOff(@Body() request: FileTimeOffRequest): FileTimeOffResponse {
    try {
      return this.balanceService.fileTimeOff(
        request.employeeId,
        request.locationId,
        request.leaveType,
        request.startDate,
        request.endDate,
        request.daysRequested,
        request.idempotencyKey,
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes('Simulated HCM error')) {
        throw new HttpException('HCM Error', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      throw new BadRequestException((error as Error).message);
    }
  }

  @Delete('time-off/:transactionId')
  reverseTimeOff(@Param('transactionId') transactionId: string): void {
    try {
      this.balanceService.reverseTimeOff(transactionId);
    } catch (error) {
      throw new HttpException('Transaction not found', HttpStatus.NOT_FOUND);
    }
  }

  @Get('batch/balances')
  getBatchBalances(): BalanceResponse[] {
    return this.balanceService.getAllBalances();
  }
}
