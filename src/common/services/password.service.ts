import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class PasswordService {
  private readonly SALT_ROUNDS = 12; // OWASP recommendation

  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async hashRandom(): Promise<{ hashToken: string; resetToken: string }> {
    const randomString = crypto.randomBytes(16).toString('hex');
    return {
      hashToken: await this.hash(randomString),
      resetToken: randomString,
    };
  }
}
