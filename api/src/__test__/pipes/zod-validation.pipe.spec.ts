import { BadRequestException, Logger } from '@nestjs/common';
import { z } from 'zod';

import { ZodValidationPipe } from '../../pipes/zod-validation.pipe';

describe('ZodValidationPipe', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns parsed and transformed values', () => {
    const pipe = new ZodValidationPipe(
      z.strictObject({ email: z.string().trim().toLowerCase().pipe(z.email()) }),
      'Invalid request'
    );

    expect(pipe.transform({ email: ' User@Example.COM ' })).toEqual({
      email: 'user@example.com'
    });
  });

  it('rejects invalid values with formatted errors', () => {
    const pipe = new ZodValidationPipe(
      z.strictObject({ key: z.string().regex(/^[A-Z_][A-Z0-9_]*$/) }),
      'Invalid secret request'
    );

    expect(() => pipe.transform({ key: 'database-url' })).toThrow(BadRequestException);
  });

  it('rejects unexpected properties for strict schemas', () => {
    const pipe = new ZodValidationPipe(
      z.strictObject({ key: z.string() }),
      'Invalid secret request'
    );

    expect(() => pipe.transform({ key: 'DATABASE_URL', value: 'not allowed' })).toThrow(
      BadRequestException
    );
  });
});
