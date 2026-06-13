import { Body, Controller, Post } from '@nestjs/common';

import { AuthService, type LoginResult, type RegisteredUser } from './auth.service';
import { loginUserSchema, type LoginUserInput } from './contracts/login-user.schema';
import { registerUserSchema, type RegisterUserInput } from './contracts/register-user.schema';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(
    @Body(new ZodValidationPipe(registerUserSchema, 'Invalid registration request'))
    input: RegisterUserInput
  ): Promise<RegisteredUser> {
    return this.authService.register(input);
  }

  @Post('login')
  login(
    @Body(new ZodValidationPipe(loginUserSchema, 'Invalid login request')) input: LoginUserInput
  ): Promise<LoginResult> {
    return this.authService.login(input);
  }
}
