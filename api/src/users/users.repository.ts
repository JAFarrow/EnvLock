import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User, type UserStatus } from './user.entity';

export interface CreateUserRecord {
  email: string;
  passwordHash: string;
  status?: UserStatus;
}

@Injectable()
export class UsersRepository {
  constructor(@InjectRepository(User) private readonly repository: Repository<User>) {}

  create(input: CreateUserRecord): Promise<User> {
    const user = this.repository.create({
      email: input.email,
      passwordHash: input.passwordHash,
      status: input.status ?? 'pending'
    });

    return this.repository.save(user);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repository.findOneBy({ email });
  }

  findById(id: string): Promise<User | null> {
    return this.repository.findOneBy({ id });
  }
}
