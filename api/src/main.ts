import { ConsoleLogger, type INestApplication, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { type NestExpressApplication } from '@nestjs/platform-express';

import { EnvironmentVariables } from './config/environment';
import { configureFrontend } from './frontend/configure-frontend';

const apiPrefix = 'api';

export function applyApiPrefix(app: INestApplication): void {
  app.setGlobalPrefix(apiPrefix, {
    exclude: [{ path: 'health', method: RequestMethod.GET }]
  });
}

async function bootstrap(): Promise<void> {
  const { AppModule } = (await import('./app.module.js')) as typeof import('./app.module.js');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const configService = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  const port = configService.get('PORT', { infer: true });
  const logger = app.get(ConsoleLogger);

  app.useLogger(logger);
  configureFrontend(app);
  applyApiPrefix(app);
  await app.listen(port);

  logger.log('API listening', { port });
}

if (require.main === module) {
  void bootstrap();
}
