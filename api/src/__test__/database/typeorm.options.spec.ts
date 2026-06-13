import { type ConfigService } from '@nestjs/config';

import { type EnvironmentVariables } from '../../config/environment';
import { createTypeOrmOptions } from '../../database/typeorm.options';

type ConfigServiceMock = Pick<ConfigService<EnvironmentVariables, true>, 'get'>;

function createConfigService(): ConfigServiceMock {
  return {
    get: jest.fn((key: keyof EnvironmentVariables) => {
      if (key === 'DATABASE_URL') {
        return 'postgres://envlock:envlock@localhost:5432/envlock';
      }

      throw new Error(`Unexpected config key: ${key}`);
    })
  } as ConfigServiceMock;
}

describe('createTypeOrmOptions', () => {
  it('does not synchronize schemas', () => {
    expect(
      createTypeOrmOptions(createConfigService() as ConfigService<EnvironmentVariables, true>)
    ).toMatchObject({ synchronize: false });
  });
});
