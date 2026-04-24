import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
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
} from './exceptions';

type ErrorMapping = { statusCode: number; error: string };

@Catch()
export class TimeOffExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const requestIdHeader = req.header('X-Request-Id');
    const requestId = requestIdHeader && requestIdHeader.trim().length > 0 ? requestIdHeader : uuidv4();

    const mapping = this.map(exception);
    const message = exception instanceof Error ? exception.message : 'Unexpected error';

    res.status(mapping.statusCode).json({
      statusCode: mapping.statusCode,
      error: mapping.error,
      message,
      requestId,
    });
  }

  private map(exception: unknown): ErrorMapping {
    if (exception instanceof InsufficientBalanceException) {
      return { statusCode: 422, error: 'INSUFFICIENT_BALANCE' };
    }
    if (exception instanceof InvalidHcmDimensionException) {
      return { statusCode: 422, error: 'INVALID_HCM_DIMENSION' };
    }
    if (exception instanceof HcmInvalidDimensionError) {
      return { statusCode: 422, error: 'INVALID_HCM_DIMENSION' };
    }
    if (exception instanceof RequestNotFoundException) {
      return { statusCode: 404, error: 'REQUEST_NOT_FOUND' };
    }
    if (exception instanceof BalanceNotFoundException) {
      return { statusCode: 404, error: 'BALANCE_NOT_FOUND' };
    }
    if (exception instanceof InvalidStateTransitionException) {
      return { statusCode: 409, error: 'INVALID_STATE_TRANSITION' };
    }
    if (exception instanceof HcmUnavailableException || exception instanceof HcmUnavailableError) {
      return { statusCode: 503, error: 'HCM_UNAVAILABLE' };
    }
    if (exception instanceof HcmInsufficientBalanceError) {
      return { statusCode: 422, error: 'INSUFFICIENT_BALANCE' };
    }
    if (exception instanceof OptimisticLockException) {
      return { statusCode: 409, error: 'BALANCE_CONFLICT' };
    }

    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, error: 'INTERNAL_SERVER_ERROR' };
  }
}

