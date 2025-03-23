/**
 * Integration Test Setup
 * 
 * This file contains the configuration and utilities needed for integration testing
 * against the production or staging environment from a local development setup.
 */

const axios = require('axios');
const AWS = require('aws-sdk');

// Configuration object for different environments
const config = {
  // Production environment
  production: {
    api: 'https://api.yoursanskritteacher.com',
    webapp: 'https://yoursanskritteacher.com',
    auth: {
      domain: 'https://auth.yoursanskritteacher.com',
      userPoolId: 'us-east-1_US1m8498L',
      clientId: '12s8brrk9144uq23g3951mfvhl',
    }
  },
  // Local development environment
  local: {
    api: 'http://localhost:3000',
    webapp: 'http://localhost:3000',
    auth: {
      domain: 'https://auth.yoursanskritteacher.com', // Auth still points to production
      userPoolId: 'us-east-1_US1m8498L',
      clientId: '12s8brrk9144uq23g3951mfvhl',
    }
  }
};

// Get environment from command line args or default to production
const env = process.env.TEST_ENV || 'production';
const testConfig = config[env];

if (!testConfig) {
  throw new Error(`Unknown test environment: ${env}. Valid options are: ${Object.keys(config).join(', ')}`);
}

// Create configured axios instance
const apiClient = axios.create({
  baseURL: testConfig.api,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Add response interceptor for debugging
apiClient.interceptors.response.use(
  response => {
    if (process.env.DEBUG) {
      console.log(`Response [${response.status}]:`, response.data);
    }
    return response;
  },
  error => {
    if (process.env.DEBUG && error.response) {
      console.error(`Error [${error.response.status}]:`, error.response.data);
    }
    return Promise.reject(error);
  }
);

/**
 * Utility function to authenticate with Cognito and get tokens
 * Note: For integration tests, this should use test user credentials
 * that are specifically created for testing purposes
 */
async function authenticateTestUser(username, password) {
  // Uses aws-sdk for Cognito authentication
  const cognito = new AWS.CognitoIdentityServiceProvider({
    region: 'us-east-1'
  });

  try {
    const authParams = {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: testConfig.auth.clientId,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password
      }
    };

    const authResult = await cognito.initiateAuth(authParams).promise();
    
    // Extract tokens from result
    const idToken = authResult.AuthenticationResult.IdToken;
    const accessToken = authResult.AuthenticationResult.AccessToken;
    const refreshToken = authResult.AuthenticationResult.RefreshToken;

    return {
      idToken,
      accessToken,
      refreshToken
    };
  } catch (error) {
    console.error('Authentication error:', error);
    throw error;
  }
}

/**
 * Utility to configure API client with authentication token
 */
function configureAuthenticatedClient(accessToken) {
  // Clone the existing client config
  const authenticatedClient = axios.create({
    ...apiClient.defaults,
    headers: {
      ...apiClient.defaults.headers,
      'Authorization': `Bearer ${accessToken}`
    }
  });

  // Copy the interceptors
  authenticatedClient.interceptors.response = apiClient.interceptors.response;

  return authenticatedClient;
}

/**
 * Utility to generate random test data
 */
function generateTestData() {
  const randomId = Math.random().toString(36).substring(2, 15);
  
  return {
    testStudentProfile: {
      name: `Test Student ${randomId}`,
      email: `test.student.${randomId}@example.com`,
      role: 'student',
      roles: ['student'],
      preferences: {
        topics: ['Beginner Sanskrit', 'Grammar Basics'],
        preferred_times: ['weekends', 'evenings']
      }
    },
    testTeacherProfile: {
      name: `Test Teacher ${randomId}`,
      email: `test.teacher.${randomId}@example.com`,
      role: 'teacher',
      roles: ['teacher'],
      bio: 'A test teacher profile for integration testing',
      topics: ['Beginner Sanskrit', 'Grammar', 'Conversation'],
      qualifications: ['PhD in Sanskrit']
    }
  };
}

/**
 * Utility to wait for a specified number of milliseconds
 */
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
  config: testConfig,
  apiClient,
  authenticateTestUser,
  configureAuthenticatedClient,
  generateTestData,
  wait
};