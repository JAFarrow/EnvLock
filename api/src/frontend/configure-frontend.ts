import { join } from 'node:path';

import { type NestExpressApplication } from '@nestjs/platform-express';
import { type NextFunction, type Request, type Response } from 'express';

export function configureFrontend(app: NestExpressApplication): void {
  app.use((request: Request, response: Response, next: NextFunction): void => {
    if (request.path === '/') {
      response.redirect('/login');
      return;
    }

    next();
  });

  app.useStaticAssets(join(__dirname), {
    extensions: ['html'],
    index: false
  });
}
