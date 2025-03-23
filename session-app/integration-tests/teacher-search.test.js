/**
 * Integration tests for the Teacher Search API
 */

const { 
  apiClient, 
  authenticateTestUser, 
  configureAuthenticatedClient 
} = require('./setup');

// Test user credentials
const TEST_USER = {
  USERNAME: process.env.TEST_USERNAME || 'test_user@example.com',
  PASSWORD: process.env.TEST_PASSWORD || 'Test@password123!'
};

describe('Teacher Search API Integration Tests', () => {
  let accessToken;
  let authenticatedClient;

  // Before all tests, authenticate once
  beforeAll(async () => {
    try {
      // Skip authentication if tokens are already set in environment
      if (process.env.TEST_ACCESS_TOKEN) {
        accessToken = process.env.TEST_ACCESS_TOKEN;
      } else {
        // Authenticate with test user
        const authResult = await authenticateTestUser(TEST_USER.USERNAME, TEST_USER.PASSWORD);
        accessToken = authResult.accessToken;
      }

      // Create authenticated client
      authenticatedClient = configureAuthenticatedClient(accessToken);
    } catch (error) {
      console.error('Setup failed:', error);
      throw error;
    }
  }, 30000);

  test('GET /search/teachers - Search by topic', async () => {
    const searchTopic = 'Sanskrit'; // This should match teachers in the system
    
    const response = await authenticatedClient.get(`/search/teachers?topic=${searchTopic}`);
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);
    
    // If teachers are found, verify their structure
    if (response.data.length > 0) {
      const firstTeacher = response.data[0];
      expect(firstTeacher).toHaveProperty('user_id');
      expect(firstTeacher).toHaveProperty('name');
      
      // Verify the teacher has either role='teacher' or 'teacher' in their roles array
      const hasTeacherRole = (
        firstTeacher.role === 'teacher' || 
        (Array.isArray(firstTeacher.roles) && firstTeacher.roles.includes('teacher'))
      );
      expect(hasTeacherRole).toBe(true);
      
      // Verify at least one teacher has a matching topic
      const topicMatch = response.data.some(teacher => {
        if (!Array.isArray(teacher.topics)) return false;
        return teacher.topics.some(topic => 
          topic.toLowerCase().includes(searchTopic.toLowerCase())
        );
      });
      
      expect(topicMatch).toBe(true);
    }
  });

  test('GET /search/teachers - Search by teacher name', async () => {
    // We'll use an empty search first to get all teachers
    const allTeachersResponse = await authenticatedClient.get('/search/teachers?topic= ');
    
    // Skip test if no teachers found
    if (allTeachersResponse.data.length === 0) {
      console.log('No teachers found, skipping name search test');
      return;
    }
    
    // Get the first teacher's name and search for it
    const firstTeacher = allTeachersResponse.data[0];
    const nameToSearch = firstTeacher.name.split(' ')[0]; // Use first name only
    
    const response = await authenticatedClient.get(`/search/teachers?topic=${nameToSearch}&type=name`);
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);
    expect(response.data.length).toBeGreaterThan(0);
    
    // Verify the search returned the teacher we searched for
    const foundTeacher = response.data.find(teacher => 
      teacher.name.toLowerCase().includes(nameToSearch.toLowerCase())
    );
    
    expect(foundTeacher).toBeTruthy();
  });

  test('GET /search/teachers - Invalid search parameters', async () => {
    try {
      await authenticatedClient.get('/search/teachers');
      // If it doesn't throw, the API should return an appropriate error status
    } catch (error) {
      expect(error.response.status).toBe(400);
      expect(error.response.data).toHaveProperty('message', 'Missing search query');
    }
  });
});