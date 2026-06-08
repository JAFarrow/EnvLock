import { z } from 'zod';

const appLogFormats = ['pretty', 'json'] as const;

export type AppLogFormat = (typeof appLogFormats)[number];

export const environmentSchema = z
  .looseObject({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    LOG_FORMAT: z.enum(appLogFormats).optional()
  })
  .transform((config) => ({
    ...config,
    LOG_FORMAT: config.LOG_FORMAT ?? (config.NODE_ENV === 'production' ? 'json' : 'pretty')
  }));

export type EnvironmentVariables = z.infer<typeof environmentSchema>;

export function validateEnvironment(config: Record<string, unknown>): EnvironmentVariables {
  const result = environmentSchema.safeParse(config);

  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(`Invalid environment configuration:\n${message}`);
  }

  return result.data;
}
