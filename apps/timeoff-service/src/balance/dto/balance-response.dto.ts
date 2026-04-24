import { Expose } from 'class-transformer';

export class BalanceResponseDto {
  @Expose()
  id!: string;

  @Expose()
  employeeId!: string;

  @Expose()
  locationId!: string;

  @Expose()
  leaveType!: string;

  @Expose()
  totalDays!: number;

  @Expose()
  usedDays!: number;

  @Expose()
  pendingDays!: number;

  @Expose()
  availableDays!: number;

  @Expose()
  lastSyncedAt!: Date;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;
}

