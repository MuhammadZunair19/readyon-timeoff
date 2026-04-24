import { LeaveBalanceEntity } from '../../src/balance/entities/leave-balance.entity';
import { DataSource } from 'typeorm';

export async function seedBalance(
  dataSource: DataSource,
  employeeId: string,
  locationId: string,
  leaveType: string,
  totalDays: number,
  usedDays: number = 0,
  pendingDays: number = 0,
): Promise<LeaveBalanceEntity> {
  const repo = dataSource.getRepository(LeaveBalanceEntity);
  return repo.save({
    employeeId,
    locationId,
    leaveType,
    totalDays,
    usedDays,
    pendingDays,
    lastSyncedAt: new Date(),
  });
}

export async function seedMultipleBalances(
  dataSource: DataSource,
  balances: Array<{ employeeId: string; locationId: string; leaveType: string; totalDays: number }>,
): Promise<LeaveBalanceEntity[]> {
  const repo = dataSource.getRepository(LeaveBalanceEntity);
  return Promise.all(
    balances.map((b) =>
      repo.save({
        ...b,
        usedDays: 0,
        pendingDays: 0,
        lastSyncedAt: new Date(),
      }),
    ),
  );
}
