import { z } from 'zod';

export const updateProjectSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    repositoryUrl: z.string().trim().max(2048).nullable().optional()
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one supported project field is required'
  });

export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;
