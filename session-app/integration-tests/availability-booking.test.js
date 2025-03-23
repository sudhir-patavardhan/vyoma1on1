/**
 * Integration tests for the Availability and Booking APIs
 * 
 * These tests verify the end-to-end flow of:
 * 1. Teacher creating availability slots
 * 2. Student viewing available slots
 * 3. Student booking a slot
 * 4. Both parties viewing their bookings
 */

const { 
  apiClient, 
  authenticateTestUser, 
  configureAuthenticatedClient,
  generateTestData,
  wait
} = require('./setup');

// Test user credentials
const TEACHER_USER = {
  USERNAME: process.env.TEST_TEACHER_USERNAME || 'test_teacher@example.com',
  PASSWORD: process.env.TEST_TEACHER_PASSWORD || 'Test@password123!'
};

const STUDENT_USER = {
  USERNAME: process.env.TEST_STUDENT_USERNAME || 'test_student@example.com',
  PASSWORD: process.env.TEST_STUDENT_PASSWORD || 'Test@password123!'
};

describe('Availability and Booking API Integration Tests', () => {
  let teacherToken;
  let teacherClient;
  let teacherId;
  
  let studentToken;
  let studentClient;
  let studentId;
  
  let createdAvailabilityId;
  let createdBookingId;
  
  // Set up test data
  const testData = generateTestData();
  
  // Before all tests, authenticate both teacher and student users
  beforeAll(async () => {
    try {
      // Authenticate teacher
      if (process.env.TEST_TEACHER_TOKEN) {
        teacherToken = process.env.TEST_TEACHER_TOKEN;
        teacherId = process.env.TEST_TEACHER_ID;
      } else {
        const authResult = await authenticateTestUser(TEACHER_USER.USERNAME, TEACHER_USER.PASSWORD);
        teacherToken = authResult.accessToken;
        
        // Parse JWT to get teacher ID
        const tokenParts = teacherToken.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
          teacherId = payload.sub;
        }
      }
      teacherClient = configureAuthenticatedClient(teacherToken);
      
      // Authenticate student
      if (process.env.TEST_STUDENT_TOKEN) {
        studentToken = process.env.TEST_STUDENT_TOKEN;
        studentId = process.env.TEST_STUDENT_ID;
      } else {
        const authResult = await authenticateTestUser(STUDENT_USER.USERNAME, STUDENT_USER.PASSWORD);
        studentToken = authResult.accessToken;
        
        // Parse JWT to get student ID
        const tokenParts = studentToken.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
          studentId = payload.sub;
        }
      }
      studentClient = configureAuthenticatedClient(studentToken);
      
      console.log(`Test setup completed: Teacher ID ${teacherId}, Student ID ${studentId}`);
    } catch (error) {
      console.error('Setup failed:', error);
      throw error;
    }
  }, 30000);

  // Teacher creates an availability slot
  test('POST /availability - Teacher creates availability slot', async () => {
    // Create a slot for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0); // 10:00 AM
    
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(11, 0, 0, 0); // 11:00 AM
    
    const availabilityData = {
      teacher_id: teacherId,
      start_time: tomorrow.toISOString(),
      end_time: tomorrowEnd.toISOString(),
      topic: 'Integration Test Lesson',
      description: 'This is a test availability slot created by integration tests',
      price: 1000,
      currency: 'INR'
    };
    
    try {
      const response = await teacherClient.post('/availability', availabilityData);
      
      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('availability_id');
      expect(response.data.availability).toHaveProperty('teacher_id', teacherId);
      expect(response.data.availability).toHaveProperty('topic', 'Integration Test Lesson');
      expect(response.data.availability).toHaveProperty('status', 'available');
      
      // Save the created availability ID for future tests
      createdAvailabilityId = response.data.availability_id;
      console.log(`Created availability slot with ID: ${createdAvailabilityId}`);
    } catch (error) {
      console.error('Error creating availability:', error.response?.data || error.message);
      throw error;
    }
  });

  // Student views available slots
  test('GET /availability - Student views available slots', async () => {
    // Wait a moment to ensure availability is propagated
    await wait(1000);
    
    const response = await studentClient.get('/availability');
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);
    
    // Look for our created availability slot
    const createdSlot = response.data.find(slot => slot.availability_id === createdAvailabilityId);
    expect(createdSlot).toBeTruthy();
    expect(createdSlot).toHaveProperty('teacher_id', teacherId);
    expect(createdSlot).toHaveProperty('topic', 'Integration Test Lesson');
  });

  // Student views teacher-specific availability
  test('GET /availability?teacher_id - Student views specific teacher\'s availability', async () => {
    const response = await studentClient.get(`/availability?teacher_id=${teacherId}`);
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);
    
    // All slots should belong to the specified teacher
    response.data.forEach(slot => {
      expect(slot.teacher_id).toBe(teacherId);
    });
    
    // Look for our created availability slot
    const createdSlot = response.data.find(slot => slot.availability_id === createdAvailabilityId);
    expect(createdSlot).toBeTruthy();
  });

  // Student books the created slot
  test('POST /bookings - Student books the availability slot', async () => {
    const bookingData = {
      student_id: studentId,
      availability_id: createdAvailabilityId,
      notes: 'This is a test booking from integration tests'
    };
    
    try {
      const response = await studentClient.post('/bookings', bookingData);
      
      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('booking_id');
      expect(response.data.booking).toHaveProperty('student_id', studentId);
      expect(response.data.booking).toHaveProperty('teacher_id', teacherId);
      expect(response.data.booking).toHaveProperty('status', 'booked');
      
      // Save the booking ID for future tests
      createdBookingId = response.data.booking_id;
      console.log(`Created booking with ID: ${createdBookingId}`);
    } catch (error) {
      console.error('Error creating booking:', error.response?.data || error.message);
      throw error;
    }
  });

  // Student views their bookings
  test('GET /bookings?student_id - Student views their bookings', async () => {
    // Wait a moment to ensure booking is propagated
    await wait(1000);
    
    const response = await studentClient.get(`/bookings?student_id=${studentId}`);
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);
    
    // Look for our created booking
    const createdBooking = response.data.find(booking => booking.booking_id === createdBookingId);
    expect(createdBooking).toBeTruthy();
    expect(createdBooking).toHaveProperty('student_id', studentId);
    expect(createdBooking).toHaveProperty('teacher_id', teacherId);
  });

  // Teacher views their bookings
  test('GET /bookings?teacher_id - Teacher views their bookings', async () => {
    const response = await teacherClient.get(`/bookings?teacher_id=${teacherId}`);
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);
    
    // Look for our created booking
    const createdBooking = response.data.find(booking => booking.booking_id === createdBookingId);
    expect(createdBooking).toBeTruthy();
    expect(createdBooking).toHaveProperty('student_id', studentId);
    expect(createdBooking).toHaveProperty('teacher_id', teacherId);
  });
});