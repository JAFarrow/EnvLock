import { type INestApplication, RequestMethod } from '@nestjs/common';

import { applyApiPrefix, applySecurityHeaders } from '../main';

describe('API bootstrap configuration', () => {
  it('applies the API prefix while leaving health unprefixed', () => {
    const setGlobalPrefix = jest.fn();
    const app = { setGlobalPrefix } as unknown as INestApplication;

    applyApiPrefix(app);

    expect(setGlobalPrefix).toHaveBeenCalledWith('api', {
      exclude: [{ path: 'health', method: RequestMethod.GET }]
    });
  });

  it('installs Helmet security headers', () => {
    const use = jest.fn();
    const app = { use } as unknown as INestApplication;

    applySecurityHeaders(app);

    expect(use).toHaveBeenCalledWith(expect.any(Function));
  });
});
