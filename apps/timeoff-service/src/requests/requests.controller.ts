import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { ApproveRequestDto } from './dto/approve-request.dto';
import { RejectRequestDto } from './dto/reject-request.dto';
import { TimeOffRequestEntity, TimeOffRequestStatus } from './entities/time-off-request.entity';

@Controller('api/time-off/requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  async createRequest(@Body() dto: CreateRequestDto): Promise<TimeOffRequestEntity> {
    return this.requestsService.createRequest(dto);
  }

  @Get()
  async listRequests(
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: TimeOffRequestStatus,
  ): Promise<TimeOffRequestEntity[]> {
    const filters: { employeeId?: string; status?: TimeOffRequestStatus } = {};
    if (employeeId) filters.employeeId = employeeId;
    if (status) filters.status = status;
    return this.requestsService.listRequests(filters);
  }

  @Get(':requestId')
  async getRequest(@Param('requestId') requestId: string): Promise<TimeOffRequestEntity> {
    return this.requestsService.getRequest(requestId);
  }

  @Delete(':requestId')
  async cancelRequest(
    @Param('requestId') requestId: string,
    @Headers('x-actor-id') actorId?: string,
  ): Promise<TimeOffRequestEntity> {
    if (!actorId) {
      throw new BadRequestException('X-Actor-Id header is required');
    }

    return this.requestsService.cancelRequest(requestId, actorId);
  }

  @Post(':requestId/approve')
  async approveRequest(
    @Param('requestId') requestId: string,
    @Body() dto: ApproveRequestDto,
  ): Promise<TimeOffRequestEntity> {
    return this.requestsService.approveRequest(requestId, dto.managerId);
  }

  @Post(':requestId/reject')
  async rejectRequest(
    @Param('requestId') requestId: string,
    @Body() dto: RejectRequestDto,
  ): Promise<TimeOffRequestEntity> {
    return this.requestsService.rejectRequest(requestId, dto.managerId, dto.reason);
  }
}
