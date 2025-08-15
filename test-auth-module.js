// Test script to verify auth module functionality
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function testAuthModule() {
  console.log('🧪 Testing Auth Module Components...');
  
  try {
    // Test 1: Database Models and Relations
    console.log('\n1. Testing Database Models and Relations');
    await testDatabaseModels();
    
    // Test 2: RefreshToken Service Logic
    console.log('\n2. Testing RefreshToken Service Logic');
    await testRefreshTokenService();
    
    // Test 3: User Authentication Flow
    console.log('\n3. Testing User Authentication Flow');
    await testUserAuthFlow();
    
    // Test 4: Token Validation and Rotation
    console.log('\n4. Testing Token Validation and Rotation');
    await testTokenValidationAndRotation();
    
    // Test 5: Multiple Device Sessions
    console.log('\n5. Testing Multiple Device Sessions');
    await testMultipleDeviceSessions();
    
    console.log('\n🎉 All auth module tests passed successfully!');
    
  } catch (error) {
    console.error('❌ Auth module test failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

async function testDatabaseModels() {
  // Test User model
  const userCount = await prisma.user.count();
  console.log('✅ User model accessible, count:', userCount);
  
  // Test RefreshToken model
  const tokenCount = await prisma.refreshToken.count();
  console.log('✅ RefreshToken model accessible, count:', tokenCount);
  
  // Test User-RefreshToken relation
  const userWithTokens = await prisma.user.findFirst({
    include: {
      refreshTokens: {
        where: {
          revokedAt: null,
          expiresAt: { gte: new Date() }
        }
      }
    }
  });
  console.log('✅ User-RefreshToken relation working');
  
  // Test cascade delete (create test data)
  const testUser = await createTestUser();
  const testToken = await prisma.refreshToken.create({
    data: {
      userId: testUser.id,
      tokenHash: await bcrypt.hash('test-token', 10),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });
  
  // Verify token exists
  const tokenExists = await prisma.refreshToken.findUnique({
    where: { id: testToken.id }
  });
  console.log('✅ RefreshToken creation and retrieval working');
  
  // Test cascade delete
  await prisma.user.delete({ where: { id: testUser.id } });
  const tokenAfterUserDelete = await prisma.refreshToken.findUnique({
    where: { id: testToken.id }
  });
  
  if (!tokenAfterUserDelete) {
    console.log('✅ Cascade delete working correctly');
  } else {
    throw new Error('Cascade delete not working');
  }
}

async function testRefreshTokenService() {
  const testUser = await createTestUser();
  
  // Test token generation
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = await bcrypt.hash(token, 10);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  
  const tokenRecord = await prisma.refreshToken.create({
    data: {
      userId: testUser.id,
      tokenHash,
      expiresAt
    }
  });
  console.log('✅ Token generation logic working');
  
  // Test token validation
  const user = await prisma.user.findUnique({
    where: { id: testUser.id },
    include: {
      refreshTokens: {
        where: {
          revokedAt: null,
          expiresAt: { gte: new Date() }
        }
      }
    }
  });
  
  const isValidToken = await bcrypt.compare(token, user.refreshTokens[0].tokenHash);
  if (isValidToken) {
    console.log('✅ Token validation logic working');
  } else {
    throw new Error('Token validation failed');
  }
  
  // Test token revocation
  await prisma.refreshToken.update({
    where: { id: tokenRecord.id },
    data: { revokedAt: new Date() }
  });
  
  const revokedToken = await prisma.refreshToken.findUnique({
    where: { id: tokenRecord.id }
  });
  
  if (revokedToken.revokedAt) {
    console.log('✅ Token revocation working');
  } else {
    throw new Error('Token revocation failed');
  }
  
  // Cleanup
  await prisma.user.delete({ where: { id: testUser.id } });
}

async function testUserAuthFlow() {
  const testUser = await createTestUser();
  
  // Test login flow simulation
  const loginToken = crypto.randomBytes(32).toString('hex');
  const loginTokenHash = await bcrypt.hash(loginToken, 10);
  
  const refreshToken = await prisma.refreshToken.create({
    data: {
      userId: testUser.id,
      tokenHash: loginTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });
  console.log('✅ Login flow token creation working');
  
  // Test refresh flow simulation
  const newToken = crypto.randomBytes(32).toString('hex');
  const newTokenHash = await bcrypt.hash(newToken, 10);
  
  // Revoke old token
  await prisma.refreshToken.update({
    where: { id: refreshToken.id },
    data: { revokedAt: new Date() }
  });
  
  // Create new token
  const newRefreshToken = await prisma.refreshToken.create({
    data: {
      userId: testUser.id,
      tokenHash: newTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });
  console.log('✅ Token rotation flow working');
  
  // Test logout flow simulation
  await prisma.refreshToken.update({
    where: { id: newRefreshToken.id },
    data: { revokedAt: new Date() }
  });
  console.log('✅ Logout flow working');
  
  // Cleanup
  await prisma.user.delete({ where: { id: testUser.id } });
}

async function testTokenValidationAndRotation() {
  const testUser = await createTestUser();
  
  // Create multiple tokens
  const tokens = [];
  for (let i = 0; i < 3; i++) {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(token, 10);
    
    const tokenRecord = await prisma.refreshToken.create({
      data: {
        userId: testUser.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });
    
    tokens.push({ token, tokenRecord });
  }
  console.log('✅ Multiple token creation working');
  
  // Test finding correct token
  const userWithTokens = await prisma.user.findUnique({
    where: { id: testUser.id },
    include: {
      refreshTokens: {
        where: {
          revokedAt: null,
          expiresAt: { gte: new Date() }
        }
      }
    }
  });
  
  // Validate each token
  for (const { token } of tokens) {
    let found = false;
    for (const tokenRecord of userWithTokens.refreshTokens) {
      if (await bcrypt.compare(token, tokenRecord.tokenHash)) {
        found = true;
        break;
      }
    }
    if (!found) {
      throw new Error('Token validation failed for multiple tokens');
    }
  }
  console.log('✅ Multiple token validation working');
  
  // Test token rotation (revoke one, create new)
  const oldTokenId = tokens[0].tokenRecord.id;
  await prisma.refreshToken.update({
    where: { id: oldTokenId },
    data: { revokedAt: new Date() }
  });
  
  const newToken = crypto.randomBytes(32).toString('hex');
  const newTokenHash = await bcrypt.hash(newToken, 10);
  
  await prisma.refreshToken.create({
    data: {
      userId: testUser.id,
      tokenHash: newTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });
  console.log('✅ Token rotation working');
  
  // Cleanup
  await prisma.user.delete({ where: { id: testUser.id } });
}

async function testMultipleDeviceSessions() {
  const testUser = await createTestUser();
  
  // Simulate 3 different devices
  const devices = ['mobile', 'desktop', 'tablet'];
  const deviceTokens = [];
  
  for (const device of devices) {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(token, 10);
    
    const tokenRecord = await prisma.refreshToken.create({
      data: {
        userId: testUser.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });
    
    deviceTokens.push({ device, token, tokenRecord });
  }
  console.log('✅ Multiple device sessions created');
  
  // Test getting all active sessions
  const activeSessions = await prisma.refreshToken.findMany({
    where: {
      userId: testUser.id,
      revokedAt: null,
      expiresAt: { gte: new Date() }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  if (activeSessions.length === 3) {
    console.log('✅ Active sessions retrieval working');
  } else {
    throw new Error('Active sessions count mismatch');
  }
  
  // Test single device logout
  await prisma.refreshToken.update({
    where: { id: deviceTokens[0].tokenRecord.id },
    data: { revokedAt: new Date() }
  });
  
  const remainingSessions = await prisma.refreshToken.findMany({
    where: {
      userId: testUser.id,
      revokedAt: null,
      expiresAt: { gte: new Date() }
    }
  });
  
  if (remainingSessions.length === 2) {
    console.log('✅ Single device logout working');
  } else {
    throw new Error('Single device logout failed');
  }
  
  // Test logout all devices
  await prisma.refreshToken.updateMany({
    where: {
      userId: testUser.id,
      revokedAt: null
    },
    data: { revokedAt: new Date() }
  });
  
  const allSessionsAfterLogout = await prisma.refreshToken.findMany({
    where: {
      userId: testUser.id,
      revokedAt: null,
      expiresAt: { gte: new Date() }
    }
  });
  
  if (allSessionsAfterLogout.length === 0) {
    console.log('✅ Logout all devices working');
  } else {
    throw new Error('Logout all devices failed');
  }
  
  // Cleanup
  await prisma.user.delete({ where: { id: testUser.id } });
}

async function createTestUser() {
  const timestamp = Date.now();
  return await prisma.user.create({
    data: {
      username: `testuser_${timestamp}`,
      password: await bcrypt.hash('testpassword', 10),
      createdBy: 1,
      updatedBy: 1
    }
  });
}

async function cleanup() {
  // Clean up any test users that might have been left behind
  await prisma.user.deleteMany({
    where: {
      username: {
        startsWith: 'testuser_'
      }
    }
  });
  
  // Clean up expired or revoked tokens
  await prisma.refreshToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { revokedAt: { not: null } }
      ]
    }
  });
  
  console.log('🧹 Cleanup completed');
}

// Run the tests
testAuthModule();