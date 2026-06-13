import { ArgumentsHost, HttpStatus, Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

import { PostgresExceptionFilter } from '../../filters/postgres-exception.filter';

interface ResponseMock {
  status: jest.Mock<ResponseMock, [number]>;
  json: jest.Mock<undefined, [Record<string, unknown>]>;
}

function createHost(response: ResponseMock): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getRequest: jest.fn(),
      getResponse: () => response,
      getNext: jest.fn()
    }),
    getArgByIndex: jest.fn(),
    getArgs: jest.fn(),
    getType: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn()
  } as ArgumentsHost;
}

function createResponse(): ResponseMock {
  const response: ResponseMock = {
    status: jest.fn<ResponseMock, [number]>(),
    json: jest.fn<undefined, [Record<string, unknown>]>()
  };

  response.status.mockReturnValue(response);

  return response;
}

function createQueryFailedError(code: string, constraint?: string): QueryFailedError {
  const driverError = Object.assign(new Error('query failed'), { code, constraint });

  return new QueryFailedError('INSERT', [], driverError);
}

describe('PostgresExceptionFilter', () => {
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps unique violations to conflicts', () => {
    const filter = new PostgresExceptionFilter();
    const response = createResponse();

    filter.catch(createQueryFailedError('23505'), createHost(response));

    expect(response.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.CONFLICT,
      message: 'Resource already exists',
      error: 'Conflict'
    });
    expect(warnSpy).toHaveBeenCalledWith('Postgres query failure mapped to HTTP response', {
      code: '23505',
      constraint: undefined
    });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('maps active secret key unique violations to secret conflicts', () => {
    const filter = new PostgresExceptionFilter();
    const response = createResponse();

    filter.catch(
      createQueryFailedError('23505', 'uq_secrets_environment_key_active'),
      createHost(response)
    );

    expect(response.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.CONFLICT,
      message: 'Secret key already exists',
      error: 'Conflict'
    });
    expect(warnSpy).toHaveBeenCalledWith('Postgres query failure mapped to HTTP response', {
      code: '23505',
      constraint: 'uq_secrets_environment_key_active'
    });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('maps foreign key violations to bad requests', () => {
    const filter = new PostgresExceptionFilter();
    const response = createResponse();

    filter.catch(createQueryFailedError('23503'), createHost(response));

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Invalid related resource reference',
      error: 'Bad Request'
    });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('maps check violations to bad requests', () => {
    const filter = new PostgresExceptionFilter();
    const response = createResponse();

    filter.catch(createQueryFailedError('23514'), createHost(response));

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Invalid resource value',
      error: 'Bad Request'
    });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('maps not-null violations to bad requests', () => {
    const filter = new PostgresExceptionFilter();
    const response = createResponse();

    filter.catch(createQueryFailedError('23502'), createHost(response));

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Required resource field missing',
      error: 'Bad Request'
    });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('maps unhandled query failures to internal server errors', () => {
    const filter = new PostgresExceptionFilter();
    const response = createResponse();

    filter.catch(createQueryFailedError('99999'), createHost(response));

    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error'
    });
    expect(errorSpy).toHaveBeenCalledWith('Unhandled Postgres query failure', {
      code: '99999',
      message: 'query failed'
    });
  });
});
