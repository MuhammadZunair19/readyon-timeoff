import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import {
  HcmInsufficientBalanceError,
  HcmInvalidDimensionError,
  HcmUnavailableError,
} from '../shared/exceptions';

import {
  HcmFileTimeOffDto,
  HcmFileTimeOffResponseDto,
  HcmBalanceDto,
  IHcmAdapter,
} from './hcm.adapter.interface';

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

  // =========================
  // GET BALANCE
  // =========================
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

      // ✅ FIX: handle null OR missing data
      if (!response || response.data == null) {
        throw new HcmUnavailableError('Invalid response from HCM');
      }

      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  // =========================
  // FILE TIME OFF
  // =========================
  async fileTimeOff(
    request: HcmFileTimeOffDto,
  ): Promise<HcmFileTimeOffResponseDto> {
    try {
      const url = `${this.baseUrl}/hcm/time-off`;

      const response = await firstValueFrom(
        this.httpService.post<HcmFileTimeOffResponseDto>(url, request, {
          timeout: this.timeoutMs,
        }),
        { defaultValue: null },
      );

      // ✅ FIX: handle null OR missing data
      if (!response || response.data == null) {
        throw new HcmUnavailableError('Invalid response from HCM');
      }

      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  // =========================
  // REVERSE TIME OFF
  // =========================
  async reverseTimeOff(hcmTransactionId: string): Promise<void> {
    try {
      const url = `${this.baseUrl}/hcm/time-off/${hcmTransactionId}`;

      const response = await firstValueFrom(
        this.httpService.delete(url, {
          timeout: this.timeoutMs,
        }),
        { defaultValue: null },
      );

      // Optional: validate response existence
      if (response == null) {
        throw new HcmUnavailableError('Invalid response from HCM');
      }

      return;
    } catch (error) {
      this.handleError(error);
    }
  }

  // =========================
  // BATCH BALANCES
  // =========================
  async getBatchBalances(): Promise<HcmBalanceDto[]> {
    try {
      const url = `${this.baseUrl}/hcm/batch/balances`;

      const response = await firstValueFrom(
        this.httpService.get<HcmBalanceDto[]>(url, {
          timeout: this.timeoutMs,
        }),
        { defaultValue: null },
      );

      // ✅ FIX: handle null OR missing data
      if (!response || response.data == null) {
        throw new HcmUnavailableError('Invalid batch response from HCM');
      }

      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  // =========================
  // ERROR HANDLER
  // =========================
  private handleError(error: unknown): never {
    // ✅ Already mapped errors → rethrow
    if (
      error instanceof HcmInsufficientBalanceError ||
      error instanceof HcmInvalidDimensionError ||
      error instanceof HcmUnavailableError
    ) {
      throw error;
    }

    const axiosError = error as any;

    // ✅ Handle Axios 422
    if (axiosError?.response?.status === 422) {
      const data = axiosError.response.data;

      if (data?.code === 'INSUFFICIENT_BALANCE') {
        throw new HcmInsufficientBalanceError(
          data?.message || 'Insufficient balance in HCM',
        );
      }

      if (data?.code === 'INVALID_DIMENSION') {
        throw new HcmInvalidDimensionError(
          data?.message || 'Invalid dimension in HCM',
        );
      }
    }

    // ✅ Handle server errors & timeouts
    if (
      axiosError?.response?.status >= 500 ||
      axiosError?.code === 'ECONNABORTED' ||
      axiosError?.message?.includes('ECONN') ||
      axiosError?.message?.includes('ETIMEDOUT')
    ) {
      throw new HcmUnavailableError(
        axiosError?.message || 'HCM service unavailable',
      );
    }

    // ✅ Handle string errors (your test case)
    if (typeof error === 'string') {
      throw new Error(error);
    }

    // ✅ Fallback
    throw new HcmUnavailableError(
      `HCM error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}