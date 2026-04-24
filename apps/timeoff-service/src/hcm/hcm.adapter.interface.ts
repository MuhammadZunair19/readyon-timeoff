export interface HcmBalanceDto {
  employeeId: string;
  locationId: string;
  leaveType: string;
  totalDays: number;
  usedDays: number;
}

export interface HcmFileTimeOffDto {
  employeeId: string;
  locationId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  daysRequested: number;
  idempotencyKey: string;
}

export interface HcmFileTimeOffResponseDto {
  transactionId: string;
  status: 'SUCCESS' | 'REJECTED';
  rejectionReason?: string;
}

export interface IHcmAdapter {
  getBalance(
    employeeId: string,
    locationId: string,
    leaveType: string,
  ): Promise<HcmBalanceDto>;
  fileTimeOff(request: HcmFileTimeOffDto): Promise<HcmFileTimeOffResponseDto>;
  reverseTimeOff(hcmTransactionId: string): Promise<void>;
  getBatchBalances(): Promise<HcmBalanceDto[]>;
}
