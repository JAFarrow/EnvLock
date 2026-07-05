import { join } from 'node:path';

import { type NestExpressApplication } from '@nestjs/platform-express';
import { type NextFunction, type Request, type Response } from 'express';

export function configureFrontend(app: NestExpressApplication): void {
  app.use((request: Request, response: Response, next: NextFunction): void => {
    if (request.path === '/') {
      response.redirect('/login');
      return;
    }

    const environmentDetailMatch = request.path.match(/^\/projects\/[^/]+\/environments\/[^/]+$/);

    if (environmentDetailMatch !== null) {
      response.sendFile(join(__dirname, 'environment.html'));
      return;
    }

    const projectSubpageMatch = request.path.match(
      /^\/projects\/[^/]+\/(environments|roles|pats)$/
    );

    const projectSubpage = projectSubpageMatch?.[1];

    if (projectSubpage !== undefined) {
      response.sendFile(join(__dirname, `${projectSubpage}.html`));
      return;
    }

    next();
  });

  app.useStaticAssets(join(__dirname), {
    extensions: ['html'],
    index: false
  });
}
