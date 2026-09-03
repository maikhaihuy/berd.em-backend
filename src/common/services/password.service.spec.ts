import { PasswordService } from './password.service';

describe('PasswordService.generateOneTimeCredential', () => {
  const service = new PasswordService();
  const ALLOWED_CHARS = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/;

  it('generates an 8-character password drawn only from the unambiguous alphabet', async () => {
    const { password } = await service.generateOneTimeCredential();
    expect(password).toHaveLength(8);
    expect(password).toMatch(ALLOWED_CHARS);
  });

  it('never includes visually ambiguous characters', async () => {
    const { password } = await service.generateOneTimeCredential();
    expect(password).not.toMatch(/[0O1IL]/);
  });

  it('returns a bcrypt hash that verifies against the plaintext password', async () => {
    const { password, hash } = await service.generateOneTimeCredential();
    await expect(service.compare(password, hash)).resolves.toBe(true);
  });

  it('is not deterministic — repeated calls produce different passwords', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => service.generateOneTimeCredential()),
    );
    const passwords = new Set(results.map((r) => r.password));
    expect(passwords.size).toBe(results.length);
  });
});
