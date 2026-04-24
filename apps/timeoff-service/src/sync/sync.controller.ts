import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { SyncService } from './sync.service';
import { HcmBatchDto } from './dto/hcm-batch.dto';
import { HcmEventDto } from './dto/hcm-event.dto';
import { LeaveBalanceEntity } from '../balance/entities/leave-balance.entity';

@Controller('api/sync')
export class SyncController {
  constructor(
    private readonly syncService: SyncService,
    private readonly configService: ConfigService,
  ) {}

  @Post('hcm/batch')
  async processBatch(
    @Body() batch: HcmBatchDto,
    @Headers('x-hcm-signature') signature?: string,
  ): Promise<{ processed: number; flagged: number }> {
    this.validateHmacSignature(batch, signature);
    return this.syncService.processBatch(batch);
  }

  @Post('hcm/event')
  async processEvent(
    @Body() event: HcmEventDto,
    @Headers('x-hcm-signature') signature?: string,
  ): Promise<void> {
    this.validateHmacSignature(event, signature);
    await this.syncService.processHcmEvent(event);
  }

  @Post('pull/:employeeId/:locationId/:leaveType')
  async pullBalance(
    @Param('employeeId') employeeId: string,
    @Param('locationId') locationId: string,
    @Param('leaveType') leaveType: string,
  ): Promise<LeaveBalanceEntity> {
    return this.syncService.pullBalance(employeeId, locationId, leaveType);
  }

  private validateHmacSignature(payload: unknown, signature?: string): void {
    if (!signature) {
      throw new UnauthorizedException('X-HCM-Signature header is required');
    }

    const secret = this.configService.getOrThrow<string>('HCM_BATCH_SECRET');
    const payloadStr = JSON.stringify(payload);
    const expectedSignature = createHmac('sha256', secret)
      .update(payloadStr)
      .digest('hex');

    if (signature !== expectedSignature) {
      throw new UnauthorizedException('Invalid X-HCM-Signature');
    }
  }
}
