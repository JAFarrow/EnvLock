import { BadRequestException, Logger, type PipeTransform } from '@nestjs/common';
import { ZodError, type ZodType } from 'zod';

export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  private readonly logger = new Logger(ZodValidationPipe.name);

  constructor(
    private readonly schema: ZodType<T>,
    private readonly message: string
  ) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      const errors = formatZodErrors(result.error);

      this.logger.warn('Request validation failed', {
        fields: errors.map((error) => error.path),
        issueCount: errors.length
      });

      throw new BadRequestException({
        message: this.message,
        errors
      });
    }

    return result.data;
  }
}

function formatZodErrors(error: ZodError): { path: string; message: string }[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message
  }));
}
