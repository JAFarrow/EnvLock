import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

const POSTGRES_UNIQUE_VIOLATION = '23505';

interface HttpResponse {
  status(statusCode: number): HttpResponse;
  json(body: ErrorResponseBody): void;
}

interface ErrorResponseBody {
  statusCode: number;
  message: string;
  error: string;
}

@Catch(QueryFailedError)
export class PostgresExceptionFilter implements ExceptionFilter<QueryFailedError> {
  catch(exception: QueryFailedError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<HttpResponse>();

    if (hasPostgresErrorCode(exception, POSTGRES_UNIQUE_VIOLATION)) {
      response.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        message: 'Resource already exists',
        error: 'Conflict'
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error'
    });
  }
}

function hasPostgresErrorCode(exception: QueryFailedError, code: string): boolean {
  const driverError: unknown = exception.driverError;

  if (typeof driverError !== 'object' || driverError === null || !('code' in driverError)) {
    return false;
  }

  return (driverError as { code?: unknown }).code === code;
}
