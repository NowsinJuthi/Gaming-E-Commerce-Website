import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
  path: string;
  timestamp: string;
  accountExists?: boolean;
  invalidPassword?: boolean;
  retryAfterSeconds?: number;
}

/**
 * Converts every uncaught error into a consistent JSON envelope and logs 5xx
 * with stack traces. Only formats HTTP responses; non-HTTP contexts (WebSocket)
 * are left to their own handlers.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      this.logger.error(
        `Non-HTTP exception: ${
          exception instanceof Error ? exception.message : String(exception)
        }`,
      );
      return;
    }

    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[] = 'Internal server error';
    let error: string | undefined;
    let accountExists: boolean | undefined;
    let invalidPassword: boolean | undefined;
    let retryAfterSeconds: number | undefined;
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (
        typeof response === 'object' &&
        response !== null &&
        'status' in response &&
        typeof (response as { status?: unknown }).status === 'string'
      ) {
        res.status(status).json(response);
        return;
      }
      if (typeof response === 'string') {
        message = response;
      } else {
        const body = response as {
          message?: string | string[];
          error?: string;
          accountExists?: boolean;
          invalidPassword?: boolean;
          retryAfterSeconds?: number;
        };
        message = body.message ?? exception.message;
        error = body.error;
        if (typeof body.accountExists === 'boolean') {
          accountExists = body.accountExists;
        }
        if (typeof body.invalidPassword === 'boolean') {
          invalidPassword = body.invalidPassword;
        }
        if (typeof body.retryAfterSeconds === 'number') {
          retryAfterSeconds = body.retryAfterSeconds;
        }
      }
    }

    if (
      (status === HttpStatus.BAD_REQUEST ||
        status === HttpStatus.UNAUTHORIZED ||
        status === HttpStatus.FORBIDDEN) &&
      req.originalUrl.includes('/api/app/')
    ) {
      const msg = Array.isArray(message) ? message.join('; ') : message;
      res.status(status).json({
        status: 'error',
        message: msg || 'Validation failed',
      });
      return;
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${req.method} ${req.originalUrl} -> ${status}: ${
          exception instanceof Error ? exception.message : String(exception)
        }`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const payload: ErrorBody = {
      statusCode: status,
      message,
      error,
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    };
    if (accountExists !== undefined) {
      payload.accountExists = accountExists;
    }
    if (invalidPassword !== undefined) {
      payload.invalidPassword = invalidPassword;
    }
    if (retryAfterSeconds !== undefined) {
      payload.retryAfterSeconds = retryAfterSeconds;
    }
    res.status(status).json(payload);
  }
}
