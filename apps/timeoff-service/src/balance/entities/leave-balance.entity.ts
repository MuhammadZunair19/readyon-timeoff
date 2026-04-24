import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn, VersionColumn } from 'typeorm';

@Entity({ name: 'leave_balance' })
@Index(['employeeId', 'locationId', 'leaveType'], { unique: true })
export class LeaveBalanceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  employeeId!: string;

  @Column({ type: 'text' })
  locationId!: string;

  @Column({ type: 'text' })
  leaveType!: string;

  @Column({ type: 'real' })
  totalDays!: number;

  @Column({ type: 'real' })
  usedDays!: number;

  @Column({ type: 'real' })
  pendingDays!: number;

  @Column({ type: 'datetime' })
  lastSyncedAt!: Date;

  @VersionColumn()
  version!: number;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt!: Date;

  get availableDays(): number {
    return this.totalDays - this.usedDays - this.pendingDays;
  }
}

