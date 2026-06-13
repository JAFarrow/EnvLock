import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

const POSTGRES_UNIQUE_VIOLATION = '23505';
const POSTGRES_FOREIGN_KEY_VIOLATION = '23503';
const POSTGRES_NOT_NULL_VIOLATION = '23502';
const POSTGRES_CHECK_VIOLATION = '23514';
const ACTIVE_SECRET_KEY_CONSTRAINT = 'uq_secrets_environment_key_active';

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
    const postgresConstraint = getPostgresConstraint(exception);
    const handledError = getHandledPostgresError(postgresErrorCode, postgresConstraint);

    if (handledError !== null) {
      this.logger.warn('Postgres query failure mapped to HTTP response', {
        code: postgresErrorCode,
        constraint: postgresConstraint
      });

      response.status(handledError.statusCode).json({
        statusCode: handledError.statusCode,
        message: handledError.message,
        error: handledError.error
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

function getHandledPostgresError(code: unknown, constraint: unknown): ErrorResponseBody | null {
  if (code === POSTGRES_UNIQUE_VIOLATION) {
    return {
      statusCode: HttpStatus.CONFLICT,
      message:
        constraint === ACTIVE_SECRET_KEY_CONSTRAINT
          ? 'Secret key already exists'
          : 'Resource already exists',
      error: 'Conflict'
    };
  }

  if (code === POSTGRES_FOREIGN_KEY_VIOLATION) {
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Invalid related resource reference',
      error: 'Bad Request'
    };
  }

  if (code === POSTGRES_CHECK_VIOLATION) {
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Invalid resource value',
      error: 'Bad Request'
    };
  }

  if (code === POSTGRES_NOT_NULL_VIOLATION) {
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Required resource field missing',
      error: 'Bad Request'
    };
  }

  return null;
}

function getPostgresErrorCode(exception: QueryFailedError): unknown {
  const driverError: unknown = exception.driverError;

  if (typeof driverError !== 'object' || driverError === null || !('code' in driverError)) {
    return undefined;
  }

  return (driverError as { code?: unknown }).code;
}

function getPostgresConstraint(exception: QueryFailedError): unknown {
  const driverError: unknown = exception.driverError;

  if (typeof driverError !== 'object' || driverError === null || !('constraint' in driverError)) {
    return undefined;
  }

  return (driverError as { constraint?: unknown }).constraint;
}
