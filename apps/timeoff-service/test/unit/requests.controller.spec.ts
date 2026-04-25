import { Test, TestingModule } from '@nestjs/testing';
import { RequestsController } from '../../src/requests/requests.controller';
import { RequestsService } from '../../src/requests/requests.service';
import { TimeOffRequestStatus } from '../../src/requests/entities/time-off-request.entity';
import { BadRequestException } from '@nestjs/common';

describe('RequestsController (Unit)', () => {
  let controller: RequestsController;
  let service: jest.Mocked<RequestsService>;

  beforeEach(async () => {
    const mockService = {
      createRequest: jest.fn(),
      listRequests: jest.fn(),
      getRequest: jest.fn(),
      cancelRequest: jest.fn(),
      approveRequest: jest.fn(),
      rejectRequest: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RequestsController],
      providers: [
        {
          provide: RequestsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<RequestsController>(RequestsController);
    service = module.get(RequestsService);
  });

  describe('createRequest', () => {
    it('should call service with dto', async () => {
      const dto = { employeeId: 'E1', locationId: 'L1', leaveType: 'ANNUAL', startDate: '2026-05-01', endDate: '2026-05-05', daysRequested: 5 };
      service.createRequest.mockResolvedValue({ id: 'R1', ...dto } as any);
      
      const result = await controller.createRequest(dto);
      
      expect(service.createRequest).toHaveBeenCalledWith(dto);
      expect(result.id).toBe('R1');
    });
  });

  describe('listRequests', () => {
    it('should call service with empty filters when no query params provided', async () => {
      service.listRequests.mockResolvedValue([]);
      
      const result = await controller.listRequests();
      
      expect(service.listRequests).toHaveBeenCalledWith({});
      expect(result).toEqual([]);
    });

    it('should call service with employeeId filter', async () => {
      service.listRequests.mockResolvedValue([]);
      
      await controller.listRequests('E1');
      
      expect(service.listRequests).toHaveBeenCalledWith({ employeeId: 'E1' });
    });

    it('should call service with status filter', async () => {
      service.listRequests.mockResolvedValue([]);
      
      await controller.listRequests(undefined, TimeOffRequestStatus.PENDING);
      
      expect(service.listRequests).toHaveBeenCalledWith({ status: TimeOffRequestStatus.PENDING });
    });

    it('should call service with both employeeId and status filters', async () => {
      service.listRequests.mockResolvedValue([]);
      
      await controller.listRequests('E1', TimeOffRequestStatus.APPROVED);
      
      expect(service.listRequests).toHaveBeenCalledWith({ employeeId: 'E1', status: TimeOffRequestStatus.APPROVED });
    });
  });

  describe('getRequest', () => {
    it('should call service with requestId', async () => {
      service.getRequest.mockResolvedValue({ id: 'R1' } as any);
      
      const result = await controller.getRequest('R1');
      
      expect(service.getRequest).toHaveBeenCalledWith('R1');
      expect(result.id).toBe('R1');
    });
  });

  describe('cancelRequest', () => {
    it('should throw BadRequestException if actorId header is missing', async () => {
      await expect(controller.cancelRequest('R1', undefined)).rejects.toThrow(BadRequestException);
      await expect(controller.cancelRequest('R1', undefined)).rejects.toThrow('X-Actor-Id header is required');
    });

    it('should call service with requestId and actorId', async () => {
      service.cancelRequest.mockResolvedValue({ id: 'R1', status: TimeOffRequestStatus.CANCELLED } as any);
      
      const result = await controller.cancelRequest('R1', 'E1');
      
      expect(service.cancelRequest).toHaveBeenCalledWith('R1', 'E1');
      expect(result.status).toBe(TimeOffRequestStatus.CANCELLED);
    });
  });

  describe('approveRequest', () => {
    it('should call service with requestId and managerId', async () => {
      const dto = { managerId: 'M1' };
      service.approveRequest.mockResolvedValue({ id: 'R1', status: TimeOffRequestStatus.APPROVED } as any);
      
      const result = await controller.approveRequest('R1', dto);
      
      expect(service.approveRequest).toHaveBeenCalledWith('R1', 'M1');
      expect(result.status).toBe(TimeOffRequestStatus.APPROVED);
    });
  });

  describe('rejectRequest', () => {
    it('should call service with requestId, managerId, and reason', async () => {
      const dto = { managerId: 'M1', reason: 'Not enough coverage' };
      service.rejectRequest.mockResolvedValue({ id: 'R1', status: TimeOffRequestStatus.REJECTED } as any);
      
      const result = await controller.rejectRequest('R1', dto);
      
      expect(service.rejectRequest).toHaveBeenCalledWith('R1', 'M1', 'Not enough coverage');
      expect(result.status).toBe(TimeOffRequestStatus.REJECTED);
    });
  });
});
