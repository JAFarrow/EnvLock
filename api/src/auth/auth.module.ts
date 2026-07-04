import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EnvironmentVariables } from '../config/environment';
import { PersonalAccessTokenEntity } from '../personal-access-tokens/entities/personal-access-token.entity';
import { PersonalAccessTokenRepository } from '../personal-access-tokens/repositories/personal-access-token.repository';
import { ProjectMembershipEntity } from '../projects/entities/project-membership.entity';
import { ProjectMembershipsRepository } from '../projects/repositories/project-memberships.repository';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PersonalAccessTokenAuthGuard } from './guards/personal-access-token-auth.guard';
import { PasswordHasher } from './password/password-hasher';
import { PersonalAccessTokenAuthService } from './personal-access-token-auth.service';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([PersonalAccessTokenEntity, ProjectMembershipEntity]),
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
  providers: [
    AuthService,
    PasswordHasher,
    PersonalAccessTokenAuthService,
    PersonalAccessTokenRepository,
    ProjectMembershipsRepository,
    JwtAuthGuard,
    PersonalAccessTokenAuthGuard
  ],
  exports: [JwtModule, JwtAuthGuard, PersonalAccessTokenAuthGuard, PersonalAccessTokenAuthService]
})
export class AuthModule {}
