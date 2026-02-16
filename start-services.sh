#!/bin/bash
# ==============================================================
# Nvestiv Intelligence Extension - Start All Services
# ==============================================================
# Starts the Intelligence API, Report Worker, and Report Page
# in parallel. Press Ctrl+C to stop all services.
#
# Usage: bash start-services.sh
# ==============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Starting Nvestiv Services                   ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo ""

# Track PIDs for cleanup
PIDS=()

cleanup() {
  echo ""
  echo -e "${YELLOW}Shutting down all services...${NC}"
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null
    fi
  done
  wait
  echo -e "${GREEN}All services stopped.${NC}"
  exit 0
}

trap cleanup SIGINT SIGTERM

# Check Redis
if ! docker ps --filter "name=nvestiv-redis" --format "{{.Names}}" | grep -q "nvestiv-redis"; then
  echo -e "${YELLOW}Starting Redis...${NC}"
  docker run -d --name nvestiv-redis -p 6379:6379 redis:7-alpine >/dev/null 2>&1 || \
    docker start nvestiv-redis >/dev/null 2>&1
fi
echo -e "  ${GREEN}✓${NC} Redis running on port 6379"

# Start Intelligence API
echo -e "  ${CYAN}Starting Intelligence API on port 3001...${NC}"
cd "$SCRIPT_DIR/intelligence-api"
npm run dev &
PIDS+=($!)

# Start Report Worker
echo -e "  ${CYAN}Starting Report Worker...${NC}"
cd "$SCRIPT_DIR/intelligence-api"
npm run worker:dev &
PIDS+=($!)

# Start Report Page
echo -e "  ${CYAN}Starting Report Page on port 3000...${NC}"
cd "$SCRIPT_DIR/report-page"
npx next dev -p 3000 &
PIDS+=($!)

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  All services running!                                       ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Intelligence API:  ${BLUE}http://localhost:3001/health${GREEN}              ║${NC}"
echo -e "${GREEN}║  Report Page:       ${BLUE}http://localhost:3000${GREEN}                     ║${NC}"
echo -e "${GREEN}║  Report Worker:     Running in background                    ║${NC}"
echo -e "${GREEN}║  Redis:             localhost:6379                            ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Press ${RED}Ctrl+C${GREEN} to stop all services                           ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Wait for all background processes
wait
