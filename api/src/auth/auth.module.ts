import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { EnvironmentVariables } from '../config/environment';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PasswordHasher } from './password/password-hasher';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<EnvironmentVariables, true>) => ({
        secret: configService.get('JWT_SECRET', { infer: true }),
        signOptions: {
          expiresIn: configService.get('JWT_ACCESS_TOKEN_TTL_SECONDS', { infer: true })
        }
      })
    })
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordHasher, JwtStrategy, JwtAuthGuard],
  exports: [JwtAuthGuard]
})
export class AuthModule {}
