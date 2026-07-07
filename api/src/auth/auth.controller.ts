import { Body, Controller, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Response } from 'express';

import { EnvironmentVariables } from '../config/environment';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import { AuthService, type LoginResult, type RegisteredUser } from './auth.service';
import { loginUserSchema, type LoginUserInput } from './contracts/login-user.schema';
import { registerUserSchema, type RegisterUserInput } from './contracts/register-user.schema';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService<EnvironmentVariables, true>
  ) {}

  @Post('register')
  register(
    @Body(new ZodValidationPipe(registerUserSchema, 'Invalid registration request'))
    input: RegisterUserInput
  ): Promise<RegisteredUser> {
    return this.authService.register(input);
  }

  @Post('login')
  async login(
    @Body(new ZodValidationPipe(loginUserSchema, 'Invalid login request')) input: LoginUserInput,
    @Res({ passthrough: true }) response: Response
  ): Promise<LoginResult> {
    const result = await this.authService.login(input);
    const nodeEnv = this.configService.get('NODE_ENV', { infer: true });
    const cookieName = this.configService.get('JWT_ACCESS_TOKEN_COOKIE_NAME', { infer: true });

    response.cookie(cookieName, result.accessToken, {
      httpOnly: true,
      maxAge: result.expiresIn * 1000,
      path: '/',
      sameSite: 'lax',
      secure: nodeEnv === 'production'
    });

    return result;
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response): { success: true } {
    const nodeEnv = this.configService.get('NODE_ENV', { infer: true });
    const cookieName = this.configService.get('JWT_ACCESS_TOKEN_COOKIE_NAME', { infer: true });

    response.clearCookie(cookieName, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: nodeEnv === 'production'
    });

    return { success: true };
  }
}
