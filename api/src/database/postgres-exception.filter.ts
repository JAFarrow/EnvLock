import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(PostgresExceptionFilter.name);

  catch(exception: QueryFailedError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<HttpResponse>();
    const postgresErrorCode = getPostgresErrorCode(exception);

    if (postgresErrorCode === POSTGRES_UNIQUE_VIOLATION) {
      this.logger.warn('Postgres unique violation mapped to conflict response', {
        code: postgresErrorCode
      });

      response.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        message: 'Resource already exists',
        error: 'Conflict'
      });
      return;
    }

    this.logger.error('Unhandled Postgres query failure', {
      code: postgresErrorCode,
      message: exception.message
    });

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error'
    });
  }
}

function getPostgresErrorCode(exception: QueryFailedError): unknown {
  const driverError: unknown = exception.driverError;

  if (typeof driverError !== 'object' || driverError === null || !('code' in driverError)) {
    return undefined;
  }

  return (driverError as { code?: unknown }).code;
}
