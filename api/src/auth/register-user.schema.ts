import { z } from 'zod';

export const registerUserSchema = z.strictObject({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(12)
});

export type RegisterUserInput = z.infer<typeof registerUserSchema>;
