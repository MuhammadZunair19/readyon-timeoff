import { Controller, Get, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { IHcmAdapter } from '../hcm/hcm.adapter.interface';

type CheckStatus = 'UP' | 'DOWN';

interface HealthChecks {
  database: { status: CheckStatus; message?: string };
  hcm: { status: CheckStatus; message?: string };
}

interface HealthResponse {
  status: 'UP' | 'DOWN' | 'DEGRADED';
  timestamp: string;
  checks: HealthChecks;
}

@Controller('api/health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    @Inject('HCM_ADAPTER')
    private readonly hcmAdapter: IHcmAdapter,
  ) {}

  @Get()
  async check(): Promise<HealthResponse> {
    const checks: HealthChecks = {
      database: { status: 'UP' },
      hcm: { status: 'UP' },
    };

    // Check database
    try {
      await this.dataSource.query('SELECT 1');
    } catch (err: any) {
      checks.database = { status: 'DOWN', message: err?.message ?? 'Unknown error' };
    }

    // Check HCM
    try {
      await this.hcmAdapter.getBatchBalances();
    } catch (err: any) {
      checks.hcm = { status: 'DOWN', message: err?.message ?? 'Unknown error' };
    }

    const allUp = checks.database.status === 'UP' && checks.hcm.status === 'UP';
    const allDown = checks.database.status === 'DOWN' && checks.hcm.status === 'DOWN';

    const status: HealthResponse['status'] = allUp ? 'UP' : allDown ? 'DOWN' : 'DEGRADED';

    return {
      status,
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}
