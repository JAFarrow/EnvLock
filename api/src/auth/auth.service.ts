import { ConflictException, Injectable } from '@nestjs/common';

import { type UserStatus } from '../users/user.entity';
import { UsersRepository } from '../users/users.repository';
import { PasswordHasher } from './password-hasher';
import { type RegisterUserInput } from './register-user.schema';

export interface RegisteredUser {
  id: string;
  email: string;
  status: UserStatus;
  createdAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly passwordHasher: PasswordHasher
  ) {}

  async register(input: RegisterUserInput): Promise<RegisteredUser> {
    const existingUser = await this.usersRepository.findByEmail(input.email);

    if (existingUser !== null) {
      throw new ConflictException('A user with that email already exists');
    }

    const passwordHash = await this.passwordHasher.hash(input.password);

    const user = await this.usersRepository.create({
      email: input.email,
      passwordHash,
      status: 'pending'
    });

    return {
      id: user.id,
      email: user.email,
      status: user.status,
      createdAt: user.createdAt
    };
  }
}
