import { Module } from '@nestjs/common';

import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordHasher } from './password-hasher';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [AuthService, PasswordHasher]
})
export class AuthModule {}
