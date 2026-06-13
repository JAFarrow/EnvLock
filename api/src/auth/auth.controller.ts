import { BadRequestException, Body, Controller, Logger, Post } from '@nestjs/common';

import { AuthService, type LoginResult, type RegisteredUser } from './auth.service';
import { loginUserSchema } from './login-user.schema';
import { registerUserSchema } from './register-user.schema';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() body: unknown): Promise<RegisteredUser> {
    const result = registerUserSchema.safeParse(body);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message
      }));

      this.logger.warn('Registration request validation failed', {
        fields: errors.map((error) => error.path),
        issueCount: errors.length
      });

      throw new BadRequestException({
        message: 'Invalid registration request',
        errors
      });
    }

    return this.authService.register(result.data);
  }

  @Post('login')
  login(@Body() body: unknown): Promise<LoginResult> {
    const result = loginUserSchema.safeParse(body);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message
      }));

      this.logger.warn('Login request validation failed', {
        fields: errors.map((error) => error.path),
        issueCount: errors.length
      });

      throw new BadRequestException({
        message: 'Invalid login request',
        errors
      });
    }

    return this.authService.login(result.data);
  }
}
