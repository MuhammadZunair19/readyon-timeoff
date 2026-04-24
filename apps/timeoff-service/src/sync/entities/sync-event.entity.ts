import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum SyncEventSource {
  HCM_BATCH = 'HCM_BATCH',
  HCM_EVENT = 'HCM_EVENT',
  HCM_PULL = 'HCM_PULL',
}

export enum SyncEventStatus {
  PENDING = 'PENDING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
}

@Entity({ name: 'sync_event' })
@Index(['idempotencyKey'], { unique: true })
export class SyncEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  source!: SyncEventSource;

  @Column({ type: 'text' })
  idempotencyKey!: string;

  @Column({ type: 'simple-json' })
  payload!: unknown;

  @Column({ type: 'datetime', nullable: true })
  processedAt!: Date | null;

  @Column({ type: 'text' })
  status!: SyncEventStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;
}

