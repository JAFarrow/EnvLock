import { ConsoleLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { applyApiPrefix } from './api-prefix';
import { AppModule } from './app.module';
import { EnvironmentVariables } from './config/environment';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const configService = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  const port = configService.get('PORT', { infer: true });
  const logger = app.get(ConsoleLogger);

  app.useLogger(logger);
  applyApiPrefix(app);
  await app.listen(port);

  logger.log('API listening', { port });
}

void bootstrap();
