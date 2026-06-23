import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiResponse } from './api-response';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, code, message } = this.resolveError(exception);

    if (status >= Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      this.logger.error(
        `[${request.method}] ${request.url} -> ${status} ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `[${request.method}] ${request.url} -> ${status} ${message}`,
      );
    }

    const body: ApiResponse<null> = {
      code,
      message,
      data: null,
      timestamp: Date.now(),
      path: request.url,
    };

    response.status(status).json(body);
  }

  private resolveError(exception: unknown): {
    status: number;
    code: number;
    message: string;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const responseBody = exception.getResponse();
      const message = this.extractMessage(responseBody) ?? exception.message;
      return { status, code: status, message };
    }

    const status = HttpStatus.INTERNAL_SERVER_ERROR;
    const message =
      exception instanceof Error ? exception.message : '服务器内部错误';
    return { status, code: status, message };
  }

  private extractMessage(payload: unknown): string | null {
    if (typeof payload === 'string') {
      return payload;
    }
    if (
      typeof payload === 'object' &&
      payload !== null &&
      'message' in payload
    ) {
      const message = payload.message;
      if (typeof message === 'string') {
        return message;
      }
      if (Array.isArray(message)) {
        return message.filter((item) => typeof item === 'string').join('; ');
      }
    }
    return null;
  }
}
