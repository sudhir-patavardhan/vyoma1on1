#!/usr/bin/env node

/**
 * This script updates the version.js file with build information
 * It's meant to be run during the build process
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get git commit hash if available
let gitCommit = 'dev';
try {
  gitCommit = execSync('git rev-parse --short HEAD').toString().trim();
} catch (e) {
  console.log('Unable to get git commit hash:', e.message);
}

// Generate build ID with timestamp
const timestamp = new Date().toISOString();
const buildId = `${gitCommit}-${Math.floor(Date.now() / 1000)}`;

// Create version information
const versionInfo = `// This file is auto-generated during the build process
const VERSION = {
  buildDate: "${timestamp}",
  buildId: "${buildId}",
  gitCommit: "${gitCommit}"
};

export default VERSION;
`;

// Path to version.js
const versionFilePath = path.resolve(__dirname, '../src/version.js');

// Write the file
fs.writeFileSync(versionFilePath, versionInfo);

console.log(`Updated version information:
- Build Date: ${timestamp}
- Build ID: ${buildId}
- Git Commit: ${gitCommit}`);