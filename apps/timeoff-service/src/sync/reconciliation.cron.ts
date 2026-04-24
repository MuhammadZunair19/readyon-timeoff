import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ReconciliationService } from './reconciliation.service';

@Injectable()
export class ReconciliationCronService {
  private readonly logger = new Logger(ReconciliationCronService.name);

  constructor(private readonly reconciliationService: ReconciliationService) {}

  @Cron(process.env['RECONCILE_CRON'] || '0 */6 * * *')
  async reconcile(): Promise<void> {
    const result = await this.reconciliationService.reconcileStaleBalances();
    this.logger.log(`Reconciliation complete: ${JSON.stringify(result)}`);
  }
}
