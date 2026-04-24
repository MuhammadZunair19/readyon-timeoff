import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { HcmInsufficientBalanceError, HcmInvalidDimensionError, HcmUnavailableError } from '../shared/exceptions';
import { HcmFileTimeOffDto, HcmFileTimeOffResponseDto, HcmBalanceDto, IHcmAdapter } from './hcm.adapter.interface';

@Injectable()
export class HcmAdapter implements IHcmAdapter {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.getOrThrow<string>('HCM_BASE_URL');
    this.timeoutMs = this.configService.getOrThrow<number>('HCM_TIMEOUT_MS');
  }

  async getBalance(
    employeeId: string,
    locationId: string,
    leaveType: string,
  ): Promise<HcmBalanceDto> {
    try {
      const url = `${this.baseUrl}/hcm/balances/${employeeId}/${locationId}/${leaveType}`;
      const response = await firstValueFrom(
        this.httpService.get<HcmBalanceDto>(url, {
          timeout: this.timeoutMs,
        }),
        { defaultValue: null },
      );

      if (!response) {
        throw new HcmUnavailableError('HCM unavailable: timeout');
      }

      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async fileTimeOff(request: HcmFileTimeOffDto): Promise<HcmFileTimeOffResponseDto> {
    try {
      const url = `${this.baseUrl}/hcm/time-off`;
      const response = await firstValueFrom(
        this.httpService.post<HcmFileTimeOffResponseDto>(url, request, {
          timeout: this.timeoutMs,
        }),
        { defaultValue: null },
      );

      if (!response) {
        throw new HcmUnavailableError('HCM unavailable: timeout');
      }

      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async reverseTimeOff(hcmTransactionId: string): Promise<void> {
    try {
      const url = `${this.baseUrl}/hcm/time-off/${hcmTransactionId}`;
      await firstValueFrom(
        this.httpService.delete(url, {
          timeout: this.timeoutMs,
        }),
        { defaultValue: null },
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  async getBatchBalances(): Promise<HcmBalanceDto[]> {
    try {
      const url = `${this.baseUrl}/hcm/batch/balances`;
      const response = await firstValueFrom(
        this.httpService.get<HcmBalanceDto[]>(url, {
          timeout: this.timeoutMs,
        }),
        { defaultValue: null },
      );

      if (!response) {
        throw new HcmUnavailableError('HCM unavailable: timeout');
      }

      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  private handleError(error: unknown): never {
    if (error instanceof HcmInsufficientBalanceError ||
        error instanceof HcmInvalidDimensionError ||
        error instanceof HcmUnavailableError) {
      throw error;
    }

    const axiosError = error as any;

    if (axiosError?.response?.status === 422) {
      const data = axiosError.response.data;
      if (data?.code === 'INSUFFICIENT_BALANCE') {
        throw new HcmInsufficientBalanceError(data?.message || 'Insufficient balance in HCM');
      }
      if (data?.code === 'INVALID_DIMENSION') {
        throw new HcmInvalidDimensionError(data?.message || 'Invalid dimension in HCM');
      }
    }

    if (axiosError?.response?.status >= 500 || axiosError?.code === 'ECONNABORTED') {
      throw new HcmUnavailableError(axiosError?.message || 'HCM service unavailable');
    }

    throw new HcmUnavailableError(`HCM error: ${error instanceof Error ? error.message : String(error)}`);
  }
}
