#!/usr/bin/env node
/**
 * Generates a test JWT token for the Chrome extension.
 *
 * Usage:
 *   node generate-test-token.js
 *
 * Then paste the output into the Chrome DevTools console for the extension:
 *   1. Go to chrome://extensions
 *   2. Find "Nvestiv Intelligence" and click "service worker" link
 *   3. In the console that opens, paste the command this script outputs
 */

const path = require('path');
const fs = require('fs');

// Load JWT secret from .env
const envPath = path.join(__dirname, 'intelligence-api', '.env');
if (!fs.existsSync(envPath)) {
  console.error('Error: intelligence-api/.env not found. Run setup.sh first.');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const jwtSecretMatch = envContent.match(/JWT_SECRET=(.+)/);
if (!jwtSecretMatch) {
  console.error('Error: JWT_SECRET not found in .env');
  process.exit(1);
}

const jwt = require(path.join(__dirname, 'intelligence-api', 'node_modules', 'jsonwebtoken'));

const token = jwt.sign(
  {
    user_id: 'test-user-001',
    org_id: 'test-org-001',
    email: 'test@nvestiv.com',
    role: 'admin',
    permissions: ['read', 'write', 'generate'],
  },
  jwtSecretMatch[1],
  { expiresIn: '30d' },
);

const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;

console.log('');
console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║  Test Token Generated!                                          ║');
console.log('╠══════════════════════════════════════════════════════════════════╣');
console.log('║                                                                 ║');
console.log('║  To inject this token into the Chrome extension:                ║');
console.log('║                                                                 ║');
console.log('║  1. Go to chrome://extensions                                   ║');
console.log('║  2. Find "Nvestiv Intelligence" extension                       ║');
console.log('║  3. Click the "service worker" link (under "Inspect views")     ║');
console.log('║  4. In the DevTools Console tab, paste this command:            ║');
console.log('║                                                                 ║');
console.log('╚══════════════════════════════════════════════════════════════════╝');
console.log('');
console.log('// ---- COPY EVERYTHING BELOW THIS LINE ----');
console.log('');
console.log(`chrome.storage.local.set({
  auth_token: "${token}",
  token_expires: ${expiresAt},
  user_id: "test-user-001",
  org_id: "test-org-001",
  email: "test@nvestiv.com"
}).then(() => console.log("✅ Token injected! Close this tab and visit a LinkedIn profile."));`);
console.log('');
console.log('// ---- STOP COPYING HERE ----');
console.log('');
