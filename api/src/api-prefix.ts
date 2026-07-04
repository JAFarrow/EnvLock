import { type INestApplication, RequestMethod } from '@nestjs/common';

export const apiPrefix = 'api';

export function applyApiPrefix(app: INestApplication): void {
  app.setGlobalPrefix(apiPrefix, {
    exclude: [{ path: 'health', method: RequestMethod.GET }]
  });
}
