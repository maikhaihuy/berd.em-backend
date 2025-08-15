// Test script to verify refresh token system fixes
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testRefreshTokenModel() {
  try {
    console.log('Testing RefreshToken model access...');
    
    // Test 1: Check if RefreshToken model exists
    const refreshTokenCount = await prisma.refreshToken.count();
    console.log('✅ RefreshToken model accessible, count:', refreshTokenCount);
    
    // Test 2: Check if User.refreshTokens relation works
    const userWithTokens = await prisma.user.findFirst({
      include: {
        refreshTokens: true
      }
    });
    console.log('✅ User.refreshTokens relation working');
    
    // Test 3: Check if we can create a refresh token
    const testUser = await prisma.user.findFirst();
    if (testUser) {
      const testToken = await prisma.refreshToken.create({
        data: {
          userId: testUser.id,
          tokenHash: 'test-hash-' + Date.now(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        }
      });
      console.log('✅ RefreshToken creation working, ID:', testToken.id);
      
      // Clean up test token
      await prisma.refreshToken.delete({
        where: { id: testToken.id }
      });
      console.log('✅ RefreshToken deletion working');
    }
    
    console.log('\n🎉 All refresh token model tests passed!');
    
  } catch (error) {
    console.error('❌ Error testing refresh token model:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testRefreshTokenModel();