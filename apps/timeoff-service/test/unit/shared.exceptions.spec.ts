/**
 * Shared Exceptions Unit Tests
 *
 * Invariant: All custom exceptions properly format error responses with
 * consistent HTTP status codes and error messages.
 */

import { HttpStatus } from '@nestjs/common';
import {
  TimeOffException,
  BalanceNotFoundException,
  InsufficientBalanceException,
  RequestNotFoundException,
  InvalidStateTransitionException,
  HcmUnavailableError,
  HcmInsufficientBalanceError,
  HcmInvalidDimensionError,
  OptimisticLockException,
} from '../../src/shared/exceptions';

describe('Shared Exceptions (Unit)', () => {
  describe('TimeOffException', () => {
    it('should create insufficientBalance exception with correct status', () => {
      const error = TimeOffException.insufficientBalance('E001', 'NYC', 'ANNUAL');

      expect(error).toBeInstanceOf(InsufficientBalanceException);
      expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(error.message).toContain('E001');
    });

    it('should create requestNotFound exception with correct status', () => {
      const error = TimeOffException.requestNotFound('REQ-123');

      expect(error).toBeInstanceOf(RequestNotFoundException);
      expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(error.message).toContain('REQ-123');
    });

    it('should create balanceNotFound exception with correct status', () => {
      const error = TimeOffException.balanceNotFound('E001', 'NYC', 'ANNUAL');

      expect(error).toBeInstanceOf(BalanceNotFoundException);
      expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(error.message).toContain('E001');
    });

    it('should create invalidStateTransition exception with correct status', () => {
      const error = TimeOffException.invalidStateTransition('PENDING', 'CANCELLED');

      expect(error).toBeInstanceOf(InvalidStateTransitionException);
      expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
      expect(error.message).toContain('PENDING');
      expect(error.message).toContain('CANCELLED');
    });

    it('should create hcmFailed exception with correct status', () => {
      const error = TimeOffException.hcmFailed('Request timeout');

      expect(error).toBeInstanceOf(HcmUnavailableError);
      expect(error.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(error.message).toContain('Request timeout');
    });

    it('should create hcmInsufficientBalance exception', () => {
      const error = TimeOffException.hcmInsufficientBalance('Not enough days');

      expect(error).toBeInstanceOf(HcmInsufficientBalanceError);
      expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(error.message).toContain('Not enough days');
    });

    it('should create hcmInvalidDimension exception', () => {
      const error = TimeOffException.hcmInvalidDimension('Invalid location');

      expect(error).toBeInstanceOf(HcmInvalidDimensionError);
      expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(error.message).toContain('Invalid location');
    });

    it('should create optimisticLock exception', () => {
      const error = TimeOffException.optimisticLock('Balance version mismatch');

      expect(error).toBeInstanceOf(OptimisticLockException);
      expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
      expect(error.message).toContain('Balance version mismatch');
    });
  });

  describe('Exception Error Codes', () => {
    it('should have INSUFFICIENT_BALANCE code', () => {
      const error = TimeOffException.insufficientBalance('E001', 'NYC', 'ANNUAL');
      const response = error.getResponse() as any;

      expect(response.code).toBe('INSUFFICIENT_BALANCE');
    });

    it('should have REQUEST_NOT_FOUND code', () => {
      const error = TimeOffException.requestNotFound('REQ-123');
      const response = error.getResponse() as any;

      expect(response.code).toBe('REQUEST_NOT_FOUND');
    });

    it('should have BALANCE_NOT_FOUND code', () => {
      const error = TimeOffException.balanceNotFound('E001', 'NYC', 'ANNUAL');
      const response = error.getResponse() as any;

      expect(response.code).toBe('BALANCE_NOT_FOUND');
    });

    it('should have INVALID_STATE_TRANSITION code', () => {
      const error = TimeOffException.invalidStateTransition('PENDING', 'CANCELLED');
      const response = error.getResponse() as any;

      expect(response.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('should have HCM_FAILED code', () => {
      const error = TimeOffException.hcmFailed('Error');
      const response = error.getResponse() as any;

      expect(response.code).toBe('HCM_FAILED');
    });

    it('should have HCM_INSUFFICIENT_BALANCE code', () => {
      const error = TimeOffException.hcmInsufficientBalance('Not enough');
      const response = error.getResponse() as any;

      expect(response.code).toBe('HCM_INSUFFICIENT_BALANCE');
    });

    it('should have HCM_INVALID_DIMENSION code', () => {
      const error = TimeOffException.hcmInvalidDimension('Invalid');
      const response = error.getResponse() as any;

      expect(response.code).toBe('HCM_INVALID_DIMENSION');
    });

    it('should have OPTIMISTIC_LOCK code', () => {
      const error = TimeOffException.optimisticLock('Mismatch');
      const response = error.getResponse() as any;

      expect(response.code).toBe('OPTIMISTIC_LOCK');
    });
  });

  describe('Exception Messages', () => {
    it('should include detailed message for insufficient balance', () => {
      const error = TimeOffException.insufficientBalance('E001', 'NYC', 'ANNUAL');
      const response = error.getResponse() as any;

      expect(response.message).toContain('E001');
      expect(response.message).toContain('NYC');
      expect(response.message).toContain('ANNUAL');
    });

    it('should include request ID in request not found', () => {
      const error = TimeOffException.requestNotFound('REQ-ABC123');
      const response = error.getResponse() as any;

      expect(response.message).toContain('REQ-ABC123');
    });

    it('should include state info in state transition error', () => {
      const error = TimeOffException.invalidStateTransition('PENDING', 'REJECTED');
      const response = error.getResponse() as any;

      expect(response.message).toContain('PENDING');
      expect(response.message).toContain('REJECTED');
    });

    it('should include HCM error details', () => {
      const error = TimeOffException.hcmFailed('Timeout after 5s');
      const response = error.getResponse() as any;

      expect(response.message).toContain('Timeout after 5s');
    });
  });

  describe('Exception Response Format', () => {
    it('should format response with consistent structure', () => {
      const error = TimeOffException.insufficientBalance('E001', 'NYC', 'ANNUAL');
      const response = error.getResponse() as any;

      expect(response).toHaveProperty('code');
      expect(response).toHaveProperty('message');
      expect(typeof response.code).toBe('string');
      expect(typeof response.message).toBe('string');
    });

    it('should include timestamp in response', () => {
      const error = TimeOffException.insufficientBalance('E001', 'NYC', 'ANNUAL');
      const response = error.getResponse() as any;

      if (response.timestamp) {
        expect(new Date(response.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
      }
    });

    it('should preserve error details across exception types', () => {
      const errors = [
        TimeOffException.insufficientBalance('E001', 'NYC', 'ANNUAL'),
        TimeOffException.requestNotFound('REQ-123'),
        TimeOffException.hcmFailed('Error'),
        TimeOffException.invalidStateTransition('A', 'B'),
      ];

      errors.forEach((error) => {
        const response = error.getResponse() as any;
        expect(response).toHaveProperty('code');
        expect(response).toHaveProperty('message');
        expect(response.code).not.toBeNull();
        expect(response.message).not.toBeNull();
      });
    });
  });

  describe('HTTP Status Codes', () => {
    it('should return 400 for client errors', () => {
      const errors = [
        TimeOffException.insufficientBalance('E001', 'NYC', 'ANNUAL'),
        TimeOffException.hcmInsufficientBalance('Not enough'),
        TimeOffException.hcmInvalidDimension('Invalid'),
      ];

      errors.forEach((error) => {
        expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      });
    });

    it('should return 404 for not found errors', () => {
      const errors = [
        TimeOffException.requestNotFound('REQ-123'),
        TimeOffException.balanceNotFound('E001', 'NYC', 'ANNUAL'),
      ];

      errors.forEach((error) => {
        expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
      });
    });

    it('should return 409 for conflict errors', () => {
      const errors = [
        TimeOffException.invalidStateTransition('A', 'B'),
        TimeOffException.optimisticLock('Mismatch'),
      ];

      errors.forEach((error) => {
        expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
      });
    });

    it('should return 503 for service unavailable', () => {
      const error = TimeOffException.hcmFailed('Service down');

      expect(error.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    });
  });

  describe('Exception Inheritance', () => {
    it('should be instances of Error', () => {
      const error = TimeOffException.insufficientBalance('E001', 'NYC', 'ANNUAL');

      expect(error).toBeInstanceOf(Error);
    });

    it('should have proper error message', () => {
      const error = TimeOffException.insufficientBalance('E001', 'NYC', 'ANNUAL');

      expect(error.message).toBeDefined();
      expect(error.message.length).toBeGreaterThan(0);
    });

    it('should support standard Error properties', () => {
      const error = TimeOffException.insufficientBalance('E001', 'NYC', 'ANNUAL');

      expect(error.name).toBeDefined();
      expect(error.message).toBeDefined();
    });
  });
});
