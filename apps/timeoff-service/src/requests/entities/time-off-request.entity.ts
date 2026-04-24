import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum TimeOffRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  HCM_FAILED = 'HCM_FAILED',
  REQUIRES_REVIEW = 'REQUIRES_REVIEW',
}

@Entity({ name: 'time_off_request' })
export class TimeOffRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  employeeId!: string;

  @Column({ type: 'text' })
  locationId!: string;

  @Column({ type: 'text' })
  leaveType!: string;

  @Column({ type: 'text' })
  startDate!: string;

  @Column({ type: 'text' })
  endDate!: string;

  @Column({ type: 'real' })
  daysRequested!: number;

  @Column({ type: 'text' })
  status!: TimeOffRequestStatus;

  @Column({ type: 'text', nullable: true })
  managerId!: string | null;

  @Column({ type: 'text', nullable: true })
  hcmTransactionId!: string | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt!: Date;
}

