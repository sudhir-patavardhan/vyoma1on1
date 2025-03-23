/**
 * Integration tests for the Profile API
 */

const { 
  apiClient, 
  authenticateTestUser, 
  configureAuthenticatedClient, 
  generateTestData 
} = require('./setup');

// Test user credentials - IMPORTANT: Use environment variables in a real setup
// These would be specific test users created for integration testing
const TEST_USER = {
  USERNAME: process.env.TEST_USERNAME || 'test_user@example.com',
  PASSWORD: process.env.TEST_PASSWORD || 'Test@password123!'
};

describe('Profile API Integration Tests', () => {
  let accessToken;
  let authenticatedClient;
  let userId;
  let testData;

  // Before all tests, authenticate once
  beforeAll(async () => {
    try {
      // Skip authentication if tokens are already set in environment (for CI environments)
      if (process.env.TEST_ACCESS_TOKEN) {
        accessToken = process.env.TEST_ACCESS_TOKEN;
        userId = process.env.TEST_USER_ID;
      } else {
        // Authenticate with test user
        const authResult = await authenticateTestUser(TEST_USER.USERNAME, TEST_USER.PASSWORD);
        accessToken = authResult.accessToken;
        
        // Parse the JWT to get the user ID (sub claim)
        const tokenParts = accessToken.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
          userId = payload.sub;
        }
      }

      // Create authenticated client
      authenticatedClient = configureAuthenticatedClient(accessToken);
      
      // Generate random test data
      testData = generateTestData();
      
      console.log(`Authenticated as user: ${userId}`);
    } catch (error) {
      console.error('Setup failed:', error);
      throw error;
    }
  }, 30000); // Longer timeout for authentication

  test('GET /profiles - Unauthenticated request should fail', async () => {
    expect.assertions(1);
    
    try {
      await apiClient.get(`/profiles?user_id=${userId}`);
    } catch (error) {
      expect(error.response.status).toBe(401);
    }
  });

  test('GET /profiles - Authenticated request should succeed', async () => {
    // This test may fail if the user doesn't have a profile yet
    try {
      const response = await authenticatedClient.get(`/profiles?user_id=${userId}`);
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('profile');
      expect(response.data.profile).toHaveProperty('user_id', userId);
    } catch (error) {
      // If profile doesn't exist yet, expect 404
      expect(error.response.status).toBe(404);
      expect(error.response.data).toHaveProperty('message', 'User profile not found.');
    }
  });

  test('POST /profiles - Create/update user profile', async () => {
    // Get test profile data and add user_id
    const profileData = {
      ...testData.testStudentProfile,
      user_id: userId
    };

    // Create/update profile
    const response = await authenticatedClient.post('/profiles', profileData);
    
    expect(response.status).toBe(201);
    expect(response.data).toHaveProperty('profile');
    expect(response.data.profile).toHaveProperty('user_id', userId);
    expect(response.data.profile).toHaveProperty('name', profileData.name);
    expect(response.data.profile).toHaveProperty('role', profileData.role);
  });

  test('GET /profiles - Verify updated profile', async () => {
    const response = await authenticatedClient.get(`/profiles?user_id=${userId}`);
    
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('profile');
    expect(response.data.profile).toHaveProperty('user_id', userId);
    expect(response.data.profile).toHaveProperty('name', testData.testStudentProfile.name);
    expect(response.data.profile).toHaveProperty('role', testData.testStudentProfile.role);
  });
});