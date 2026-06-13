import { Injectable } from '@nestjs/common';
import { hash, verify } from 'argon2';

@Injectable()
export class PasswordHasher {
  hash(password: string): Promise<string> {
    return hash(password);
  }

  verify(hash: string, password: string): Promise<boolean> {
    return verify(hash, password);
  }
}
