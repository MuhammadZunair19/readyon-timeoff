import { ArgumentsHost, HttpException } from '@nestjs/common';
import { TimeOffExceptionFilter } from '../../src/shared/timeoff-exception.filter';
import {
  ErrorCode,
  InsufficientBalanceError,
  HcmUnavailableError,
  HcmInsufficientBalanceError,
  HcmInvalidDimensionError,
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
      url: '/test-url',
    };
    
    const mockHttpArgumentsHost = {
      getResponse: jest.fn().mockReturnValue(mockResponse),
      getRequest: jest.fn().mockReturnValue(mockRequest),
    };
    
    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue(mockHttpArgumentsHost),
    } as any;
  });

  it('should format TimeOffException correctly', () => {
    const exception = new InsufficientBalanceError('Insufficient local balance');
    
    filter.catch(exception, mockArgumentsHost);
    
    expect(mockResponse.status).toHaveBeenCalledWith(422);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 422,
      timestamp: expect.any(String),
      path: '/test-url',
      error: {
        code: ErrorCode.INSUFFICIENT_BALANCE,
        message: 'Insufficient local balance',
      },
    });
  });

  it('should map HcmUnavailableError to 503', () => {
    const exception = new HcmUnavailableError('HCM is down');
    
    filter.catch(exception, mockArgumentsHost);
    
    expect(mockResponse.status).toHaveBeenCalledWith(503);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 503,
      error: expect.objectContaining({ code: ErrorCode.HCM_UNAVAILABLE }),
    }));
  });

  it('should map HcmInsufficientBalanceError to 422', () => {
    const exception = new HcmInsufficientBalanceError('HCM rejected');
    
    filter.catch(exception, mockArgumentsHost);
    
    expect(mockResponse.status).toHaveBeenCalledWith(422);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 422,
      error: expect.objectContaining({ code: ErrorCode.HCM_INSUFFICIENT_BALANCE }),
    }));
  });

  it('should map HcmInvalidDimensionError to 400', () => {
    const exception = new HcmInvalidDimensionError('Invalid location');
    
    filter.catch(exception, mockArgumentsHost);
    
    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 400,
      error: expect.objectContaining({ code: ErrorCode.HCM_INVALID_DIMENSION }),
    }));
  });

  it('should format generic HttpException correctly', () => {
    const exception = new HttpException('Bad Request', 400);
    
    filter.catch(exception, mockArgumentsHost);
    
    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 400,
      timestamp: expect.any(String),
      path: '/test-url',
      message: 'Bad Request',
    });
  });
  
  it('should fallback to 500 for generic Errors', () => {
    const exception = new Error('Unknown error');
    
    filter.catch(exception, mockArgumentsHost);
    
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 500,
      timestamp: expect.any(String),
      path: '/test-url',
      message: 'Internal server error',
    });
  });
});
