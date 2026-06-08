import { ConsoleLogger, Module, type LogLevel } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EnvironmentVariables, validateEnvironment } from './config/environment';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment })],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: ConsoleLogger,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<EnvironmentVariables, true>): ConsoleLogger => {
        const nodeEnv = configService.get('NODE_ENV', { infer: true });
        const logFormat = configService.get('LOG_FORMAT', { infer: true });
        const logLevels: LogLevel[] =
          nodeEnv === 'production' ? ['error', 'warn', 'log'] : ['error', 'warn', 'log', 'debug'];

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
