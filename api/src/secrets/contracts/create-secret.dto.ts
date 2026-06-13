import { z } from 'zod';

const secretKeySchema = z
  .string()
  .max(255)
  .regex(/^[A-Z_][A-Z0-9_]*$/, 'Invalid secret key');

export const createSecretSchema = z.strictObject({
  key: secretKeySchema,
  value: z.string()
});

export type CreateSecretDto = z.infer<typeof createSecretSchema>;
