import { z } from 'zod';

const environmentSlugSchema = z
  .string()
  .trim()
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid environment slug');

export const updateEnvironmentSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(80).optional(),
    slug: environmentSlugSchema.optional(),
    description: z.string().trim().max(500).nullable().optional()
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one supported environment field is required'
  });

export type UpdateEnvironmentDto = z.infer<typeof updateEnvironmentSchema>;
