/**
 * Shared Exceptions Unit Tests
 *
 * Invariant: All custom exceptions properly inherit from Error and have
 * correct names for identification.
 */

import {
  BalanceNotFoundException,
  InsufficientBalanceException,
  RequestNotFoundException,
  InvalidStateTransitionException,
  HcmUnavailableError,
  HcmInsufficientBalanceError,
  HcmInvalidDimensionError,
  OptimisticLockException,
  InvalidHcmDimensionException,
  HcmUnavailableException,
  AuditLogException,
} from '../../src/shared/exceptions';

describe('Shared Exceptions (Unit)', () => {
  describe('InsufficientBalanceException', () => {
    it('should create with correct name', () => {
      const error = new InsufficientBalanceException('Not enough days');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('InsufficientBalanceException');
      expect(error.message).toBe('Not enough days');
    });

    it('should be throwable and catchable', () => {
      expect(() => {
        throw new InsufficientBalanceException('Insufficient balance');
      }).toThrow(InsufficientBalanceException);
    });
  });

  describe('RequestNotFoundException', () => {
    it('should create with correct name', () => {
      const error = new RequestNotFoundException('Request not found');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('RequestNotFoundException');
      expect(error.message).toBe('Request not found');
    });

    it('should be throwable and catchable', () => {
      expect(() => {
        throw new RequestNotFoundException('REQ-123 not found');
      }).toThrow(RequestNotFoundException);
    });
  });

  describe('BalanceNotFoundException', () => {
    it('should create with correct name', () => {
      const error = new BalanceNotFoundException('Balance not found');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('BalanceNotFoundException');
      expect(error.message).toBe('Balance not found');
    });

    it('should be throwable and catchable', () => {
      expect(() => {
        throw new BalanceNotFoundException('No balance for employee');
      }).toThrow(BalanceNotFoundException);
    });
  });

  describe('InvalidStateTransitionException', () => {
    it('should create with correct name', () => {
      const error = new InvalidStateTransitionException('Invalid state transition');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('InvalidStateTransitionException');
      expect(error.message).toBe('Invalid state transition');
    });

    it('should be throwable and catchable', () => {
      expect(() => {
        throw new InvalidStateTransitionException('Cannot transition from PENDING to REJECTED');
      }).toThrow(InvalidStateTransitionException);
    });
  });

  describe('HcmUnavailableException', () => {
    it('should create with correct name', () => {
      const error = new HcmUnavailableException('HCM service unavailable');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('HcmUnavailableException');
      expect(error.message).toBe('HCM service unavailable');
    });

    it('should be throwable and catchable', () => {
      expect(() => {
        throw new HcmUnavailableException('Connection timeout');
      }).toThrow(HcmUnavailableException);
    });
  });

  describe('HcmInsufficientBalanceError', () => {
    it('should create with correct name', () => {
      const error = new HcmInsufficientBalanceError('HCM insufficient balance');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('HcmInsufficientBalanceError');
      expect(error.message).toBe('HCM insufficient balance');
    });

    it('should be throwable and catchable', () => {
      expect(() => {
        throw new HcmInsufficientBalanceError('Not enough days in HCM');
      }).toThrow(HcmInsufficientBalanceError);
    });
  });

  describe('HcmInvalidDimensionError', () => {
    it('should create with correct name', () => {
      const error = new HcmInvalidDimensionError('HCM invalid dimension');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('HcmInvalidDimensionError');
      expect(error.message).toBe('HCM invalid dimension');
    });

    it('should be throwable and catchable', () => {
      expect(() => {
        throw new HcmInvalidDimensionError('Invalid location dimension');
      }).toThrow(HcmInvalidDimensionError);
    });
  });

  describe('HcmUnavailableError', () => {
    it('should create with correct name', () => {
      const error = new HcmUnavailableError('HCM unavailable');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('HcmUnavailableError');
      expect(error.message).toBe('HCM unavailable');
    });

    it('should be throwable and catchable', () => {
      expect(() => {
        throw new HcmUnavailableError('Service down');
      }).toThrow(HcmUnavailableError);
    });
  });

  describe('OptimisticLockException', () => {
    it('should create with correct name', () => {
      const error = new OptimisticLockException('Version mismatch');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('OptimisticLockException');
      expect(error.message).toBe('Version mismatch');
    });

    it('should be throwable and catchable', () => {
      expect(() => {
        throw new OptimisticLockException('Balance was modified');
      }).toThrow(OptimisticLockException);
    });
  });

  describe('InvalidHcmDimensionException', () => {
    it('should create with correct name', () => {
      const error = new InvalidHcmDimensionException('Invalid HCM dimension');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('InvalidHcmDimensionException');
      expect(error.message).toBe('Invalid HCM dimension');
    });

    it('should be throwable and catchable', () => {
      expect(() => {
        throw new InvalidHcmDimensionException('Location not found in HCM');
      }).toThrow(InvalidHcmDimensionException);
    });
  });

  describe('HcmUnavailableException', () => {
    it('should create with correct name', () => {
      const error = new HcmUnavailableException('HCM is unavailable');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('HcmUnavailableException');
    });

    it('should be throwable and catchable', () => {
      expect(() => {
        throw new HcmUnavailableException('Server error');
      }).toThrow(HcmUnavailableException);
    });
  });

  describe('AuditLogException', () => {
    it('should create with correct name', () => {
      const error = new AuditLogException('Audit log failed');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('AuditLogException');
      expect(error.message).toBe('Audit log failed');
    });

    it('should be throwable and catchable', () => {
      expect(() => {
        throw new AuditLogException('Cannot write to audit log');
      }).toThrow(AuditLogException);
    });
  });
});

