export class InsufficientBalanceException extends Error {
  override name = 'InsufficientBalanceException';
}

export class InvalidHcmDimensionException extends Error {
  override name = 'InvalidHcmDimensionException';
}

export class RequestNotFoundException extends Error {
  override name = 'RequestNotFoundException';
}

export class BalanceNotFoundException extends Error {
  override name = 'BalanceNotFoundException';
}

export class InvalidStateTransitionException extends Error {
  override name = 'InvalidStateTransitionException';
}

export class HcmUnavailableException extends Error {
  override name = 'HcmUnavailableException';
}

export class HcmInsufficientBalanceError extends Error {
  override name = 'HcmInsufficientBalanceError';
}

export class HcmInvalidDimensionError extends Error {
  override name = 'HcmInvalidDimensionError';
}

export class HcmUnavailableError extends Error {
  override name = 'HcmUnavailableError';
}

export class OptimisticLockException extends Error {
  override name = 'OptimisticLockException';
}

export class AuditLogException extends Error {
  override name = 'AuditLogException';
}

