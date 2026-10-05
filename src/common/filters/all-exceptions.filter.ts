import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ErrorCode } from '../errors/error-codes';

const STATUS_CODES: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHENTICATED,
  [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.TOO_MANY_REQUESTS,
};

const codeFromStatus = (status: number): ErrorCode =>
  STATUS_CODES[status] ??
  (status >= 500 ? ErrorCode.INTERNAL_ERROR : ErrorCode.INVALID_REQUEST);

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const error = exception as Error;
    const body =
      exception instanceof HttpException ? exception.getResponse() : null;
    const fields =
      body && typeof body === 'object' ? (body as Record<string, unknown>) : {};

    const code =
      typeof fields.code === 'string' ? fields.code : codeFromStatus(status);
    const params =
      fields.params && typeof fields.params === 'object'
        ? fields.params
        : undefined;
    // Without this, a coded exception would report Nest's "Not Found Exception".
    const message =
      typeof body === 'string'
        ? body
        : (fields.message ?? (body ? code : (error?.message ?? code)));

    const detail =
      typeof message === 'string' ? message : JSON.stringify(message);

    this.logger.error(
      `${request.method} ${request.url} -> ${status} ${code} | ${detail}`,
      error?.stack,
    );

    if (response.headersSent) {
      response.end();
      return;
    }

    response.status(status).json({
      statusCode: status,
      code,
      params,
      // Server-side details (provider errors, config) stay in the logs.
      message: status >= 500 ? code : message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
