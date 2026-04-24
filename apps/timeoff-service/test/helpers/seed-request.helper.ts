import { TimeOffRequestEntity, TimeOffRequestStatus } from '../../src/requests/entities/time-off-request.entity';
import { DataSource } from 'typeorm';

export async function seedRequest(
  dataSource: DataSource,
  employeeId: string,
  locationId: string,
  leaveType: string,
  startDate: string,
  endDate: string,
  daysRequested: number,
  status: TimeOffRequestStatus = TimeOffRequestStatus.PENDING,
): Promise<TimeOffRequestEntity> {
  const repo = dataSource.getRepository(TimeOffRequestEntity);
  return repo.save({
    employeeId,
    locationId,
    leaveType,
    startDate,
    endDate,
    daysRequested,
    status,
    managerId: null,
    hcmTransactionId: null,
    rejectionReason: null,
    notes: null,
  });
}

export async function seedMultipleRequests(
  dataSource: DataSource,
  requests: Array<{
    employeeId: string;
    locationId: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    daysRequested: number;
  }>,
): Promise<TimeOffRequestEntity[]> {
  const repo = dataSource.getRepository(TimeOffRequestEntity);
  return Promise.all(
    requests.map((r) =>
      repo.save({
        ...r,
        status: TimeOffRequestStatus.PENDING,
        managerId: null,
        hcmTransactionId: null,
        rejectionReason: null,
        notes: null,
      }),
    ),
  );
}
