import { z } from 'zod';

const environmentSlugSchema = z
  .string()
  .trim()
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid environment slug');

export const createEnvironmentSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
  slug: environmentSlugSchema,
  description: z.string().trim().max(500).nullable().optional()
});

export type CreateEnvironmentDto = z.infer<typeof createEnvironmentSchema>;
