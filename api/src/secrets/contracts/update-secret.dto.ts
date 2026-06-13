import { z } from 'zod';

const secretKeySchema = z
  .string()
  .max(255)
  .regex(/^[A-Z_][A-Z0-9_]*$/, 'Invalid secret key');

export const updateSecretSchema = z
  .strictObject({
    key: secretKeySchema.optional(),
    value: z.string().optional()
  })
  .refine((value) => value.key !== undefined || value.value !== undefined, {
    message: 'At least one supported secret field is required'
  });

export type UpdateSecretDto = z.infer<typeof updateSecretSchema>;
