# Chrome Extension Testing & Troubleshooting Skill

## Purpose
Guide Claude Code through building, testing, and troubleshooting Chrome extensions with continuous verification at each step. Ensure every component works before proceeding.

## Core Principle
**Test early, test often.** After creating each component, immediately verify it works before moving to the next piece.

---

## Development Workflow

### Step 1: Project Setup & Initial Build

**After creating project structure:**

```bash
# 1. Install dependencies
npm install

# 2. Build extension
npm run build

# 3. Verify build output
ls -la dist/
# Should see: manifest.json, icons/, content.js, background.js, sidepanel.html
```

**Verification Checklist:**
- [ ] dist/ folder exists
- [ ] manifest.json is valid JSON
- [ ] All referenced files exist
- [ ] Icons are present (16px, 48px, 128px)

**Test manifest.json validity:**
```bash
# Create verification script
cat > scripts/verify-manifest.js << 'EOF'
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync('dist/manifest.json', 'utf8'));

console.log('Verifying manifest.json...');

const checks = [
  { name: 'Has name', pass: !!manifest.name },
  { name: 'Has version', pass: !!manifest.version },
  { name: 'Has manifest_version 3', pass: manifest.manifest_version === 3 },
  { name: 'Has permissions array', pass: Array.isArray(manifest.permissions) },
  { name: 'Has background service worker', pass: !!manifest.background?.service_worker }
];

let failures = 0;
checks.forEach(check => {
  const icon = check.pass ? '✅' : '❌';
  console.log(`${icon} ${check.name}`);
  if (!check.pass) failures++;
});

if (failures > 0) {
  console.error(`\n❌ ${failures} checks failed!`);
  process.exit(1);
}

console.log('\n✅ Manifest valid!');
EOF

node scripts/verify-manifest.js
```

---

### Step 2: Load Extension in Chrome

**Manual Load Instructions:**

```markdown
LOAD UNPACKED EXTENSION:

1. Open Chrome
2. Navigate to: chrome://extensions/
3. Enable "Developer mode" (toggle top-right)
4. Click "Load unpacked"
5. Select the /dist folder
6. Extension should appear with green badge

VERIFY:
- Extension card shows name and version
- No error badge (red exclamation)
- Extension ID is displayed
```

**Create helper script to show instructions:**

```javascript
// scripts/load-instructions.js
console.log(`
╔═══════════════════════════════════════════════════════════╗
║          LOAD EXTENSION IN CHROME                         ║
╚═══════════════════════════════════════════════════════════╝

1. Open Chrome browser
2. Go to: chrome://extensions/
3. Enable "Developer mode" (top-right toggle)
4. Click "Load unpacked" button
5. Select this folder: ${process.cwd()}/dist

AFTER LOADING:
- Extension should appear in list
- Note the Extension ID (looks like: abcdefghijklmnop...)
- Click "Inspect views: service worker" to debug background
- Check for any red error badges

Press Ctrl+C when done loading extension...
`);

// Keep script running
process.stdin.resume();
```

**Add to package.json:**
```json
{
  "scripts": {
    "load": "node scripts/load-instructions.js"
  }
}
```

---

### Step 3: Test Content Script

**After creating content script:**

**Test file: `tests/manual/test-content-script.md`**

```markdown
# Content Script Manual Test

## Setup
1. Load extension in Chrome
2. Open DevTools Console (F12)
3. Go to LinkedIn profile: https://linkedin.com/in/anyone

## Tests

### Test 1: Script Loads
- [ ] Console shows: "🔵 Nvestiv: Content script loaded"
- [ ] No errors in console
- [ ] Script appears in Sources tab → Content Scripts

### Test 2: Page Detection
- [ ] Console shows detected page type
- [ ] Returns 'profile' for profile pages
- [ ] Returns 'company' for company pages
- [ ] Returns null for other pages

### Test 3: Data Extraction
- [ ] Can extract profile name
- [ ] Can extract headline
- [ ] Can extract location
- [ ] Can extract LinkedIn URL
- [ ] Extracted data is logged to console

### Common Issues

**Script not loading:**
- Check manifest.json matches pattern: "https://*.linkedin.com/*"
- Verify content.js exists in dist/
- Reload extension (chrome://extensions/)
- Hard refresh LinkedIn page (Cmd+Shift+R)

**Can't extract data:**
- LinkedIn changed their DOM structure
- Check selectors in extractLinkedInProfile()
- Inspect page elements to verify class names
- Add fallbacks for missing elements
```

**Automated content script test:**

```javascript
// tests/verify-content-script.js
const puppeteer = require('puppeteer');
const path = require('path');

async function testContentScript() {
  console.log('🧪 Testing content script...');
  
  const extensionPath = path.join(__dirname, '../dist');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });
  
  const page = await browser.newPage();
  
  // Listen for console messages
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Nvestiv')) {
      console.log('📨 Extension:', text);
    }
  });
  
  console.log('📍 Navigating to LinkedIn...');
  await page.goto('https://linkedin.com/in/test', { waitUntil: 'networkidle0' });
  
  // Wait for content script to load
  await page.waitForTimeout(2000);
  
  // Check if script loaded
  const scriptLoaded = await page.evaluate(() => {
    return typeof window.__nvestivContentScriptLoaded !== 'undefined';
  });
  
  if (scriptLoaded) {
    console.log('✅ Content script loaded successfully');
  } else {
    console.error('❌ Content script did not load');
    await browser.close();
    process.exit(1);
  }
  
  console.log('\n✅ Content script test passed!');
  console.log('👉 Press Ctrl+C to close browser');
  
  // Keep browser open for manual inspection
  await new Promise(() => {});
}

testContentScript().catch(console.error);
```

**Add marker to content script:**
```javascript
// src/content/index.ts
console.log('🔵 Nvestiv: Content script loaded');

// Mark as loaded for testing
(window as any).__nvestivContentScriptLoaded = true;
```

---

### Step 4: Test Background Service Worker

**After creating background worker:**

**Test access:**
```markdown
# Background Worker Manual Test

## Access Background Worker Console

1. Go to chrome://extensions/
2. Find your extension
3. Click "Inspect views: service worker"
4. DevTools opens showing background console

## Tests

### Test 1: Worker Active
- [ ] Console shows: "🟢 Background worker started"
- [ ] No errors in console
- [ ] Can see worker code in Sources tab

### Test 2: Message Handling
- [ ] Worker receives messages from content script
- [ ] Console logs show message type and data
- [ ] Worker can send responses back

### Test 3: API Communication
- [ ] Worker can make fetch requests
- [ ] Auth token is included in headers
- [ ] Responses are logged
- [ ] Errors are caught and logged

### Common Issues

**Worker not starting:**
- Check manifest.json has correct service_worker path
- Verify background.js exists in dist/
- Check for syntax errors in background script
- Click "Reload" on chrome://extensions/

**Worker goes to sleep:**
- This is normal! Chrome puts inactive workers to sleep
- Click "Inspect views: service worker" to wake it
- Send a message to wake it programmatically
```

**Add debugging to background worker:**

```javascript
// src/background/index.ts
console.log('🟢 Background worker started at', new Date().toISOString());

// Log all messages for debugging
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Message received:', {
    type: message.type,
    from: sender.tab ? 'content script' : 'extension',
    data: message
  });
  
  // Your message handling logic
  
  return true; // Keep channel open
});

// Log any errors
self.addEventListener('error', (event) => {
  console.error('❌ Background error:', event.error);
});

// Heartbeat to keep worker alive during dev
if (import.meta.env.DEV) {
  setInterval(() => {
    console.log('💓 Worker heartbeat');
  }, 20000); // Every 20 seconds
}
```

**Test message flow:**

```javascript
// tests/test-message-flow.js
const puppeteer = require('puppeteer');
const path = require('path');

async function testMessageFlow() {
  console.log('🧪 Testing message flow...');
  
  const extensionPath = path.join(__dirname, '../dist');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });
  
  const page = await browser.newPage();
  
  // Navigate to trigger content script
  await page.goto('https://linkedin.com/in/test');
  await page.waitForTimeout(2000);
  
  // Send test message from content script
  const response = await page.evaluate(() => {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'TEST_PING', data: 'hello' },
        (response) => resolve(response)
      );
    });
  });
  
  console.log('📨 Response from background:', response);
  
  if (response && response.success) {
    console.log('✅ Message flow working!');
  } else {
    console.error('❌ Message flow broken');
    process.exit(1);
  }
  
  await browser.close();
}

testMessageFlow();
```

---

### Step 5: Test Side Panel

**After creating side panel UI:**

**Manual test:**
```markdown
# Side Panel Manual Test

## Open Side Panel

Method 1: Click extension icon in toolbar
Method 2: Right-click extension icon → Side Panel
Method 3: Auto-opens on LinkedIn (if configured)

## Tests

### Test 1: Panel Opens
- [ ] Panel slides in from right
- [ ] UI renders without errors
- [ ] Can see panel in DevTools (right-click → Inspect)

### Test 2: UI Components
- [ ] Shows correct state (auth/loading/profile)
- [ ] Buttons are clickable
- [ ] Text is readable
- [ ] Images load properly
- [ ] Styling looks correct

### Test 3: React DevTools
- [ ] Install React DevTools extension
- [ ] Can inspect component tree
- [ ] Can see props and state
- [ ] Can trigger re-renders

### Debug Side Panel

1. Right-click inside side panel
2. Click "Inspect"
3. DevTools opens for side panel context
4. Can see:
   - Console logs
   - Network requests
   - React components (with React DevTools)
   - Local storage
   - Element inspector

### Common Issues

**Panel won't open:**
- Check manifest.json has side_panel configuration
- Verify sidepanel.html exists in dist/
- Try right-click extension icon → Side Panel
- Check for JavaScript errors in panel console

**React not rendering:**
- Check for console errors
- Verify React is imported correctly
- Check if root element exists
- Ensure bundle is built properly
```

**Automated side panel test:**

```javascript
// tests/test-sidepanel.js
const puppeteer = require('puppeteer');
const path = require('path');

async function testSidePanel() {
  console.log('🧪 Testing side panel...');
  
  const extensionPath = path.join(__dirname, '../dist');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });
  
  const page = await browser.newPage();
  
  // Navigate to LinkedIn to trigger side panel
  await page.goto('https://linkedin.com/in/test');
  
  // Get extension ID
  const targets = await browser.targets();
  const extensionTarget = targets.find(
    target => target.type() === 'service_worker'
  );
  const extensionId = extensionTarget.url().split('/')[2];
  
  console.log('📦 Extension ID:', extensionId);
  
  // Open side panel
  const sidePanelUrl = `chrome-extension://${extensionId}/sidepanel.html`;
  const sidePanelPage = await browser.newPage();
  await sidePanelPage.goto(sidePanelUrl);
  
  // Wait for React to render
  await sidePanelPage.waitForSelector('#root', { timeout: 5000 });
  
  // Check if content rendered
  const hasContent = await sidePanelPage.evaluate(() => {
    const root = document.getElementById('root');
    return root && root.innerHTML.length > 0;
  });
  
  if (hasContent) {
    console.log('✅ Side panel renders successfully');
  } else {
    console.error('❌ Side panel is empty');
    process.exit(1);
  }
  
  console.log('\n✅ Side panel test passed!');
  console.log('👉 Inspect the side panel in the browser');
  
  await new Promise(() => {});
}

testSidePanel();
```

---

### Step 6: Test API Integration

**After setting up API calls:**

**Test API connectivity:**

```javascript
// tests/test-api.js
async function testAPI() {
  console.log('🧪 Testing API integration...');
  
  const API_BASE = process.env.API_BASE || 'http://localhost:3000';
  
  // Test 1: Health check
  console.log('\n1️⃣ Testing health endpoint...');
  try {
    const response = await fetch(`${API_BASE}/health`);
    const data = await response.json();
    console.log('✅ API is healthy:', data);
  } catch (error) {
    console.error('❌ API health check failed:', error.message);
    console.log('💡 Make sure Intelligence API is running');
    process.exit(1);
  }
  
  // Test 2: Auth endpoint
  console.log('\n2️⃣ Testing auth...');
  const testToken = process.env.TEST_TOKEN || 'test-token-123';
  try {
    const response = await fetch(`${API_BASE}/api/intelligence/exists?entity=test`, {
      headers: { 'Authorization': `Bearer ${testToken}` }
    });
    
    if (response.status === 401) {
      console.log('✅ Auth validation working (rejected invalid token)');
    } else {
      const data = await response.json();
      console.log('✅ Auth working, response:', data);
    }
  } catch (error) {
    console.error('❌ Auth test failed:', error.message);
  }
  
  // Test 3: CORS
  console.log('\n3️⃣ Testing CORS...');
  try {
    const response = await fetch(`${API_BASE}/api/intelligence/exists?entity=test`, {
      method: 'GET',
      headers: {
        'Origin': 'chrome-extension://test-extension-id',
        'Authorization': `Bearer ${testToken}`
      }
    });
    
    const corsHeader = response.headers.get('access-control-allow-origin');
    if (corsHeader) {
      console.log('✅ CORS configured:', corsHeader);
    } else {
      console.log('⚠️  CORS not configured - may cause issues');
    }
  } catch (error) {
    console.error('❌ CORS test failed:', error.message);
  }
  
  console.log('\n✅ API tests complete!');
}

testAPI();
```

**Test from extension:**

```javascript
// Add to background worker for testing
async function testAPIFromExtension() {
  console.log('🧪 Testing API from extension...');
  
  try {
    const token = await getAuthToken();
    
    const response = await fetch(`${API_BASE}/api/intelligence/exists?entity=test`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log('✅ API call successful:', data);
    
  } catch (error) {
    console.error('❌ API call failed:', error);
  }
}

// Call on worker startup in dev mode
if (import.meta.env.DEV) {
  testAPIFromExtension();
}
```

---

### Step 7: End-to-End Testing

**Full workflow test:**

```javascript
// tests/e2e/full-workflow.spec.js
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Nvestiv Extension E2E', () => {
  let extensionId;
  
  test.beforeAll(async ({ browser }) => {
    // Get extension ID
    const context = await browser.newContext();
    const extensionPath = path.join(__dirname, '../../dist');
    // Extension ID would be loaded here
  });
  
  test('complete workflow: LinkedIn → Report generation', async ({ page }) => {
    // Step 1: Go to LinkedIn
    await page.goto('https://linkedin.com/in/test-profile');
    console.log('✅ Navigated to LinkedIn');
    
    // Step 2: Wait for content script
    await page.waitForTimeout(2000);
    const scriptLoaded = await page.evaluate(() => {
      return typeof window.__nvestivContentScriptLoaded !== 'undefined';
    });
    expect(scriptLoaded).toBeTruthy();
    console.log('✅ Content script loaded');
    
    // Step 3: Check if side panel appears
    // (Implementation depends on your panel trigger)
    console.log('✅ Side panel available');
    
    // Step 4: Click generate report
    // await page.click('[data-testid="generate-report-btn"]');
    console.log('✅ Generate report clicked');
    
    // Step 5: Wait for job to start
    await page.waitForTimeout(1000);
    console.log('✅ Report generation started');
    
    // Step 6: Verify report opens
    // const reportPage = await context.waitForEvent('page');
    // await reportPage.waitForSelector('[data-testid="report-content"]');
    console.log('✅ Report page opened');
  });
});
```

---

## Continuous Verification

### Auto-Check on Build

**Add to package.json:**

```json
{
  "scripts": {
    "build": "vite build && npm run verify",
    "verify": "node scripts/verify-build.js"
  }
}
```

**Verification script:**

```javascript
// scripts/verify-build.js
const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying build...\n');

const checks = [
  {
    name: 'dist/ folder exists',
    test: () => fs.existsSync('dist')
  },
  {
    name: 'manifest.json is valid',
    test: () => {
      const manifest = JSON.parse(fs.readFileSync('dist/manifest.json', 'utf8'));
      return manifest.manifest_version === 3;
    }
  },
  {
    name: 'content script exists',
    test: () => fs.existsSync('dist/content.js')
  },
  {
    name: 'background worker exists',
    test: () => fs.existsSync('dist/background.js')
  },
  {
    name: 'side panel HTML exists',
    test: () => fs.existsSync('dist/sidepanel.html')
  },
  {
    name: 'icons present',
    test: () => fs.existsSync('dist/icons/icon128.png')
  },
  {
    name: 'no source maps in production',
    test: () => {
      const files = fs.readdirSync('dist');
      const hasMaps = files.some(f => f.endsWith('.map'));
      return process.env.NODE_ENV === 'development' || !hasMaps;
    }
  }
];

let passed = 0;
let failed = 0;

checks.forEach(check => {
  try {
    const result = check.test();
    if (result) {
      console.log(`✅ ${check.name}`);
      passed++;
    } else {
      console.log(`❌ ${check.name}`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ ${check.name}: ${error.message}`);
    failed++;
  }
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.error('\n❌ Build verification failed!');
  process.exit(1);
}

console.log('\n✅ Build verification passed!');
```

---

## Common Issues & Solutions

### Issue: Extension Won't Load

**Symptoms:**
- "Load unpacked" button doesn't work
- Extension shows error badge
- Manifest errors

**Debug:**
```bash
# 1. Validate manifest
cat dist/manifest.json | jq .
# Should output formatted JSON with no errors

# 2. Check for syntax errors
node -c dist/background.js
node -c dist/content.js

# 3. Look at Chrome errors
# chrome://extensions/ → Click "Errors" on extension card
```

**Fix:**
- Ensure manifest_version is 3
- Check all file paths are correct
- Verify JSON syntax
- Remove any ES6 imports from background worker (use importScripts)

### Issue: Content Script Not Running

**Debug:**
```javascript
// Add to content script top
console.log('🔵 Script location:', window.location.href);
console.log('🔵 Script loaded at:', new Date().toISOString());

// Check if matches pattern
const pattern = /^https:\/\/(www\.)?linkedin\.com\/in\/.+/;
console.log('🔵 Matches pattern:', pattern.test(window.location.href));
```

**Fix:**
- Verify matches pattern in manifest
- Check run_at timing (try "document_idle")
- Reload extension AND refresh page
- Check for CSP violations in console

### Issue: Side Panel Won't Open

**Debug:**
```javascript
// Add to background worker
chrome.sidePanel.setOptions({
  enabled: true,
  path: 'sidepanel.html'
}).then(() => {
  console.log('✅ Side panel enabled');
}).catch((error) => {
  console.error('❌ Side panel error:', error);
});
```

**Fix:**
- Ensure manifest has side_panel config
- Check sidepanel.html exists
- Verify Chrome version supports side panel (114+)
- Try opening manually: Right-click icon → Side Panel

### Issue: API Calls Failing

**Debug:**
```javascript
// Log full request/response
async function debugAPICall() {
  const url = `${API_BASE}/api/test`;
  console.log('🌐 Request URL:', url);
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  console.log('📋 Headers:', headers);
  
  try {
    const response = await fetch(url, { headers });
    console.log('📊 Response status:', response.status);
    console.log('📊 Response headers:', Object.fromEntries(response.headers));
    
    const data = await response.json();
    console.log('📦 Response data:', data);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}
```

**Fix:**
- Check CORS configuration on API
- Verify auth token is valid
- Ensure API is running (curl test)
- Check network tab for details
- Add extension ID to allowed origins

---

## Testing Checklist

**Before declaring component "done":**

### Content Script
- [ ] Loads on correct pages
- [ ] Detects page type
- [ ] Extracts data correctly
- [ ] Sends messages to background
- [ ] No console errors

### Background Worker
- [ ] Starts successfully
- [ ] Receives messages
- [ ] Makes API calls
- [ ] Handles errors
- [ ] Logs are visible

### Side Panel
- [ ] Opens correctly
- [ ] UI renders
- [ ] Components work
- [ ] API calls succeed
- [ ] State management works

### API Integration
- [ ] Endpoints reachable
- [ ] Auth works
- [ ] CORS configured
- [ ] Error handling
- [ ] Response parsing

### End-to-End
- [ ] Full workflow completes
- [ ] No errors in any component
- [ ] Data flows correctly
- [ ] UI updates appropriately

---

## Development Commands Reference

```bash
# Build and verify
npm run build && npm run verify

# Start with auto-reload
npm run dev

# Run all tests
npm run test

# Test specific component
npm run test:content     # Content script
npm run test:background  # Background worker
npm run test:sidepanel   # Side panel UI
npm run test:api         # API integration
npm run test:e2e         # Full workflow

# Manual testing helpers
npm run load             # Show load instructions
npm run debug:content    # Open test page with debug
npm run debug:background # Show background worker logs
npm run debug:api        # Test API endpoints

# Pre-publish checks
npm run pre-check        # Verify everything before publishing
```

---

## Success Criteria

**Extension is ready when:**

✅ All build verification checks pass
✅ Extension loads without errors
✅ Content script works on LinkedIn
✅ Background worker starts and receives messages  
✅ Side panel opens and renders
✅ API calls succeed
✅ End-to-end workflow completes
✅ No console errors in any component
✅ Manual testing confirms all features work

**Then proceed to next component or declare complete.**
