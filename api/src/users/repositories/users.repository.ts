import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User, type UserStatus } from '../entities/user.entity';

export interface CreateUserRecord {
  email: string;
  passwordHash: string;
  status?: UserStatus;
}

@Injectable()
export class UsersRepository {
  private readonly logger = new Logger(UsersRepository.name);

  constructor(@InjectRepository(User) private readonly repository: Repository<User>) {}

  async create(input: CreateUserRecord): Promise<User> {
    this.logger.debug('Creating user record', {
      email: input.email,
      status: input.status ?? 'pending'
    });

    const user = this.repository.create({
      email: input.email,
      passwordHash: input.passwordHash,
      status: input.status ?? 'pending'
    });

    const savedUser = await this.repository.save(user);

    this.logger.log('User record created', {
      userId: savedUser.id,
      email: savedUser.email,
      status: savedUser.status
    });

    return savedUser;
  }

  async findByEmail(email: string): Promise<User | null> {
    this.logger.debug('Finding user by email', { email });

    const user = await this.repository.findOneBy({ email });

    this.logger.debug('User lookup by email completed', {
      email,
      found: user !== null,
      userId: user?.id
    });

    return user;
  }
}
