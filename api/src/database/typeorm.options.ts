import { type ConfigService } from '@nestjs/config';
import { type TypeOrmModuleOptions } from '@nestjs/typeorm';

import { type EnvironmentVariables } from '../config/environment';
import { databaseEntities } from './entities';

export function createTypeOrmOptions(
  configService: ConfigService<EnvironmentVariables, true>
): TypeOrmModuleOptions {
  const nodeEnv = configService.get('NODE_ENV', { infer: true });

  return {
    type: 'postgres',
    url: configService.get('DATABASE_URL', { infer: true }),
    entities: databaseEntities,
    synchronize: nodeEnv !== 'production'
  };
}
