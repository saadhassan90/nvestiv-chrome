#!/bin/bash
# ==============================================================
# Nvestiv Intelligence Extension - Full Setup Script
# ==============================================================
# This script sets up everything needed to test the extension locally.
#
# Prerequisites:
#   1. Node.js 20+ installed (check: node --version)
#   2. Docker Desktop installed and running (check: docker --version)
#   3. API keys ready:
#      - Gemini API key (from https://aistudio.google.com/apikey)
#      - OpenAI API key (from https://platform.openai.com/api-keys)
#
# Usage: bash setup.sh
# ==============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Nvestiv Intelligence Extension Setup        ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ------------------------------------------
# Step 1: Check prerequisites
# ------------------------------------------
echo -e "${YELLOW}[1/7] Checking prerequisites...${NC}"

if ! command -v node &>/dev/null; then
  echo -e "${RED}Error: Node.js is not installed. Install from https://nodejs.org${NC}"
  exit 1
fi

NODE_VERSION=$(node --version | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo -e "${RED}Error: Node.js 20+ required. Current: $(node --version)${NC}"
  exit 1
fi
echo -e "  ${GREEN}✓${NC} Node.js $(node --version)"

if ! command -v docker &>/dev/null; then
  echo -e "${RED}Error: Docker is not installed. Install Docker Desktop from https://docker.com${NC}"
  exit 1
fi
echo -e "  ${GREEN}✓${NC} Docker $(docker --version | head -1)"

if ! docker info &>/dev/null; then
  echo -e "${RED}Error: Docker is not running. Please start Docker Desktop first.${NC}"
  exit 1
fi
echo -e "  ${GREEN}✓${NC} Docker is running"

# ------------------------------------------
# Step 2: Collect API keys (if not already set)
# ------------------------------------------
echo ""
echo -e "${YELLOW}[2/7] Setting up API keys...${NC}"

API_ENV_FILE="$SCRIPT_DIR/intelligence-api/.env"

if [ -f "$API_ENV_FILE" ]; then
  echo -e "  ${GREEN}✓${NC} intelligence-api/.env already exists"
else
  echo ""
  echo -e "  ${BLUE}We need two API keys to power the research engine:${NC}"
  echo ""

  read -p "  Enter your Gemini API key: " GEMINI_KEY
  if [ -z "$GEMINI_KEY" ]; then
    echo -e "${RED}  Error: Gemini API key is required${NC}"
    exit 1
  fi

  read -p "  Enter your OpenAI API key: " OPENAI_KEY
  if [ -z "$OPENAI_KEY" ]; then
    echo -e "${RED}  Error: OpenAI API key is required${NC}"
    exit 1
  fi

  # Generate a random JWT secret for local development
  JWT_SECRET=$(openssl rand -hex 32)

  cat > "$API_ENV_FILE" <<EOF
# Server
PORT=3001
NODE_ENV=development

# Supabase (local)
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WO_o0BQBhL7F5qZ_Hk1rKmlIeSqR0yXMSsHk

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=$JWT_SECRET

# AI Keys
GEMINI_API_KEY=$GEMINI_KEY
OPENAI_API_KEY=$OPENAI_KEY

# CORS
CORS_ORIGINS=chrome-extension://*,http://localhost:5173,http://localhost:3000

# Rate limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000
EOF

  echo -e "  ${GREEN}✓${NC} Created intelligence-api/.env"
fi

# Report page .env
REPORT_ENV_FILE="$SCRIPT_DIR/report-page/.env.local"
if [ ! -f "$REPORT_ENV_FILE" ]; then
  cat > "$REPORT_ENV_FILE" <<EOF
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WO_o0BQBhL7F5qZ_Hk1rKmlIeSqR0yXMSsHk
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
INTELLIGENCE_API_URL=http://localhost:3001
EOF
  echo -e "  ${GREEN}✓${NC} Created report-page/.env.local"
fi

# Chrome extension .env
EXT_ENV_FILE="$SCRIPT_DIR/chrome-extension/.env"
if [ ! -f "$EXT_ENV_FILE" ]; then
  cat > "$EXT_ENV_FILE" <<EOF
VITE_API_BASE_URL=http://localhost:3001
VITE_MAIN_APP_URL=http://localhost:5173
VITE_REPORTS_URL=http://localhost:3000
EOF
  echo -e "  ${GREEN}✓${NC} Created chrome-extension/.env"
fi

# ------------------------------------------
# Step 3: Install dependencies
# ------------------------------------------
echo ""
echo -e "${YELLOW}[3/7] Installing dependencies (this may take a minute)...${NC}"

cd "$SCRIPT_DIR/chrome-extension" && npm install --silent 2>&1 | tail -1
echo -e "  ${GREEN}✓${NC} Chrome extension dependencies"

cd "$SCRIPT_DIR/intelligence-api" && npm install --silent 2>&1 | tail -1
echo -e "  ${GREEN}✓${NC} Intelligence API dependencies"

cd "$SCRIPT_DIR/report-page" && npm install --silent 2>&1 | tail -1
echo -e "  ${GREEN}✓${NC} Report page dependencies"

# ------------------------------------------
# Step 4: Start Redis via Docker
# ------------------------------------------
echo ""
echo -e "${YELLOW}[4/7] Starting Redis...${NC}"

# Check if Redis is already running
if docker ps --filter "name=nvestiv-redis" --format "{{.Names}}" | grep -q "nvestiv-redis"; then
  echo -e "  ${GREEN}✓${NC} Redis already running"
else
  docker run -d --name nvestiv-redis -p 6379:6379 redis:7-alpine >/dev/null 2>&1 || \
    docker start nvestiv-redis >/dev/null 2>&1
  echo -e "  ${GREEN}✓${NC} Redis started on port 6379"
fi

# ------------------------------------------
# Step 5: Build the Chrome Extension
# ------------------------------------------
echo ""
echo -e "${YELLOW}[5/7] Building Chrome extension...${NC}"

cd "$SCRIPT_DIR/chrome-extension"
npm run build >/dev/null 2>&1
echo -e "  ${GREEN}✓${NC} Chrome extension built to chrome-extension/dist/"

# ------------------------------------------
# Step 6: Build the report page
# ------------------------------------------
echo ""
echo -e "${YELLOW}[6/7] Building report page...${NC}"

cd "$SCRIPT_DIR/report-page"
npx next build >/dev/null 2>&1
echo -e "  ${GREEN}✓${NC} Report page built"

# ------------------------------------------
# Step 7: Done!
# ------------------------------------------
echo ""
echo -e "${YELLOW}[7/7] Setup complete!${NC}"
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  SETUP COMPLETE - Follow these steps to test:                   ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║                                                                 ║${NC}"
echo -e "${GREEN}║  STEP 1: Start the backend services                             ║${NC}"
echo -e "${GREEN}║    Run this in a new terminal:                                   ║${NC}"
echo -e "${GREEN}║    ${BLUE}bash start-services.sh${GREEN}                                       ║${NC}"
echo -e "${GREEN}║                                                                 ║${NC}"
echo -e "${GREEN}║  STEP 2: Load the extension in Chrome                           ║${NC}"
echo -e "${GREEN}║    1. Open Chrome → go to chrome://extensions                   ║${NC}"
echo -e "${GREEN}║    2. Turn ON 'Developer mode' (top right toggle)               ║${NC}"
echo -e "${GREEN}║    3. Click 'Load unpacked'                                     ║${NC}"
echo -e "${GREEN}║    4. Select this folder:                                       ║${NC}"
echo -e "${GREEN}║       ${BLUE}$SCRIPT_DIR/chrome-extension/dist${GREEN}                         ║${NC}"
echo -e "${GREEN}║                                                                 ║${NC}"
echo -e "${GREEN}║  STEP 3: Test the extension                                     ║${NC}"
echo -e "${GREEN}║    1. Go to any LinkedIn profile page                           ║${NC}"
echo -e "${GREEN}║    2. Click the Nvestiv extension icon in your toolbar           ║${NC}"
echo -e "${GREEN}║    3. The side panel should open with profile data               ║${NC}"
echo -e "${GREEN}║                                                                 ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
