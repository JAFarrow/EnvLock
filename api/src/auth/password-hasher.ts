import { Injectable } from '@nestjs/common';
import { hash } from 'argon2';

@Injectable()
export class PasswordHasher {
  hash(password: string): Promise<string> {
    return hash(password);
  }
}
