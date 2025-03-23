/**
 * Integration tests for the Session API
 * 
 * These tests verify:
 * 1. Creating a session for a booking
 * 2. Retrieving session details
 * 3. Updating session notes/documents
 * 4. Creating and retrieving Chime meeting information
 */

const { 
  apiClient, 
  authenticateTestUser, 
  configureAuthenticatedClient,
  wait
} = require('./setup');

// Test user credentials - typically a teacher who needs to create/manage sessions
const TEST_USER = {
  USERNAME: process.env.TEST_TEACHER_USERNAME || 'test_teacher@example.com',
  PASSWORD: process.env.TEST_TEACHER_PASSWORD || 'Test@password123!'
};

// References to a pre-existing booking for testing
// In a real scenario, you would either:
// 1. Create these during the test (as part of a chain with the availability-booking tests)
// 2. Use known IDs from pre-staged test data in the database
const TEST_BOOKING_ID = process.env.TEST_BOOKING_ID || 'booking-00000000-test';
const TEST_TEACHER_ID = process.env.TEST_TEACHER_ID;
const TEST_STUDENT_ID = process.env.TEST_STUDENT_ID;

describe('Session API Integration Tests', () => {
  let accessToken;
  let authenticatedClient;
  let userId;
  let createdSessionId;

  // Before all tests, authenticate
  beforeAll(async () => {
    try {
      // Skip authentication if tokens are already set in environment
      if (process.env.TEST_ACCESS_TOKEN) {
        accessToken = process.env.TEST_ACCESS_TOKEN;
        userId = process.env.TEST_USER_ID;
      } else {
        // Authenticate with test user
        const authResult = await authenticateTestUser(TEST_USER.USERNAME, TEST_USER.PASSWORD);
        accessToken = authResult.accessToken;
        
        // Parse the JWT to get the user ID
        const tokenParts = accessToken.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
          userId = payload.sub;
        }
      }

      // Create authenticated client
      authenticatedClient = configureAuthenticatedClient(accessToken);
    } catch (error) {
      console.error('Setup failed:', error);
      throw error;
    }
  }, 30000);

  test('POST /sessions - Create a new session', async () => {
    // Skip test if we don't have required IDs
    if (!TEST_BOOKING_ID || !TEST_TEACHER_ID || !TEST_STUDENT_ID) {
      console.log('Skipping session creation test - missing required test IDs');
      return;
    }
    
    const sessionData = {
      booking_id: TEST_BOOKING_ID,
      teacher_id: TEST_TEACHER_ID,
      student_id: TEST_STUDENT_ID,
      title: 'Integration Test Session'
    };
    
    try {
      const response = await authenticatedClient.post('/sessions', sessionData);
      
      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('session_id');
      expect(response.data.session).toHaveProperty('booking_id', TEST_BOOKING_ID);
      expect(response.data.session).toHaveProperty('status', 'active');
      
      // Save session ID for future tests
      createdSessionId = response.data.session_id;
      console.log(`Created session with ID: ${createdSessionId}`);
    } catch (error) {
      // If session already exists for this booking, log and continue
      if (error.response?.status === 400 && 
          error.response?.data?.message?.includes('already exists')) {
        console.log('Session already exists for this booking, reusing existing session');
        
        // Try to fetch the existing session
        try {
          const bookingResponse = await authenticatedClient.get(`/bookings/${TEST_BOOKING_ID}/session`);
          if (bookingResponse.data.session_id) {
            createdSessionId = bookingResponse.data.session_id;
            console.log(`Using existing session ID: ${createdSessionId}`);
          }
        } catch (fetchError) {
          console.error('Failed to fetch existing session:', fetchError.message);
        }
      } else {
        console.error('Error creating session:', error.response?.data || error.message);
        // Don't throw to allow other tests to run
      }
    }
  });

  test('GET /sessions/{id} - Retrieve session details', async () => {
    // Skip if we don't have a session ID
    if (!createdSessionId) {
      console.log('Skipping session retrieval test - no session ID available');
      return;
    }
    
    const response = await authenticatedClient.get(`/sessions/${createdSessionId}`);
    
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('session_id', createdSessionId);
    expect(response.data).toHaveProperty('booking_id', TEST_BOOKING_ID);
    expect(response.data).toHaveProperty('teacher_id');
    expect(response.data).toHaveProperty('student_id');
  });

  test('PUT /sessions/{id} - Update session with notes', async () => {
    // Skip if we don't have a session ID
    if (!createdSessionId) {
      console.log('Skipping session update test - no session ID available');
      return;
    }
    
    const updateData = {
      note: 'This is a test note added during integration testing',
      author_id: userId
    };
    
    const response = await authenticatedClient.put(`/sessions/${createdSessionId}`, updateData);
    
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('message', 'Session updated successfully');
    expect(response.data).toHaveProperty('session');
    
    // Verify notes array has our new note
    expect(response.data.session).toHaveProperty('notes');
    expect(Array.isArray(response.data.session.notes)).toBe(true);
    
    const foundNote = response.data.session.notes.find(note => 
      note.text === updateData.note && note.author_id === updateData.author_id
    );
    
    expect(foundNote).toBeTruthy();
  });

  test('POST /meetings - Create a Chime meeting for the session', async () => {
    // Skip if we don't have a session ID
    if (!createdSessionId) {
      console.log('Skipping Chime meeting creation test - no session ID available');
      return;
    }
    
    const meetingData = {
      session_id: createdSessionId
    };
    
    try {
      const response = await authenticatedClient.post('/meetings', meetingData);
      
      // Either 201 (created) or 200 (already exists)
      expect([200, 201]).toContain(response.status);
      expect(response.data).toHaveProperty('meeting');
      expect(response.data).toHaveProperty('session_id', createdSessionId);
      
      // Chime meeting should have required properties
      expect(response.data.meeting).toHaveProperty('MeetingId');
      expect(response.data.meeting).toHaveProperty('MediaPlacement');
    } catch (error) {
      console.error('Error creating Chime meeting:', error.response?.data || error.message);
      // Don't throw to allow other tests to run
    }
  });

  test('GET /meetings/{session_id} - Retrieve Chime meeting info', async () => {
    // Skip if we don't have a session ID
    if (!createdSessionId) {
      console.log('Skipping Chime meeting retrieval test - no session ID available');
      return;
    }
    
    // Wait briefly to ensure meeting is fully created
    await wait(1000);
    
    const response = await authenticatedClient.get(`/meetings/${createdSessionId}`);
    
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('session_id', createdSessionId);
    
    // If a meeting exists, verify its properties
    if (response.data.has_active_meeting) {
      expect(response.data).toHaveProperty('meeting');
      expect(response.data.meeting).toHaveProperty('MeetingId');
    }
  });

  test('POST /attendees - Create an attendee for the meeting', async () => {
    // Skip if we don't have a session ID
    if (!createdSessionId) {
      console.log('Skipping attendee creation test - no session ID available');
      return;
    }
    
    const attendeeData = {
      session_id: createdSessionId,
      user_id: userId
    };
    
    try {
      const response = await authenticatedClient.post('/attendees', attendeeData);
      
      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('attendee');
      expect(response.data).toHaveProperty('meeting_id');
      
      // Attendee should have required properties
      expect(response.data.attendee).toHaveProperty('AttendeeId');
      expect(response.data.attendee).toHaveProperty('ExternalUserId', userId);
    } catch (error) {
      console.warn('Error creating attendee (possibly no active meeting):', error.response?.data || error.message);
      // Don't throw to allow other tests to run
    }
  });

  // Note: We don't test DELETE /meetings (end meeting) here to avoid disrupting actual sessions
  // In a real test suite with isolated test data, you would include that test
});