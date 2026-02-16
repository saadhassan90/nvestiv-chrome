import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');

const requiredFiles = [
  'manifest.json',
  'service-worker-loader.js',
  'src/sidepanel/sidepanel.html',
  'src/assets/icons/icon16.png',
  'src/assets/icons/icon32.png',
  'src/assets/icons/icon48.png',
  'src/assets/icons/icon128.png',
];

let allPassed = true;

console.log('🔍 Verifying build output...\n');

// Check dist directory exists
if (!fs.existsSync(distDir)) {
  console.error('❌ dist/ directory not found. Run `npm run build` first.');
  process.exit(1);
}

// Check required files
for (const file of requiredFiles) {
  const filePath = path.join(distDir, file);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    console.log(`  ✅ ${file} (${stats.size} bytes)`);
  } else {
    console.log(`  ❌ ${file} — MISSING`);
    allPassed = false;
  }
}

// Validate manifest.json
console.log('\n🔍 Validating manifest.json...');
try {
  const manifestPath = path.join(distDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  const checks = [
    ['manifest_version', manifest.manifest_version === 3],
    ['name', !!manifest.name],
    ['version', !!manifest.version],
    ['permissions', Array.isArray(manifest.permissions)],
    ['background.service_worker', !!manifest.background?.service_worker],
    ['content_scripts', Array.isArray(manifest.content_scripts) && manifest.content_scripts.length > 0],
    ['side_panel', !!manifest.side_panel?.default_path],
  ];

  for (const [name, ok] of checks) {
    console.log(`  ${ok ? '✅' : '❌'} ${name}`);
    if (!ok) allPassed = false;
  }
} catch (err) {
  console.error('  ❌ Could not parse manifest.json:', err.message);
  allPassed = false;
}

// Check for JS bundles
console.log('\n🔍 Checking for compiled assets...');
const assetsDir = path.join(distDir, 'assets');
if (fs.existsSync(assetsDir)) {
  const jsFiles = fs.readdirSync(assetsDir).filter(f => f.endsWith('.js'));
  const cssFiles = fs.readdirSync(assetsDir).filter(f => f.endsWith('.css'));
  console.log(`  ✅ ${jsFiles.length} JS bundle(s)`);
  console.log(`  ✅ ${cssFiles.length} CSS bundle(s)`);
} else {
  console.log('  ❌ assets/ directory not found');
  allPassed = false;
}

// Summary
console.log('\n' + (allPassed ? '✅ Build verification PASSED' : '❌ Build verification FAILED'));
process.exit(allPassed ? 0 : 1);
