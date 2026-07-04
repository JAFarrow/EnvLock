import { z } from 'zod';

export const createPersonalAccessTokenSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  expiresAt: z.iso.datetime()
});

export type CreatePersonalAccessTokenDto = z.infer<typeof createPersonalAccessTokenSchema>;
