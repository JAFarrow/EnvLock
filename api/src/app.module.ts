import { ConsoleLogger, Module, type LogLevel } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from './auth/auth.module';
import { EnvironmentVariables, validateEnvironment } from './config/environment';
import { createTypeOrmOptions } from './database/typeorm.options';
import { EnvironmentsModule } from './environments/environments.module';
import { PostgresExceptionFilter } from './filters/postgres-exception.filter';
import { HealthController } from './health/health.controller';
import { HealthService } from './health/health.service';
import { PersonalAccessTokensModule } from './personal-access-tokens/personal-access-tokens.module';
import { ProjectsModule } from './projects/projects.module';
import { SecretsModule } from './secrets/secrets.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: createTypeOrmOptions
    }),
    AuthModule,
    EnvironmentsModule,
    PersonalAccessTokensModule,
    ProjectsModule,
    SecretsModule
  ],
  controllers: [HealthController],
  providers: [
    HealthService,
    {
      provide: APP_FILTER,
      useClass: PostgresExceptionFilter
    },
    {
      provide: ConsoleLogger,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<EnvironmentVariables, true>): ConsoleLogger => {
        const nodeEnv = configService.get('NODE_ENV', { infer: true });
        const logFormat = configService.get('LOG_FORMAT', { infer: true });
        const logLevels: LogLevel[] =
          nodeEnv === 'production'
            ? ['error', 'fatal', 'warn', 'log']
            : ['error', 'fatal', 'warn', 'log', 'debug'];

        return new ConsoleLogger({
          colors: logFormat !== 'json',
          compact: true,
          json: logFormat === 'json',
          logLevels
        });
      }
    }
  ]
})
export class AppModule {}
