import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'audit_log' })
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  entityType!: string;

  @Column({ type: 'text' })
  entityId!: string;

  @Column({ type: 'text' })
  action!: string;

  @Column({ type: 'text', nullable: true })
  actorId!: string | null;

  @Column({ type: 'simple-json', nullable: true })
  beforeState!: unknown | null;

  @Column({ type: 'simple-json', nullable: true })
  afterState!: unknown | null;

  @CreateDateColumn({ type: 'datetime' })
  timestamp!: Date;
}

