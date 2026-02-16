# Nvestiv Intelligence — Deployment Checklist

> Three services to deploy: **Intelligence API**, **Report Page**, and **Chrome Extension**.
> Auth integration is handled separately by the dev team.

---

## Prerequisites

- [ ] Supabase project created (note URL and keys)
- [ ] Redis instance provisioned (Upstash, AWS ElastiCache, or self-hosted)
- [ ] Domain DNS configured:
  - `api.nvestiv.com` → Intelligence API server
  - `report.nvestiv.com` → Report Page (Vercel / your host)
- [ ] API keys obtained:
  - Google Gemini API key (`GEMINI_API_KEY`)
  - OpenAI API key (`OPENAI_API_KEY`)
  - Jina AI API key (`JINA_API_KEY`)
- [ ] JWT secret shared with the main Nvestiv app (`JWT_SECRET`)

---

## 1. Database (Supabase)

### 1.1 Run migration
```bash
# Connect to your Supabase SQL editor or use the CLI
# Run the full schema migration:
intelligence-api/supabase/migrations/001_initial_schema.sql
```

### 1.2 Verify
- [ ] Tables created: `organizations`, `entities`, `reports`, `entity_versions`, `report_jobs`
- [ ] pgvector extension enabled
- [ ] Embedding tables: `entity_embeddings`, `report_section_embeddings`, `citation_embeddings`
- [ ] RPC functions: `search_similar_entities`, `retrieve_report_sections`
- [ ] Row Level Security policies applied as needed

---

## 2. Intelligence API (`intelligence-api/`)

### 2.1 Environment setup
```bash
cd intelligence-api
cp .env.production.example .env
# Edit .env with your production values
```

**Required environment variables:**
| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3001) |
| `NODE_ENV` | `production` |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Must match the main Nvestiv app |
| `GEMINI_API_KEY` | Google Gemini API key |
| `OPENAI_API_KEY` | OpenAI API key (for embeddings) |
| `JINA_API_KEY` | Jina AI API key (for web scraping) |
| `REPORTS_URL` | `https://report.nvestiv.com` |
| `CORS_ORIGINS` | See note below |

**CORS_ORIGINS** must include:
- `chrome-extension://YOUR_EXTENSION_ID` (get this after publishing the extension)
- `https://report.nvestiv.com`
- `https://app.nvestiv.com`

> You won't know the Chrome extension ID until it's uploaded to the Chrome Web Store.
> Deploy the API first with a placeholder, then update after the extension is published.

### 2.2 Deploy with Docker
```bash
# Option A: Docker Compose (includes Redis)
docker compose -f docker-compose.prod.yml up -d --build

# Option B: Just build the image (if Redis is external)
docker build -t nvestiv-intelligence-api .
docker run -d --env-file .env -p 3001:3001 nvestiv-intelligence-api
```

**Important:** The worker runs as a separate process from the API:
- The `docker-compose.prod.yml` handles this automatically (api + worker services)
- If deploying manually, run the worker separately:
  ```bash
  node dist/workers/reportWorker.js
  ```

### 2.3 Deploy without Docker
```bash
cd intelligence-api
npm ci
npm run build
npm start          # Starts the API server
# In a separate process:
node dist/workers/reportWorker.js  # Starts the report worker
```

### 2.4 Verify
```bash
curl https://api.nvestiv.com/health
# Expected: {"status":"ok"}
```

- [ ] Health endpoint returns 200
- [ ] CORS headers present for allowed origins
- [ ] Worker process is running (check logs)
- [ ] Redis connection established

---

## 3. Report Page (`report-page/`)

### 3.1 Environment setup
```bash
cd report-page
cp .env.production.example .env.local
# Edit .env.local with your production values
```

**Required environment variables:**
| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |
| `INTELLIGENCE_API_URL` | `https://api.nvestiv.com` |

### 3.2 Deploy to Vercel (recommended)
```bash
# Install Vercel CLI if needed
npm i -g vercel

cd report-page
vercel --prod
```

Set environment variables in Vercel dashboard or via CLI:
```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_KEY production
vercel env add INTELLIGENCE_API_URL production
```

### 3.3 Deploy to other hosts
```bash
cd report-page
npm ci
npm run build
npm start  # Starts on port 3000 by default
```

### 3.4 Verify
- [ ] Navigate to `https://report.nvestiv.com` — landing page loads
- [ ] Privacy policy page loads at `/privacy-policy`
- [ ] Report page renders at `/r/{test-report-id}` (requires a report in Supabase)

---

## 4. Chrome Extension (`chrome-extension/`)

### 4.1 Build for production
```bash
cd chrome-extension
cp .env.production.example .env
# Verify the URLs in .env match your deployed services

# Build the production bundle
npm run build:prod

# Or build + create zip for Chrome Web Store
npm run package
# Creates: nvestiv-extension.zip
```

### 4.2 Verify the production build
```bash
# Check the manifest doesn't include localhost
cat dist/manifest.json | grep localhost
# Should return NOTHING (no localhost references)

# Check externally_connectable is present
cat dist/manifest.json | grep -A3 externally_connectable
# Should show app.nvestiv.com

# Verify the build script (optional)
npm run verify
```

### 4.3 Load locally for testing
1. Open Chrome → `chrome://extensions`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked" → select the `dist/` folder
4. Note the **Extension ID** displayed (you'll need this for CORS)
5. Navigate to LinkedIn → click the extension icon → side panel should open

### 4.4 Update API CORS with Extension ID
After loading (or publishing), update the Intelligence API:
```bash
# Add the real extension ID to CORS_ORIGINS
CORS_ORIGINS=chrome-extension://YOUR_REAL_EXTENSION_ID,https://report.nvestiv.com,https://app.nvestiv.com
```
Restart the API service after updating.

### 4.5 Publish to Chrome Web Store
1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Click "New Item"
3. Upload `nvestiv-extension.zip` (created by `npm run package`)
4. Fill in listing details:
   - **Name:** Nvestiv Intelligence
   - **Description:** AI-powered intelligence for alternative investment professionals
   - **Category:** Productivity
   - **Screenshots:** At least 1 screenshot (1280×800 or 640×400)
   - **Privacy policy:** `https://report.nvestiv.com/privacy-policy`
5. Submit for review (typically 1-3 business days)
6. Once approved, note the permanent Extension ID
7. Update `CORS_ORIGINS` on the API with the permanent ID

---

## 5. Auth Integration (Dev Team)

> This section is for the dev team to implement.

The extension expects auth to work as follows:

1. User clicks "Sign in" in the extension side panel
2. Extension opens `https://app.nvestiv.com/auth/extension` in a new tab
3. User authenticates on the Nvestiv app
4. On success, the app page calls:
   ```javascript
   chrome.runtime.sendMessage(EXTENSION_ID, {
     type: 'AUTH_SUCCESS',
     data: { token: 'jwt-token-here' }
   });
   ```
5. The extension's `onMessageExternal` listener receives the token
6. Token is stored in `chrome.storage.local`

**Requirements for the main app:**
- [ ] Create `/auth/extension` route
- [ ] After successful auth, call `chrome.runtime.sendMessage()` with the extension ID
- [ ] The JWT must include: `user_id`, `org_id`, `email`, `role`, `permissions`
- [ ] JWT must be signed with the same `JWT_SECRET` as the Intelligence API

**The `externally_connectable` manifest entry is already configured** to allow messages from `app.nvestiv.com`.

---

## 6. Post-Deployment Verification

### Quick smoke test
1. [ ] Open Chrome with the extension installed
2. [ ] Navigate to any LinkedIn profile
3. [ ] Side panel should open and show the profile preview
4. [ ] Sign in (once auth is implemented)
5. [ ] Click "Generate Report"
6. [ ] Report should appear at `report.nvestiv.com/r/{id}`
7. [ ] "Send to CRM" button should work

### API health checks
```bash
# API health
curl https://api.nvestiv.com/health

# Test entity exists check (requires auth token)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://api.nvestiv.com/api/intelligence/exists?entity=https://linkedin.com/in/test"
```

### Monitoring
- [ ] API server logs are accessible
- [ ] Worker process logs are accessible
- [ ] Redis memory usage is within limits
- [ ] Supabase dashboard shows table activity

---

## Environment Files Reference

| Service | Dev Config | Production Config |
|---------|-----------|-------------------|
| Intelligence API | `.env.example` | `.env.production.example` |
| Report Page | `.env.example` | `.env.production.example` |
| Chrome Extension | `.env.example` | `.env.production.example` |

---

## Deployment Order

1. **Database** — Run Supabase migration first
2. **Intelligence API** — Deploy API + Worker (needs DB)
3. **Report Page** — Deploy to Vercel/host (needs Supabase)
4. **Chrome Extension** — Build + load/publish (needs API URL)
5. **Update CORS** — Add extension ID to API CORS config
6. **Auth** — Dev team implements auth flow on main app
