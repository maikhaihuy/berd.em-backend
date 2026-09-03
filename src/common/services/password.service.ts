import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class PasswordService {
  private readonly SALT_ROUNDS = 12; // OWASP recommendation

  // Excludes visually ambiguous characters (0/O, 1/I/L) so an Admin can
  // relay a one-time credential verbally or on paper without transcription errors.
  private readonly ONE_TIME_CREDENTIAL_ALPHABET =
    'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  private readonly ONE_TIME_CREDENTIAL_LENGTH = 8;

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

  /**
   * Generates a random one-time password for initial account provisioning —
   * not derivable from any employee-supplied data, unlike a phone-derived default.
   */
  async generateOneTimeCredential(): Promise<{
    password: string;
    hash: string;
  }> {
    const password = this.randomAlphabetString(
      this.ONE_TIME_CREDENTIAL_ALPHABET,
      this.ONE_TIME_CREDENTIAL_LENGTH,
    );
    return { password, hash: await this.hash(password) };
  }

  // Rejection-samples bytes so each alphabet character has equal probability,
  // avoiding the modulo bias a plain `byte % alphabet.length` would introduce.
  private randomAlphabetString(alphabet: string, length: number): string {
    const maxValidByte = 256 - (256 % alphabet.length);
    let result = '';
    while (result.length < length) {
      const bytes = crypto.randomBytes(length - result.length);
      for (const byte of bytes) {
        if (byte < maxValidByte) {
          result += alphabet[byte % alphabet.length];
        }
      }
    }
    return result;
  }
}
