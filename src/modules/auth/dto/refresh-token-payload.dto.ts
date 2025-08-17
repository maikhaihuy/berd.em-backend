export class RefreshTokenPayloadDto {
  sub: number; // User ID
  email: string;
  roles: string[];
  iat?: number; // Issued at
  exp?: number; // Expires at
  jti?: string; // JWT ID (for refresh tokens)
}
