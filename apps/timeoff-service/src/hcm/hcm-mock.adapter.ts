import { Injectable } from '@nestjs/common';
import { HcmInsufficientBalanceError } from '../shared/exceptions';
import { HcmFileTimeOffDto, HcmFileTimeOffResponseDto, HcmBalanceDto, IHcmAdapter } from './hcm.adapter.interface';

interface MockBalance {
  totalDays: number;
  usedDays: number;
}

interface MockTransaction {
  created: Date;
  request: HcmFileTimeOffDto;
}

@Injectable()
export class HcmMockAdapter implements IHcmAdapter {
  private balances: Map<string, MockBalance> = new Map();
  private transactions: Map<string, MockTransaction> = new Map();
  private transactionCounter = 0;

  constructor() {
    this.resetState();
  }

  async getBalance(
    employeeId: string,
    locationId: string,
    leaveType: string,
  ): Promise<HcmBalanceDto> {
    const key = `${employeeId}/${locationId}/${leaveType}`;
    const balance = this.balances.get(key);

    if (!balance) {
      throw new Error(`Balance not found: ${key}`);
    }

    return {
      employeeId,
      locationId,
      leaveType,
      totalDays: balance.totalDays,
      usedDays: balance.usedDays,
    };
  }

  async fileTimeOff(request: HcmFileTimeOffDto): Promise<HcmFileTimeOffResponseDto> {
    const key = `${request.employeeId}/${request.locationId}/${request.leaveType}`;
    const balance = this.balances.get(key);

    if (!balance) {
      throw new Error(`Balance not found: ${key}`);
    }

    // Check for idempotency - return existing transaction if already processed
    const existingTx = Array.from(this.transactions.values()).find(
      (tx) => tx.request.idempotencyKey === request.idempotencyKey,
    );
    if (existingTx) {
      return {
        transactionId: Array.from(this.transactions.entries()).find(
          (entry) => entry[1] === existingTx,
        )![0],
        status: 'SUCCESS',
      };
    }

    const availableDays = balance.totalDays - balance.usedDays;
    if (availableDays < request.daysRequested) {
      throw new HcmInsufficientBalanceError(
        `Insufficient balance. Available: ${availableDays}, Requested: ${request.daysRequested}`,
      );
    }

    // Deduct used days
    balance.usedDays += request.daysRequested;

    // Generate transaction ID
    const transactionId = `TXN-${++this.transactionCounter}`;
    this.transactions.set(transactionId, {
      created: new Date(),
      request,
    });

    return {
      transactionId,
      status: 'SUCCESS',
    };
  }

  async reverseTimeOff(hcmTransactionId: string): Promise<void> {
    const transaction = this.transactions.get(hcmTransactionId);
    if (!transaction) {
      throw new Error(`Transaction not found: ${hcmTransactionId}`);
    }

    const { request } = transaction;
    const key = `${request.employeeId}/${request.locationId}/${request.leaveType}`;
    const balance = this.balances.get(key);

    if (balance) {
      balance.usedDays -= request.daysRequested;
    }

    this.transactions.delete(hcmTransactionId);
  }

  async getBatchBalances(): Promise<HcmBalanceDto[]> {
    const result: HcmBalanceDto[] = [];
    for (const [key, balance] of this.balances.entries()) {
      const [employeeId, locationId, leaveType] = key.split('/');
      if (!employeeId || !locationId || !leaveType) {
        // This should never happen; keys are always formatted as employee/location/type
        continue;
      }
      result.push({
        employeeId,
        locationId,
        leaveType,
        totalDays: balance.totalDays,
        usedDays: balance.usedDays,
      });
    }
    return result;
  }

  // Test helper methods
  resetState(): void {
    this.balances.clear();
    this.transactions.clear();
    this.transactionCounter = 0;

    // Pre-seed with test data
    this.balances.set('E001/NYC/ANNUAL', { totalDays: 20, usedDays: 5 });
    this.balances.set('E001/NYC/SICK', { totalDays: 10, usedDays: 2 });
    this.balances.set('E002/LON/ANNUAL', { totalDays: 15, usedDays: 0 });
  }

  setBalance(employeeId: string, locationId: string, leaveType: string, totalDays: number, usedDays: number): void {
    const key = `${employeeId}/${locationId}/${leaveType}`;
    this.balances.set(key, { totalDays, usedDays });
  }

  getInternalBalance(employeeId: string, locationId: string, leaveType: string): MockBalance | undefined {
    const key = `${employeeId}/${locationId}/${leaveType}`;
    return this.balances.get(key);
  }
}
