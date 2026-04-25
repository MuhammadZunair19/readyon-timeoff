import { ArgumentsHost } from '@nestjs/common';
import { TimeOffExceptionFilter } from '../../src/shared/timeoff-exception.filter';
import {
  BalanceNotFoundException,
  HcmInsufficientBalanceError,
  HcmInvalidDimensionError,
  HcmUnavailableError,
  HcmUnavailableException,
  InsufficientBalanceException,
  InvalidHcmDimensionException,
  InvalidStateTransitionException,
  OptimisticLockException,
  RequestNotFoundException,
} from '../../src/shared/exceptions';

describe('TimeOffExceptionFilter', () => {
  let filter: TimeOffExceptionFilter;
  let mockArgumentsHost: jest.Mocked<ArgumentsHost>;
  let mockResponse: any;
  let mockRequest: any;

  beforeEach(() => {
    filter = new TimeOffExceptionFilter();
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    
    mockRequest = {
      header: jest.fn().mockReturnValue('req-123'),
    };
    
    const mockHttpArgumentsHost = {
      getResponse: jest.fn().mockReturnValue(mockResponse),
      getRequest: jest.fn().mockReturnValue(mockRequest),
    };
    
    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue(mockHttpArgumentsHost),
    } as any;
  });

  const testCases = [
    { exception: new InsufficientBalanceException('err'), expectedStatus: 422, expectedError: 'INSUFFICIENT_BALANCE' },
    { exception: new InvalidHcmDimensionException('err'), expectedStatus: 422, expectedError: 'INVALID_HCM_DIMENSION' },
    { exception: new HcmInvalidDimensionError('err'), expectedStatus: 422, expectedError: 'INVALID_HCM_DIMENSION' },
    { exception: new RequestNotFoundException('err'), expectedStatus: 404, expectedError: 'REQUEST_NOT_FOUND' },
    { exception: new BalanceNotFoundException('err'), expectedStatus: 404, expectedError: 'BALANCE_NOT_FOUND' },
    { exception: new InvalidStateTransitionException('err'), expectedStatus: 409, expectedError: 'INVALID_STATE_TRANSITION' },
    { exception: new HcmUnavailableException('err'), expectedStatus: 503, expectedError: 'HCM_UNAVAILABLE' },
    { exception: new HcmUnavailableError('err'), expectedStatus: 503, expectedError: 'HCM_UNAVAILABLE' },
    { exception: new HcmInsufficientBalanceError('err'), expectedStatus: 422, expectedError: 'INSUFFICIENT_BALANCE' },
    { exception: new OptimisticLockException('err'), expectedStatus: 409, expectedError: 'BALANCE_CONFLICT' },
  ];

  testCases.forEach(({ exception, expectedStatus, expectedError }) => {
    it(`should map ${exception.constructor.name} to ${expectedStatus}`, () => {
      filter.catch(exception, mockArgumentsHost);
      expect(mockResponse.status).toHaveBeenCalledWith(expectedStatus);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: expectedStatus,
        error: expectedError,
        message: 'err',
        requestId: 'req-123',
      });
    });
  });

  it('should fallback to 500 for generic Errors', () => {
    const exception = new Error('Unknown error');
    filter.catch(exception, mockArgumentsHost);
    
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 500,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Unknown error',
      requestId: 'req-123',
    });
  });

  it('should fallback message if exception is not an Error instance', () => {
    filter.catch('Just a string error', mockArgumentsHost);
    
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 500,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Unexpected error',
      requestId: 'req-123',
    });
  });

  it('should generate a uuid if X-Request-Id header is empty or missing', () => {
    mockRequest.header.mockReturnValue('');
    const exception = new Error('err');
    
    filter.catch(exception, mockArgumentsHost);
    
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      requestId: expect.any(String),
    }));
    
    const callArgs = mockResponse.json.mock.calls[0][0];
    expect(callArgs.requestId.length).toBeGreaterThan(0);
  });
});
