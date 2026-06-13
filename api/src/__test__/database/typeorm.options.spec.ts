import { type ConfigService } from '@nestjs/config';

import { type EnvironmentVariables } from '../../config/environment';
import { createTypeOrmOptions } from '../../database/typeorm.options';

type ConfigServiceMock = Pick<ConfigService<EnvironmentVariables, true>, 'get'>;

function createConfigService(nodeEnv: EnvironmentVariables['NODE_ENV']): ConfigServiceMock {
  return {
    get: jest.fn((key: keyof EnvironmentVariables) => {
      if (key === 'DATABASE_URL') {
        return 'postgres://envlock:envlock@localhost:5432/envlock';
      }

      if (key === 'NODE_ENV') {
        return nodeEnv;
      }

      throw new Error(`Unexpected config key: ${key}`);
    })
  } as ConfigServiceMock;
}

describe('createTypeOrmOptions', () => {
  it('synchronizes schemas outside production', () => {
    expect(
      createTypeOrmOptions(
        createConfigService('development') as ConfigService<EnvironmentVariables, true>
      )
    ).toMatchObject({ synchronize: true });

    expect(
      createTypeOrmOptions(createConfigService('test') as ConfigService<EnvironmentVariables, true>)
    ).toMatchObject({ synchronize: true });
  });

  it('does not synchronize schemas in production', () => {
    expect(
      createTypeOrmOptions(
        createConfigService('production') as ConfigService<EnvironmentVariables, true>
      )
    ).toMatchObject({ synchronize: false });
  });
});
