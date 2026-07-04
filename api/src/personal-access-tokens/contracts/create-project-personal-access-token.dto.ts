import { z } from 'zod';

export const createProjectPersonalAccessTokenSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  expiresAt: z.iso.datetime()
});

export type CreateProjectPersonalAccessTokenDto = z.infer<
  typeof createProjectPersonalAccessTokenSchema
>;
