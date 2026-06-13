import { BadRequestException, Body, Controller, Post } from '@nestjs/common';

import { AuthService, type RegisteredUser } from './auth.service';
import { registerUserSchema } from './register-user.schema';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() body: unknown): Promise<RegisteredUser> {
    const result = registerUserSchema.safeParse(body);

    if (!result.success) {
      throw new BadRequestException({
        message: 'Invalid registration request',
        errors: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message
        }))
      });
    }

    return this.authService.register(result.data);
  }
}
