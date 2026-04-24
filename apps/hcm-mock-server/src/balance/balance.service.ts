import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

interface Balance {
  totalDays: number;
  usedDays: number;
}

interface Transaction {
  idempotencyKey: string;
  createdAt: Date;
  employeeId: string;
  locationId: string;
  leaveType: string;
  daysRequested: number;
}

@Injectable()
export class BalanceService {
  private balances: Map<string, Balance> = new Map();
  private transactions: Map<string, Transaction> = new Map();
  private failNextRequests = 0;

  constructor() {
    this.resetState();
  }

  getBalance(employeeId: string, locationId: string, leaveType: string): Balance {
    if (this.failNextRequests > 0) {
      this.failNextRequests--;
      throw new Error('Simulated HCM error');
    }

    const key = `${employeeId}/${locationId}/${leaveType}`;
    const balance = this.balances.get(key);

    if (!balance) {
      throw new Error(`Balance not found: ${key}`);
    }

    return balance;
  }

  getAllBalances(): Array<{ employeeId: string; locationId: string; leaveType: string; totalDays: number; usedDays: number }> {
    const result = [];
    for (const [key, balance] of this.balances.entries()) {
      const [employeeId, locationId, leaveType] = key.split('/');
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

  fileTimeOff(
    employeeId: string,
    locationId: string,
    leaveType: string,
    startDate: string,
    endDate: string,
    daysRequested: number,
    idempotencyKey: string,
  ): { transactionId: string; status: 'SUCCESS' | 'REJECTED'; rejectionReason?: string } {
    if (this.failNextRequests > 0) {
      this.failNextRequests--;
      throw new Error('Simulated HCM error');
    }

    const key = `${employeeId}/${locationId}/${leaveType}`;
    const balance = this.balances.get(key);

    if (!balance) {
      throw new Error(`Balance not found: ${key}`);
    }

    // Check for idempotency
    for (const [txnId, txn] of this.transactions.entries()) {
      if (txn.idempotencyKey === idempotencyKey) {
        return { transactionId: txnId, status: 'SUCCESS' };
      }
    }

    const availableDays = balance.totalDays - balance.usedDays;
    if (availableDays < daysRequested) {
      return {
        transactionId: '',
        status: 'REJECTED',
        rejectionReason: `Insufficient balance. Available: ${availableDays}, Requested: ${daysRequested}`,
      };
    }

    // Deduct used days
    balance.usedDays += daysRequested;

    // Generate transaction ID
    const transactionId = uuidv4();
    this.transactions.set(transactionId, {
      idempotencyKey,
      createdAt: new Date(),
      employeeId,
      locationId,
      leaveType,
      daysRequested,
    });

    return { transactionId, status: 'SUCCESS' };
  }

  reverseTimeOff(transactionId: string): void {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    const key = `${transaction.employeeId}/${transaction.locationId}/${transaction.leaveType}`;
    const balance = this.balances.get(key);

    if (balance) {
      balance.usedDays -= transaction.daysRequested;
    }

    this.transactions.delete(transactionId);
  }

  // Simulation methods
  addBonusdays(employeeId: string, locationId: string, leaveType: string, bonusDays: number): void {
    const key = `${employeeId}/${locationId}/${leaveType}`;
    const balance = this.balances.get(key);

    if (balance) {
      balance.totalDays += bonusDays;
    }
  }

  yearReset(employeeId: string, locationId: string, leaveType: string, newTotalDays: number): void {
    const key = `${employeeId}/${locationId}/${leaveType}`;
    const balance = this.balances.get(key);

    if (balance) {
      balance.totalDays = newTotalDays;
      balance.usedDays = 0;
    }
  }

  setFailNextRequests(count: number): void {
    this.failNextRequests = count;
  }

  setBalance(employeeId: string, locationId: string, leaveType: string, totalDays: number, usedDays: number): void {
    const key = `${employeeId}/${locationId}/${leaveType}`;
    this.balances.set(key, { totalDays, usedDays });
  }

  resetState(): void {
    this.balances.clear();
    this.transactions.clear();
    this.failNextRequests = 0;

    // Pre-seed with test data
    this.balances.set('E001/NYC/ANNUAL', { totalDays: 20, usedDays: 5 });
    this.balances.set('E001/NYC/SICK', { totalDays: 10, usedDays: 2 });
    this.balances.set('E002/LON/ANNUAL', { totalDays: 15, usedDays: 0 });
  }
}
