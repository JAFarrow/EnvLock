import { z } from 'zod';

export const createProjectSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  repositoryUrl: z.string().trim().max(2048).nullable().optional()
});

export type CreateProjectDto = z.infer<typeof createProjectSchema>;
