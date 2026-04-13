#!/bin/bash
##############################################
# Migrate data from Neon Postgres → VPS Postgres
#
# Usage (run from local machine):
#   bash scripts/migrate-neon-to-vps.sh
#
# Prerequisites on local machine:
#   - pg_dump   (postgresql-client)
#   - psql      (postgresql-client)
#
# What it does:
#   1. Verifies connectivity to both databases
#   2. Counts rows in each table on source (Neon)
#   3. Dumps data-only from Neon (SSL required)
#   4. Loads dump into VPS (disables triggers to skip FK checks)
#   5. Counts rows on target (VPS) and prints a diff summary
#
# Assumptions:
#   - Schema already exists on VPS (pushed via drizzle-kit push)
#   - VPS port 5432 is reachable from local machine
#     If not: open the port, or set VPS_USE_TUNNEL=1 (see SSH tunnel section)
##############################################

set -euo pipefail

# ── Connection strings ─────────────────────────────────────────────────────────
NEON_URL="postgresql://neondb_owner:npg_1aCVdyzq0PAM@ep-falling-boat-anzzfgis-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require"
VPS_HOST="103.116.52.54"
VPS_PORT="5432"
VPS_USER="dashboard"
VPS_PASS="dashboard_2026"
VPS_DB="dashboard_v2"
VPS_URL="postgresql://${VPS_USER}:${VPS_PASS}@${VPS_HOST}:${VPS_PORT}/${VPS_DB}"

# ── SSH tunnel option ──────────────────────────────────────────────────────────
# If VPS port 5432 is firewalled, set VPS_USE_TUNNEL=1 and fill in SSH details.
# The script will open a local tunnel on port 15432 → VPS:5432.
#
#   export VPS_USE_TUNNEL=1
#   export VPS_SSH_USER=root          # or your SSH user
#   bash scripts/migrate-neon-to-vps.sh
VPS_USE_TUNNEL="${VPS_USE_TUNNEL:-0}"
VPS_SSH_USER="${VPS_SSH_USER:-root}"
TUNNEL_LOCAL_PORT="15432"
TUNNEL_PID=""

# ── Temp files ─────────────────────────────────────────────────────────────────
DUMP_FILE="$(mktemp /tmp/neon_dump_XXXXXX.sql)"

# ── Table list (all tables in schema, snake_case) ──────────────────────────────
# Drizzle casing: snake_case maps camelCase variable names automatically.
TABLES=(
  users
  accounts
  sessions
  verification_tokens
  stages
  stage_aliases
  sources
  projects
  project_users
  fanpages
  project_fanpages
  project_ad_accounts
  campaigns
  adsets
  ads
  leads
  lead_snapshots
  lead_stage_events
  project_costs
  campaign_insights
  ad_insights
  campaign_actions
  daily_aggregates
  monthly_aggregates
  employees
  csv_uploads
  match_conflicts
  chat_conversations
  chat_messages
)

# ── Colour helpers ─────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()      { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ── Cleanup on exit ────────────────────────────────────────────────────────────
cleanup() {
  if [ -f "$DUMP_FILE" ]; then
    rm -f "$DUMP_FILE"
    info "Removed temp dump file."
  fi
  if [ -n "$TUNNEL_PID" ]; then
    kill "$TUNNEL_PID" 2>/dev/null || true
    info "SSH tunnel closed (pid $TUNNEL_PID)."
  fi
}
trap cleanup EXIT

# ── Dependency check ───────────────────────────────────────────────────────────
check_deps() {
  local missing=0
  for cmd in pg_dump psql; do
    if ! command -v "$cmd" &>/dev/null; then
      error "$cmd not found. Install postgresql-client and retry."
      missing=1
    fi
  done
  if [ "$VPS_USE_TUNNEL" = "1" ] && ! command -v ssh &>/dev/null; then
    error "ssh not found (required for tunnel mode)."
    missing=1
  fi
  [ "$missing" -eq 0 ] || exit 1
}

# ── SSH tunnel ─────────────────────────────────────────────────────────────────
open_tunnel() {
  info "Opening SSH tunnel: localhost:${TUNNEL_LOCAL_PORT} → ${VPS_HOST}:${VPS_PORT} ..."
  ssh -f -N -L "${TUNNEL_LOCAL_PORT}:localhost:${VPS_PORT}" \
    "${VPS_SSH_USER}@${VPS_HOST}" -o ExitOnForwardFailure=yes \
    -o StrictHostKeyChecking=accept-new
  # Find the PID of the background ssh process
  TUNNEL_PID=$(pgrep -f "ssh -f -N -L ${TUNNEL_LOCAL_PORT}" | tail -1)
  VPS_HOST="127.0.0.1"
  VPS_PORT="$TUNNEL_LOCAL_PORT"
  VPS_URL="postgresql://${VPS_USER}:${VPS_PASS}@${VPS_HOST}:${VPS_PORT}/${VPS_DB}"
  ok "Tunnel open (pid $TUNNEL_PID). VPS target: ${VPS_HOST}:${VPS_PORT}"
}

# ── Connectivity check ─────────────────────────────────────────────────────────
check_connectivity() {
  info "Checking Neon connectivity..."
  if PGPASSWORD="" psql "$NEON_URL" -c "SELECT 1;" -q --tuples-only 2>/dev/null | grep -q 1; then
    ok "Neon reachable."
  else
    error "Cannot connect to Neon. Check credentials or network."
    exit 1
  fi

  info "Checking VPS connectivity..."
  if PGPASSWORD="$VPS_PASS" psql "$VPS_URL" -c "SELECT 1;" -q --tuples-only 2>/dev/null | grep -q 1; then
    ok "VPS reachable."
  else
    error "Cannot connect to VPS Postgres at ${VPS_HOST}:${VPS_PORT}."
    echo ""
    warn "Possible causes:"
    warn "  1. Port 5432 is firewalled on the VPS."
    warn "     Fix: ssh root@${VPS_HOST} \"ufw allow 5432/tcp\""
    warn "     Or:  ssh root@${VPS_HOST} \"iptables -A INPUT -p tcp --dport 5432 -j ACCEPT\""
    warn "  2. PostgreSQL is not listening on 0.0.0.0."
    warn "     Fix: edit /etc/postgresql/*/main/postgresql.conf"
    warn "          set listen_addresses = '*'"
    warn "          and /etc/postgresql/*/main/pg_hba.conf — add a host rule"
    warn "  3. Or re-run with SSH tunnel:"
    warn "     export VPS_USE_TUNNEL=1"
    warn "     export VPS_SSH_USER=root"
    warn "     bash scripts/migrate-neon-to-vps.sh"
    exit 1
  fi
}

# ── Row count helper ───────────────────────────────────────────────────────────
count_rows() {
  local url="$1"
  local table="$2"
  local pass="${3:-}"
  PGPASSWORD="$pass" psql "$url" -t -c "SELECT COUNT(*) FROM \"${table}\";" 2>/dev/null | tr -d ' ' || echo "N/A"
}

# ── Print row counts for all tables ───────────────────────────────────────────
print_counts() {
  local label="$1"
  local url="$2"
  local pass="$3"

  echo ""
  echo -e "${CYAN}--- Row counts: ${label} ---${NC}"
  printf "%-35s %10s\n" "TABLE" "ROWS"
  printf "%-35s %10s\n" "-----" "----"
  for tbl in "${TABLES[@]}"; do
    local cnt
    cnt=$(count_rows "$url" "$tbl" "$pass")
    printf "%-35s %10s\n" "$tbl" "$cnt"
  done
}

# ── Main ───────────────────────────────────────────────────────────────────────
main() {
  echo ""
  echo "============================================"
  echo "  Neon → VPS Data Migration"
  echo "  $(date '+%Y-%m-%d %H:%M:%S')"
  echo "============================================"
  echo ""

  check_deps

  if [ "$VPS_USE_TUNNEL" = "1" ]; then
    open_tunnel
    sleep 1  # give the tunnel a moment to establish
  fi

  check_connectivity

  # ── Step 1: Row counts BEFORE on source ────────────────────────────────────
  print_counts "Neon (source)" "$NEON_URL" ""

  # ── Step 2: Row counts BEFORE on target ────────────────────────────────────
  print_counts "VPS (target — before import)" "$VPS_URL" "$VPS_PASS"

  # ── Step 3: Dump data-only from Neon ──────────────────────────────────────
  echo ""
  info "Dumping data from Neon to ${DUMP_FILE} ..."
  info "This may take a minute depending on data volume..."

  PGPASSWORD="" pg_dump \
    "$NEON_URL" \
    --data-only \
    --disable-triggers \
    --no-privileges \
    --no-owner \
    --format=plain \
    --file="$DUMP_FILE"

  DUMP_SIZE=$(du -sh "$DUMP_FILE" | cut -f1)
  ok "Dump complete. File size: ${DUMP_SIZE}"

  # ── Step 4: Load into VPS ──────────────────────────────────────────────────
  echo ""
  info "Loading dump into VPS (${VPS_HOST}:${VPS_PORT}/${VPS_DB}) ..."
  info "Using --single-transaction for atomic import..."

  PGPASSWORD="$VPS_PASS" psql \
    "$VPS_URL" \
    --single-transaction \
    --quiet \
    --file="$DUMP_FILE" \
    2>&1 | tee /tmp/migration_errors.log || {
      error "psql import reported errors. Check /tmp/migration_errors.log"
      error "The transaction was rolled back — VPS data is unchanged."
      exit 1
    }

  ok "Import complete."

  # ── Step 5: Row counts AFTER on target ────────────────────────────────────
  print_counts "VPS (target — after import)" "$VPS_URL" "$VPS_PASS"

  # ── Step 6: Summary diff ──────────────────────────────────────────────────
  echo ""
  echo -e "${CYAN}--- Migration Summary ---${NC}"
  printf "%-35s %12s %12s %10s\n" "TABLE" "NEON" "VPS" "STATUS"
  printf "%-35s %12s %12s %10s\n" "-----" "----" "---" "------"

  all_ok=1
  for tbl in "${TABLES[@]}"; do
    neon_cnt=$(count_rows "$NEON_URL" "$tbl" "")
    vps_cnt=$(count_rows  "$VPS_URL"  "$tbl" "$VPS_PASS")

    if [ "$neon_cnt" = "N/A" ] || [ "$vps_cnt" = "N/A" ]; then
      status="SKIP"
    elif [ "$neon_cnt" = "$vps_cnt" ]; then
      status="OK"
    else
      status="MISMATCH"
      all_ok=0
    fi

    if [ "$status" = "MISMATCH" ]; then
      printf "${RED}%-35s %12s %12s %10s${NC}\n" "$tbl" "$neon_cnt" "$vps_cnt" "$status"
    elif [ "$status" = "OK" ]; then
      printf "${GREEN}%-35s %12s %12s %10s${NC}\n" "$tbl" "$neon_cnt" "$vps_cnt" "$status"
    else
      printf "%-35s %12s %12s %10s\n" "$tbl" "$neon_cnt" "$vps_cnt" "$status"
    fi
  done

  echo ""
  if [ "$all_ok" -eq 1 ]; then
    ok "All tables migrated successfully."
  else
    warn "Some tables have row count mismatches. Review the output above."
    warn "If counts are expected to differ (e.g., sequences), this may be OK."
  fi

  echo ""
  echo "============================================"
  echo "  Migration finished: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "  VPS: postgresql://${VPS_USER}:***@${VPS_HOST}:${VPS_PORT}/${VPS_DB}"
  echo "============================================"
}

main "$@"
