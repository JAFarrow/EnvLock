import { z } from 'zod';

export const loginUserSchema = z.strictObject({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1)
});

export type LoginUserInput = z.infer<typeof loginUserSchema>;
