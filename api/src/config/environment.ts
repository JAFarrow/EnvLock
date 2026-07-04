import { z } from 'zod';

const appLogFormats = ['pretty', 'json'] as const;

export type AppLogFormat = (typeof appLogFormats)[number];

function isValidBase64(value: string): boolean {
  return (
    value.length > 0 &&
    value.length % 4 === 0 &&
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  );
}

function hasValidSecretEncryptionKeyLength(value: string): boolean {
  return Buffer.from(value, 'base64').byteLength === 32;
}

export const environmentSchema = z
  .looseObject({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    LOG_FORMAT: z.enum(appLogFormats).optional(),
    DATABASE_URL: z.url().startsWith('postgres://').or(z.url().startsWith('postgresql://')),
    JWT_SECRET: z.string().min(1),
    JWT_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(1).default(3600),
    JWT_ACCESS_TOKEN_COOKIE_NAME: z.string().trim().min(1).default('envlock_access_token'),
    SECRET_ENCRYPTION_KEY_BASE64: z
      .string()
      .refine(isValidBase64, 'must be valid Base64')
      .refine(hasValidSecretEncryptionKeyLength, 'must decode to exactly 32 bytes'),
    SECRET_ENCRYPTION_KEY_VERSION: z.coerce.number().int().min(1)
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
