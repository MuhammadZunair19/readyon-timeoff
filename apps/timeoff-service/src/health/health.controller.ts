import { Controller, Get, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { IHcmAdapter } from '../hcm/hcm.adapter.interface';
import { LeaveBalanceEntity } from '../balance/entities/leave-balance.entity';

interface HealthResponse {
  status: 'ok' | 'degraded';
  db: 'healthy' | 'unhealthy';
  hcmReachable: boolean;
  lastSync?: Date | null;
}

@Controller('api/health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(LeaveBalanceEntity)
    private readonly leaveBalanceRepository: Repository<LeaveBalanceEntity>,
    @Inject('HCM_ADAPTER')
    private readonly hcmAdapter: IHcmAdapter,
  ) {}

  @Get()
  async getHealth(): Promise<HealthResponse> {
    const response: HealthResponse = {
      status: 'ok',
      db: 'healthy',
      hcmReachable: false,
    };

    // Check DB
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      response.db = 'unhealthy';
      response.status = 'degraded';
    }

    // Check HCM
    try {
      const balances = await this.hcmAdapter.getBatchBalances();
      response.hcmReachable = balances.length >= 0;
    } catch {
      response.hcmReachable = false;
      response.status = 'degraded';
    }

    // lastSync (best-effort)
    try {
      const row = await this.leaveBalanceRepository
        .createQueryBuilder('b')
        .select('MAX(b.lastSyncedAt)', 'lastSyncedAt')
        .getRawOne<{ lastSyncedAt: string | null }>();
      response.lastSync = row?.lastSyncedAt ? new Date(row.lastSyncedAt) : null;
    } catch {
      response.lastSync = null;
    }

    return response;
  }
}
