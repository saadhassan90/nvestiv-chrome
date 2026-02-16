#!/bin/bash
# ==============================================================
# Nvestiv Intelligence Extension - API Test Script
# ==============================================================
# Tests the Intelligence API endpoints to verify everything works.
# Run this AFTER start-services.sh is running.
#
# Usage: bash test-api.sh
# ==============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

API_URL="http://localhost:3001"

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Testing Intelligence API                    ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo ""

# Load JWT secret from .env
if [ -f "$SCRIPT_DIR/intelligence-api/.env" ]; then
  JWT_SECRET=$(grep "JWT_SECRET=" "$SCRIPT_DIR/intelligence-api/.env" | cut -d'=' -f2)
else
  echo -e "${RED}Error: intelligence-api/.env not found. Run setup.sh first.${NC}"
  exit 1
fi

# Generate a test JWT token using Node.js
TEST_TOKEN=$(node -e "
  const jwt = require('$SCRIPT_DIR/intelligence-api/node_modules/jsonwebtoken');
  const token = jwt.sign(
    {
      user_id: 'test-user-001',
      org_id: 'test-org-001',
      email: 'test@nvestiv.com',
      role: 'admin',
      permissions: ['read', 'write', 'generate']
    },
    '$JWT_SECRET',
    { expiresIn: '24h' }
  );
  process.stdout.write(token);
")

echo -e "${YELLOW}Test JWT token generated${NC}"
echo ""

# ------------------------------------------
# Test 1: Health check
# ------------------------------------------
echo -e "${YELLOW}[Test 1] Health check...${NC}"
RESPONSE=$(curl -s "$API_URL/health")
if echo "$RESPONSE" | grep -q '"status":"ok"'; then
  echo -e "  ${GREEN}✓ PASS${NC} - API is healthy"
else
  echo -e "  ${RED}✗ FAIL${NC} - API is not responding"
  echo "  Response: $RESPONSE"
  echo ""
  echo -e "${RED}Make sure services are running (bash start-services.sh)${NC}"
  exit 1
fi

# ------------------------------------------
# Test 2: Check entity (should return not found)
# ------------------------------------------
echo -e "${YELLOW}[Test 2] Entity check (new entity)...${NC}"
RESPONSE=$(curl -s -H "Authorization: Bearer $TEST_TOKEN" \
  "$API_URL/api/intelligence/exists?entity=https://www.linkedin.com/in/test-person")
if echo "$RESPONSE" | grep -q '"exists"'; then
  echo -e "  ${GREEN}✓ PASS${NC} - Entity check endpoint works"
  echo "  Response: $RESPONSE"
else
  echo -e "  ${RED}✗ FAIL${NC} - Entity check failed"
  echo "  Response: $RESPONSE"
fi

# ------------------------------------------
# Test 3: Scrape endpoint (passive data collection)
# ------------------------------------------
echo -e "${YELLOW}[Test 3] Scrape endpoint (passive data collection)...${NC}"
RESPONSE=$(curl -s -X POST -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "linkedin_url": "https://www.linkedin.com/in/test-person",
    "entity_type": "person",
    "extracted_data": {
      "fullName": "John Smith",
      "headline": "Managing Partner at Sequoia Capital",
      "location": "San Francisco, CA",
      "currentCompany": "Sequoia Capital",
      "currentTitle": "Managing Partner",
      "about": "Experienced venture capital investor focused on technology startups.",
      "experiences": [
        {
          "company": "Sequoia Capital",
          "title": "Managing Partner",
          "startDate": "2015",
          "endDate": null,
          "isCurrent": true
        }
      ],
      "education": [
        {
          "school": "Stanford University",
          "degree": "MBA",
          "fieldOfStudy": "Business"
        }
      ],
      "skills": ["Venture Capital", "Private Equity", "Startups"]
    }
  }' \
  "$API_URL/api/intelligence/entity/scrape")

if echo "$RESPONSE" | grep -q '"success"'; then
  echo -e "  ${GREEN}✓ PASS${NC} - Scrape data stored"
  echo "  Response: $RESPONSE"
else
  echo -e "  ${RED}✗ FAIL${NC} - Scrape failed"
  echo "  Response: $RESPONSE"
fi

# ------------------------------------------
# Test 4: Check entity again (should exist now)
# ------------------------------------------
echo -e "${YELLOW}[Test 4] Entity check (after scrape)...${NC}"
RESPONSE=$(curl -s -H "Authorization: Bearer $TEST_TOKEN" \
  "$API_URL/api/intelligence/exists?entity=https://www.linkedin.com/in/test-person")
echo "  Response: $RESPONSE"
if echo "$RESPONSE" | grep -q '"exists":true'; then
  echo -e "  ${GREEN}✓ PASS${NC} - Entity now exists in database"
else
  echo -e "  ${YELLOW}~ INFO${NC} - Entity status: $(echo $RESPONSE | python3 -c 'import sys,json;print(json.load(sys.stdin).get("exists","unknown"))' 2>/dev/null || echo 'unknown')"
fi

# ------------------------------------------
# Test 5: Generate report (queues a job)
# ------------------------------------------
echo -e "${YELLOW}[Test 5] Generate report...${NC}"
RESPONSE=$(curl -s -X POST -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "entity": {
      "linkedin_url": "https://www.linkedin.com/in/test-person",
      "entity_type": "person",
      "extracted_data": {
        "full_name": "John Smith",
        "headline": "Managing Partner at Sequoia Capital",
        "current_company": "Sequoia Capital",
        "current_title": "Managing Partner"
      }
    }
  }' \
  "$API_URL/api/intelligence/generate")

if echo "$RESPONSE" | grep -q '"job_id"'; then
  JOB_ID=$(echo "$RESPONSE" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("job_id",""))' 2>/dev/null)
  echo -e "  ${GREEN}✓ PASS${NC} - Report generation queued"
  echo "  Job ID: $JOB_ID"

  # Poll for status
  echo ""
  echo -e "${YELLOW}[Test 6] Polling job status (waiting for Gemini deep research)...${NC}"
  echo -e "  ${BLUE}This may take 1-3 minutes for Gemini to complete research...${NC}"

  for i in $(seq 1 60); do
    sleep 5
    STATUS_RESPONSE=$(curl -s -H "Authorization: Bearer $TEST_TOKEN" \
      "$API_URL/api/intelligence/status/$JOB_ID")
    STATUS=$(echo "$STATUS_RESPONSE" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("status","unknown"))' 2>/dev/null || echo 'unknown')
    PROGRESS=$(echo "$STATUS_RESPONSE" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("progress",0))' 2>/dev/null || echo '0')
    STEP=$(echo "$STATUS_RESPONSE" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("current_step",""))' 2>/dev/null || echo '')

    echo -e "  [$i] Status: $STATUS | Progress: ${PROGRESS}% | Step: $STEP"

    if [ "$STATUS" = "completed" ]; then
      REPORT_URL=$(echo "$STATUS_RESPONSE" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("report_url",""))' 2>/dev/null || echo '')
      echo ""
      echo -e "  ${GREEN}✓ PASS${NC} - Report generation completed!"
      echo -e "  ${BLUE}Report URL: $REPORT_URL${NC}"
      echo ""
      echo -e "  ${GREEN}Open this URL in your browser to see the report:${NC}"
      echo -e "  ${BLUE}$REPORT_URL${NC}"
      break
    fi

    if [ "$STATUS" = "failed" ]; then
      ERROR=$(echo "$STATUS_RESPONSE" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("error_message",""))' 2>/dev/null || echo 'unknown')
      echo -e "  ${RED}✗ FAIL${NC} - Report generation failed: $ERROR"
      break
    fi
  done
else
  echo -e "  ${RED}✗ FAIL${NC} - Report generation failed to queue"
  echo "  Response: $RESPONSE"
fi

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Tests complete!                                             ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
