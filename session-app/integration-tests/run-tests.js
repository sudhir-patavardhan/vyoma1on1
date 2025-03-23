#!/usr/bin/env node

/**
 * Integration Test Runner
 * 
 * This script runs the integration tests with the appropriate configuration
 * Usage:
 *   node run-tests.js [--env=production|local] [--debug] [--test=<test-file>]
 */

const { spawn } = require('child_process');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
let env = 'production';
let debug = false;
let testFile = null;

for (const arg of args) {
  if (arg.startsWith('--env=')) {
    env = arg.split('=')[1];
  } else if (arg === '--debug') {
    debug = true;
  } else if (arg.startsWith('--test=')) {
    testFile = arg.split('=')[1];
  }
}

// Validate environment
if (!['production', 'local'].includes(env)) {
  console.error(`Invalid environment: ${env}`);
  console.error('Valid options are: production, local');
  process.exit(1);
}

// Configure Jest command
const jestBin = path.resolve('./node_modules/.bin/jest');
const testPath = testFile ? path.resolve(`./integration-tests/${testFile}`) : './integration-tests';

// Set up environment variables for the test run
const env_vars = {
  ...process.env,
  TEST_ENV: env,
  NODE_ENV: 'test',
};

if (debug) {
  env_vars.DEBUG = 'true';
}

// Construct Jest arguments
const jestArgs = [
  testPath,
  '--verbose',
  '--detectOpenHandles'
];

// If a specific test file was specified, add the run-in-band option
if (testFile) {
  jestArgs.push('--runInBand');
}

console.log(`Running integration tests against ${env} environment`);
if (testFile) console.log(`Testing specific file: ${testFile}`);
if (debug) console.log('Debug mode enabled');

// Spawn Jest as a child process
const jestProcess = spawn(jestBin, jestArgs, { 
  env: env_vars,
  stdio: 'inherit' 
});

// Handle process exit
jestProcess.on('close', (code) => {
  if (code !== 0) {
    console.error(`Tests failed with exit code ${code}`);
    process.exit(code);
  } else {
    console.log('All tests passed!');
  }
});