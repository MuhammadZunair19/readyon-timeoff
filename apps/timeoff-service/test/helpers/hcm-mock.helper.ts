import axios from 'axios';

export class HcmMockHelper {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
  }

  async reset(): Promise<void> {
    await axios.post(`${this.baseUrl}/hcm/simulate/reset`);
  }

  async setBalance(
    employeeId: string,
    locationId: string,
    leaveType: string,
    totalDays: number,
    usedDays: number,
  ): Promise<void> {
    await axios.post(`${this.baseUrl}/hcm/simulate/set-balance`, {
      employeeId,
      locationId,
      leaveType,
      totalDays,
      usedDays,
    });
  }

  async addAnniversaryBonus(
    employeeId: string,
    locationId: string,
    leaveType: string,
    bonusDays: number,
  ): Promise<void> {
    await axios.post(`${this.baseUrl}/hcm/simulate/anniversary`, {
      employeeId,
      locationId,
      leaveType,
      bonusDays,
    });
  }

  async simulateError(failNextRequests: number): Promise<void> {
    await axios.post(`${this.baseUrl}/hcm/simulate/error`, {
      failNextRequests,
    });
  }
}
