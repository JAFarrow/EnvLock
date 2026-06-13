import { ConsoleLogger, Module, type LogLevel } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { EnvironmentVariables, validateEnvironment } from './config/environment';
import { PostgresExceptionFilter } from './database/postgres-exception.filter';
import { createTypeOrmOptions } from './database/typeorm.options';
import { EnvironmentsModule } from './environments/environments.module';
import { ProjectsModule } from './projects/projects.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: createTypeOrmOptions
    }),
    AuthModule,
    EnvironmentsModule,
    ProjectsModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
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
