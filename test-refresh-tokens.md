# Refresh Token Management Test Guide

This guide demonstrates how to test the new refresh token management system.

## New Features

### 1. Multiple Refresh Tokens per User
- Users can now have multiple active refresh tokens (different devices)
- Each token is stored separately in the `refresh_tokens` table
- Tokens are properly hashed and indexed for security and performance

### 2. Token Rotation
- When refreshing tokens, the old token is revoked and a new one is issued
- This prevents token replay attacks

### 3. Enhanced Logout Options
- `POST /auth/logout` - Logout from all devices
- `POST /auth/logout-device` - Logout from current device only
- `POST /auth/logout-all` - Logout from all devices (explicit)

### 4. Session Management
- `POST /auth/active-sessions` - View all active sessions

## API Endpoints

### Login
```bash
POST /auth/login
{
  "username": "your_username",
  "password": "your_password"
}
```
Returns: `{ "accessToken": "...", "refreshToken": "..." }`

### Refresh Token
```bash
POST /auth/refresh
{
  "refresh_token": "your_refresh_token"
}
```
Returns: `{ "accessToken": "...", "refreshToken": "..." }` (new tokens)

### Logout from Current Device
```bash
POST /auth/logout-device
{
  "refresh_token": "your_refresh_token"
}
```

### Logout from All Devices
```bash
POST /auth/logout-all
Authorization: Bearer your_access_token
```

### View Active Sessions
```bash
POST /auth/active-sessions
Authorization: Bearer your_access_token
```

## Database Changes

### New RefreshToken Model
```prisma
model RefreshToken {
  id        String   @id @default(uuid())
  userId    Int
  tokenHash String
  expiresAt DateTime
  createdAt DateTime @default(now())
  revokedAt DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, tokenHash])
  @@map("refresh_tokens")
}
```

### User Model Updated
- Added `refreshTokens RefreshToken[]` relation
- The old `hashedRefreshToken` field is still present but no longer used

## Security Improvements

1. **Token Hashing**: Refresh tokens are hashed before storage
2. **Expiration Handling**: Tokens have proper expiration dates (7 days)
3. **Token Rotation**: Old tokens are revoked when new ones are issued
4. **Selective Logout**: Users can logout from specific devices
5. **Cleanup**: Expired tokens can be cleaned up periodically

## Testing Steps

1. **Login** - Get access and refresh tokens
2. **Use Refresh Token** - Exchange refresh token for new tokens
3. **Login from Multiple Devices** - Simulate multiple sessions
4. **View Active Sessions** - See all active tokens
5. **Logout from One Device** - Revoke specific token
6. **Logout from All Devices** - Revoke all tokens

## Migration Applied

The database migration `20250814062358_add_refresh_token_model` has been applied, creating the new `refresh_tokens` table with proper indexes.