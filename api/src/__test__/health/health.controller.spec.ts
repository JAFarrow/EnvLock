import { HttpStatus, type INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { HealthController } from '../../health/health.controller';
import { HealthService } from '../../health/health.service';
import { applyApiPrefix } from '../../main';

type DataSourceMock = Pick<DataSource, 'query'>;

describe('HealthController', () => {
  let healthController: HealthController;
  let dataSource: DataSourceMock;
  let statusResponse: { status: jest.Mock<undefined, [number]> };
  let app: INestApplication | undefined;

  beforeEach(async () => {
    dataSource = {
      query: jest.fn<Promise<unknown>, [string]>(() => Promise.resolve([{ '?column?': 1 }]))
    };
    statusResponse = {
      status: jest.fn<undefined, [number]>()
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: DataSource,
          useValue: dataSource
        }
      ]
    }).compile();

    healthController = module.get(HealthController);
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }
  });

  it('returns service and dependency health', async () => {
    await expect(healthController.getHealth(statusResponse)).resolves.toEqual({
      status: 'ok',
      service: 'envlock-api',
      dependencies: {
        database: {
          status: 'ok'
        }
      }
    });

    expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
    expect(statusResponse.status).not.toHaveBeenCalled();
  });

  it('returns sanitized dependency errors with service unavailable status', async () => {
    dataSource.query = jest.fn<Promise<unknown>, [string]>(() => Promise.reject(new Error('boom')));

    await expect(healthController.getHealth(statusResponse)).resolves.toEqual({
      status: 'error',
      service: 'envlock-api',
      dependencies: {
        database: {
          status: 'error'
        }
      }
    });

    expect(statusResponse.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
  });

  it('serves health outside the API prefix', async () => {
    await initHttpApp();

    const server = app?.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server).get('/health').expect(200);

    await request(server).get('/api/health').expect(404);
    expect(response.body).toEqual({
      status: 'ok',
      service: 'envlock-api',
      dependencies: {
        database: {
          status: 'ok'
        }
      }
    });
  });

  async function initHttpApp(): Promise<void> {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: DataSource,
          useValue: dataSource
        }
      ]
    }).compile();

    app = module.createNestApplication();
    applyApiPrefix(app);
    await app.init();
  }
});
