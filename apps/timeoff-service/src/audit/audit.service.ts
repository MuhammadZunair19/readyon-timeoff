import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from './entities/audit-log.entity';

export interface AuditLogInput {
  entityType: string;
  entityId: string;
  action: string;
  actorId?: string | null;
  beforeState?: unknown | null;
  afterState?: unknown | null;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditRepository: Repository<AuditLogEntity>,
  ) {}

  async log(input: AuditLogInput): Promise<AuditLogEntity> {
    const auditLog = this.auditRepository.create({
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actorId: input.actorId || null,
      beforeState: input.beforeState || null,
      afterState: input.afterState || null,
    });

    return this.auditRepository.save(auditLog);
  }

  async getAuditsByEntity(entityType: string, entityId: string): Promise<AuditLogEntity[]> {
    return this.auditRepository.find({
      where: { entityType, entityId },
      order: { timestamp: 'DESC' },
    });
  }
}
