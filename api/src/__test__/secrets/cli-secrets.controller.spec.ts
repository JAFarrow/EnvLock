import { type INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { applyApiPrefix } from '../../api-prefix';
import { type AuthenticatedPersonalAccessTokenRequest } from '../../auth/contracts/personal-access-token-request';
import { PersonalAccessTokenAuthGuard } from '../../auth/guards/personal-access-token-auth.guard';
import { CliSecretsController } from '../../secrets/cli-secrets.controller';
import { type CliSecretValuesResponseDto } from '../../secrets/contracts/cli-secret-values.response.dto';
import { SecretsService } from '../../secrets/secrets.service';

type SecretsServiceMock = {
  findCliValues: jest.Mock<Promise<CliSecretValuesResponseDto>, [unknown, string]>;
};

const projectId = 'd251ec7d-8e99-499c-a9c2-8dcbb847492d';
const environmentId = '7ea93715-1cc6-428d-937f-e7d8eec105dc';
const tokenId = 'a65de020-3ac3-4f9d-b3df-3cde79de0511';
const userId = '9942365e-cb78-4f24-9f33-5b4a821759a4';
const personalAccessToken = { id: tokenId, projectId, userId };
const cliSecretValuesResponse: CliSecretValuesResponseDto = {
  projectId,
  environmentId,
  environment: 'production',
  variables: {
    DATABASE_URL: 'postgresql://example'
  }
};

function createRequest(): AuthenticatedPersonalAccessTokenRequest {
  return {
    user: personalAccessToken
  } as AuthenticatedPersonalAccessTokenRequest;
}

describe('CliSecretsController', () => {
  let controller: CliSecretsController;
  let service: SecretsServiceMock;
  let app: INestApplication | undefined;

  beforeEach(async () => {
    service = {
      findCliValues: jest.fn<Promise<CliSecretValuesResponseDto>, [unknown, string]>(() =>
        Promise.resolve(cliSecretValuesResponse)
      )
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CliSecretsController],
      providers: [
        {
          provide: SecretsService,
          useValue: service
        }
      ]
    })
      .overrideGuard(PersonalAccessTokenAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(CliSecretsController);
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }

    jest.restoreAllMocks();
  });

  it('returns CLI secret values for the authenticated PAT', async () => {
    await expect(controller.findValues(createRequest(), 'production')).resolves.toBe(
      cliSecretValuesResponse
    );

    expect(service.findCliValues).toHaveBeenCalledWith(personalAccessToken, 'production');
  });

  it('returns decrypted values over HTTP without allowing caches to store them', async () => {
    await initHttpApp();

    const server = app?.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server)
      .get('/api/cli/secrets')
      .query({ environmentSlug: 'production' })
      .set('Authorization', `Bearer envlock_pat_${tokenId}.secret`)
      .expect(200);

    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual(cliSecretValuesResponse);
  });

  it('returns 400 for invalid query params', async () => {
    await initHttpApp();

    const server = app?.getHttpServer() as Parameters<typeof request>[0];

    await request(server)
      .get('/api/cli/secrets')
      .query({})
      .set('Authorization', `Bearer envlock_pat_${tokenId}.secret`)
      .expect(400);
    await request(server)
      .get('/api/cli/secrets')
      .query({ environmentSlug: 'Invalid_Slug' })
      .set('Authorization', `Bearer envlock_pat_${tokenId}.secret`)
      .expect(400);
  });

  async function initHttpApp(): Promise<void> {
    const module = await Test.createTestingModule({
      controllers: [CliSecretsController],
      providers: [
        {
          provide: SecretsService,
          useValue: service
        }
      ]
    })
      .overrideGuard(PersonalAccessTokenAuthGuard)
      .useValue({
        canActivate: (context: { switchToHttp: () => { getRequest: () => unknown } }) => {
          const httpRequest = context
            .switchToHttp()
            .getRequest() as Partial<AuthenticatedPersonalAccessTokenRequest>;
          httpRequest.user = personalAccessToken;

          return true;
        }
      })
      .compile();

    app = module.createNestApplication();
    applyApiPrefix(app);
    await app.init();
  }
});
