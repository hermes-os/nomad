#!/bin/bash
# Migration tests for the DOZZLE_ENABLE_SHELL remediation.
#
# Covers both update paths that rewrite a deployed compose file:
#   - install/update_nomad.sh (CLI path: migrate_legacy_compose_file)
#   - install/sidecar-updater/update-watcher.sh (in-app path:
#     migrate_dozzle_shell_setting, runs before the pull and per-service
#     recreate in perform_update)
#
# What it proves: a legacy DOZZLE_ENABLE_SHELL=true flips to false,
# idempotently, without touching anything else; near-miss shapes
# (MY_DOZZLE_ENABLE_SHELL, =truey, =true_extra, commented lines, YAML map
# form, quoted values, TRUE, =1) are left alone.
#
# Checks labeled `smoke:` are no-op-guard checks, not migration proof: a
# correct no-op guard passes under a gutted migration by definition, so
# they are named as preconditions that bound the sed against over-reach,
# paired with the positive flip cases. The `anchor:`-labeled near-miss
# checks (:343 CLI, :448 watcher) are guards of the same kind — a gutted
# migration also leaves near-miss shapes untouched, so they pass under a
# gut too. Six guards in all (4 `smoke:` + 2 near-miss `anchor:`); the
# `anchor: trailing comment` check (:354) is different — it asserts the
# flipped value, so it fails under a gut. Every other behavior check
# carries a positive assertion and fails when the migration is gutted.
#
# Safety: operates ONLY on temp files. The CLI script honors
# NOMAD_DIR/LEGACY_NOMAD_DIR, so those are exported into a temp sandbox
# BEFORE sourcing (even the stripped stream executes the top-of-file
# assignments). The watcher instead hardcodes
# COMPOSE_FILE=/opt/nomad/compose.yml (update-watcher.sh:9) and never
# reads NOMAD_DIR, so the sandbox export does NOT protect it: watcher
# safety comes from invoking migrate_dozzle_shell_setting only with
# COMPOSE_FILE/LOG_FILE pointed at temp files, plus the stripped-stream
# no-top-level-invocation assertion and the host-command stubs below.
# Never touches /opt or any real deployed file.
#
# Usage: bash install/tests/test_dozzle_shell_migration.sh

set -u

PASS=0
FAIL=0

report() {
  local status="$1" name="$2"
  if [[ "$status" == "ok" ]]; then
    PASS=$((PASS + 1))
    echo "PASS: $name"
  else
    FAIL=$((FAIL + 1))
    echo "FAIL: $name"
  fi
}

SANDBOX="$(mktemp -d)"
export NOMAD_DIR="$SANDBOX/nomad"
# Legacy-dir fixture name: the literal legacy value below is declared in
# .branding-allowlist.json under this file's path.
export LEGACY_NOMAD_DIR="$SANDBOX/project-nomad"
mkdir -p "$NOMAD_DIR" "$LEGACY_NOMAD_DIR"

# --- Harness: stub every host-touching command the scripts' main flows need.
sudo() { return 0; }
systemctl() { return 0; }
docker() { return 0; }
hostname() { printf '192.0.2.10\n'; }
mv() { command mv "$@"; }
ln() { command ln "$@"; }
rm() { command rm "$@"; }
readlink() { command readlink "$@"; }
curl() { return 1; }
wget() { return 1; }
jq() { command jq "$@"; }
sleep() { return 0; }
date() { command date "$@"; }
tee() { command tee "$@"; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Source ONLY the function definitions by stripping everything from the
# executable main-flow marker to end of file.
# shellcheck disable=SC1091
source <(sed -e '/^# Pre-flight checks/,$d' "$REPO_ROOT/install/update_nomad.sh")

if ! declare -F migrate_legacy_compose_file >/dev/null; then
  echo "FAIL: migrate_legacy_compose_file not defined after sourcing"
  exit 1
fi

# The stripped stream must contain no top-level invocation: every
# non-comment, non-blank line outside a function body must be a
# declaration (name=..., name()...) or a closing brace. Anything else
# (e.g. check_has_sudo, force_recreate, bare pipelines) would execute on
# source and could touch the host.
STRIPPED_STREAM="$(sed -e '/^# Pre-flight checks/,$d' "$REPO_ROOT/install/update_nomad.sh")"
if awk '
  function depth_change(line,   n, i, c, in_sq) {
    n = 0
    for (i = 1; i <= length(line); i++) {
      c = substr(line, i, 1)
      if (c == "\x27") { in_sq = !in_sq; continue }
      if (in_sq) continue
      if (c == "{") n++
      else if (c == "}") n--
    }
    return n
  }
  /^[[:space:]]*(#|$)/ { next }
  {
    line = $0
    if (in_func > 0) {
      in_func += depth_change(line)
      if (in_func < 0) in_func = 0
      next
    }
    if (line ~ /^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*\(\)/) { in_func = depth_change(line); next }
    if (line ~ /^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*=/ || line ~ /^[[:space:]]*\}/) next
    print "LIVE: " line
    bad = 1
  }
  END { exit bad }
' <<< "$STRIPPED_STREAM"; then
  report ok "sourced update_nomad.sh stream contains no top-level invocation"
else
  report bad "sourced update_nomad.sh stream contains no top-level invocation"
fi

# --- Watcher harness: load migrate_dozzle_shell_setting from the watcher
# with its main watch loop stripped, pointed at temp files.
WATCHER_DIR="$(mktemp -d)"
WATCHER_COMPOSE="$WATCHER_DIR/compose.yml"
WATCHER_LOG="$WATCHER_DIR/update-log"
WATCHER_STATUS="$WATCHER_DIR/update-status"
: > "$WATCHER_LOG"
# shellcheck disable=SC1091
source <(sed -e '/^# Main watch loop/,$d' "$REPO_ROOT/install/sidecar-updater/update-watcher.sh")

if ! declare -F migrate_dozzle_shell_setting >/dev/null; then
  echo "FAIL: migrate_dozzle_shell_setting not defined after sourcing watcher"
  exit 1
fi

# Sourcing the watcher registers its `trap cleanup SIGTERM SIGINT` in THIS
# shell; neutralize it so an interrupt cannot run the watcher's cleanup
# (which logs toward shared paths and `exit 0`s) and mask an aborted run.
trap - SIGTERM SIGINT

WATCHER_STRIPPED="$(sed -e '/^# Main watch loop/,$d' "$REPO_ROOT/install/sidecar-updater/update-watcher.sh")"
if awk '
  function depth_change(line,   n, i, c, in_sq) {
    n = 0
    for (i = 1; i <= length(line); i++) {
      c = substr(line, i, 1)
      if (c == "\x27") { in_sq = !in_sq; continue }
      if (in_sq) continue
      if (c == "{") n++
      else if (c == "}") n--
    }
    return n
  }
  /^[[:space:]]*(#|$)/ { next }
  {
    line = $0
    if (in_func > 0) {
      in_func += depth_change(line)
      if (in_func < 0) in_func = 0
      next
    }
    if (line ~ /^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*\(\)/) { in_func = depth_change(line); next }
    if (line ~ /^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*=/ || line ~ /^[[:space:]]*\}/) next
    if (line ~ /^trap[[:space:]]/) next
    print "LIVE: " line
    bad = 1
  }
  END { exit bad }
' <<< "$WATCHER_STRIPPED"; then
  report ok "sourced watcher stream contains no top-level invocation"
else
  report bad "sourced watcher stream contains no top-level invocation"
fi

# The watcher must call the migration inside perform_update, before that
# same body's pull and per-service recreate. A whole-file line-number
# comparison cannot prove this: a bare call parked in never-invoked dead
# code earlier in the file passes it while perform_update migrates nothing.
# So the body is extracted first (opener `perform_update() {` through the
# first column-0 `}`) and the bare call must appear inside it, before that
# body's real `docker compose` invocations. The call is a bare invocation
# only — the () definition, #-comments (indented or not), and lines with
# trailing text never count. Comment lines are skipped on the raw line
# (before any NN: prefix could defeat the filter), and the pull/recreate
# anchors require the real `docker compose` invocation, so a comment merely
# mentioning "compose ... pull" cannot stand in for it.
WATCHER_BODY="$(sed -n '/^perform_update() {/,/^}/p' "$REPO_ROOT/install/sidecar-updater/update-watcher.sh")"
MIG_LINE="$(printf '%s\n' "$WATCHER_BODY" | awk '/^[[:space:]]*#/ { next } /^[[:space:]]*migrate_dozzle_shell_setting[[:space:]]*$/ { print NR; exit }')"
PULL_LINE="$(printf '%s\n' "$WATCHER_BODY" | awk '/^[[:space:]]*#/ { next } /docker compose.*pull/ { print NR; exit }')"
UP_LINE="$(printf '%s\n' "$WATCHER_BODY" | awk '/^[[:space:]]*#/ { next } /docker compose.*up -d --no-deps/ { print NR; exit }')"
if [[ -n "$WATCHER_BODY" && -n "${MIG_LINE:-}" && -n "${PULL_LINE:-}" && -n "${UP_LINE:-}" ]] \
  && [[ "$MIG_LINE" -lt "$PULL_LINE" ]] && [[ "$MIG_LINE" -lt "$UP_LINE" ]]; then
  report ok "watcher migrates inside perform_update before pull and recreate (body lines $MIG_LINE < $PULL_LINE, $UP_LINE)"
else
  report bad "watcher migrates inside perform_update before pull and recreate (mig=${MIG_LINE:-EMPTY} pull=${PULL_LINE:-EMPTY} up=${UP_LINE:-EMPTY})"
fi

LEGACY_FRAGMENT="$(mktemp)"
trap 'rm -f "$LEGACY_FRAGMENT" "$LEGACY_FRAGMENT.orig" "$LEGACY_FRAGMENT.once" "$LEGACY_FRAGMENT.expected"; rm -rf "$SANDBOX" "$WATCHER_DIR"' EXIT

# --- Case 1: legacy fragment with DOZZLE_ENABLE_SHELL=true gets closed.
cat > "$LEGACY_FRAGMENT" <<'EOF'
  dozzle:
    image: amir20/dozzle:v10.0
    container_name: nomad_dozzle
    restart: unless-stopped
    ports:
      - "9999:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - DOZZLE_ENABLE_ACTIONS=true
      - DOZZLE_ENABLE_SHELL=true  # Enables web-based shell access
  mysql:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=replaceme
EOF
cp "$LEGACY_FRAGMENT" "$LEGACY_FRAGMENT.orig"

migrate_legacy_compose_file "$LEGACY_FRAGMENT"

if grep -q 'DOZZLE_ENABLE_SHELL=false' "$LEGACY_FRAGMENT" \
  && ! grep -q 'DOZZLE_ENABLE_SHELL=true' "$LEGACY_FRAGMENT"; then
  report ok "legacy true flipped to false"
else
  report bad "legacy true flipped to false"
fi

# Nothing else touched: the result must equal an explicit post-image with
# exactly the single expected hunk (true->false on the targeted line).
# A reverse-substitution diff alone cannot show this: it also passes when
# the migration does nothing, and it masks unrelated edits on lines
# carrying the same token.
cat > "$LEGACY_FRAGMENT.expected" <<'EOF'
  dozzle:
    image: amir20/dozzle:v10.0
    container_name: nomad_dozzle
    restart: unless-stopped
    ports:
      - "9999:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - DOZZLE_ENABLE_ACTIONS=true
      - DOZZLE_ENABLE_SHELL=false  # Enables web-based shell access
  mysql:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=replaceme
EOF
if diff "$LEGACY_FRAGMENT.expected" "$LEGACY_FRAGMENT" >/dev/null; then
  report ok "only the targeted line changed (exact post-image match)"
else
  report bad "only the targeted line changed (exact post-image match)"
  diff "$LEGACY_FRAGMENT.expected" "$LEGACY_FRAGMENT" || true
fi

# Same fixture, still carrying the positive flip: companions must hold.
if grep -q 'DOZZLE_ENABLE_SHELL=false' "$LEGACY_FRAGMENT" \
  && grep -q 'DOZZLE_ENABLE_ACTIONS=true' "$LEGACY_FRAGMENT" \
  && grep -q 'MYSQL_ROOT_PASSWORD=replaceme' "$LEGACY_FRAGMENT" \
  && grep -q '"9999:8080"' "$LEGACY_FRAGMENT"; then
  report ok "actions, credentials, ports preserved (with flip asserted)"
else
  report bad "actions, credentials, ports preserved (with flip asserted)"
fi

# --- Case 2: idempotency — second run changes nothing.
cp "$LEGACY_FRAGMENT" "$LEGACY_FRAGMENT.once"
migrate_legacy_compose_file "$LEGACY_FRAGMENT"
if diff -q "$LEGACY_FRAGMENT" "$LEGACY_FRAGMENT.once" >/dev/null \
  && grep -q 'DOZZLE_ENABLE_SHELL=false' "$LEGACY_FRAGMENT" \
  && [[ "$(grep -c 'DOZZLE_ENABLE_SHELL' "$LEGACY_FRAGMENT")" == "1" ]]; then
  report ok "idempotent on second run (no dup, no flip-back)"
else
  report bad "idempotent on second run (no dup, no flip-back)"
fi
rm -f "$LEGACY_FRAGMENT.once" "$LEGACY_FRAGMENT.orig" "$LEGACY_FRAGMENT.expected"

# --- Case 3: already-false file is a no-op (guard check, not proof).
cat > "$LEGACY_FRAGMENT" <<'EOF'
    environment:
      - DOZZLE_ENABLE_ACTIONS=true
      - DOZZLE_ENABLE_SHELL=false  # Shell access is unauthenticated on the LAN; keep disabled
EOF
cp "$LEGACY_FRAGMENT" "$LEGACY_FRAGMENT.orig"
migrate_legacy_compose_file "$LEGACY_FRAGMENT"
if diff -q "$LEGACY_FRAGMENT" "$LEGACY_FRAGMENT.orig" >/dev/null; then
  report ok "smoke: already-false file untouched (no-op guard, not migration proof)"
else
  report bad "smoke: already-false file untouched (no-op guard, not migration proof)"
fi
rm -f "$LEGACY_FRAGMENT.orig"

# --- Case 4: file lacking the key is a no-op (guard check, not proof).
cat > "$LEGACY_FRAGMENT" <<'EOF'
  redis:
    image: redis:7-alpine
    environment:
      - REDIS_PASSWORD=replaceme
EOF
cp "$LEGACY_FRAGMENT" "$LEGACY_FRAGMENT.orig"
migrate_legacy_compose_file "$LEGACY_FRAGMENT"
if diff -q "$LEGACY_FRAGMENT" "$LEGACY_FRAGMENT.orig" >/dev/null; then
  report ok "smoke: file without key untouched (no-op guard, not migration proof)"
else
  report bad "smoke: file without key untouched (no-op guard, not migration proof)"
fi
rm -f "$LEGACY_FRAGMENT.orig"

# --- Case 5: whitespace / spacing variants of the line still close.
printf '      -   DOZZLE_ENABLE_SHELL  =  true\n' > "$LEGACY_FRAGMENT"
migrate_legacy_compose_file "$LEGACY_FRAGMENT"
if grep -q 'DOZZLE_ENABLE_SHELL=false' "$LEGACY_FRAGMENT" \
  && ! grep -q 'true' "$LEGACY_FRAGMENT"; then
  report ok "whitespace variant flipped"
else
  report bad "whitespace variant flipped"
fi

# --- Case 6 (anchoring): near-miss shapes must NOT be rewritten.
cat > "$LEGACY_FRAGMENT" <<'EOF'
    environment:
      - MY_DOZZLE_ENABLE_SHELL=true
      - DOZZLE_ENABLE_SHELL=truey
      - DOZZLE_ENABLE_SHELL=true_extra
#      - DOZZLE_ENABLE_SHELL=true
      - DOZZLE_ENABLE_SHELL=TRUE
      - DOZZLE_ENABLE_SHELL=1
      - DOZZLE_ENABLE_SHELL="true"
      DOZZLE_ENABLE_SHELL: true
EOF
cp "$LEGACY_FRAGMENT" "$LEGACY_FRAGMENT.orig"
migrate_legacy_compose_file "$LEGACY_FRAGMENT"
if diff -q "$LEGACY_FRAGMENT" "$LEGACY_FRAGMENT.orig" >/dev/null; then
  report ok "anchor: near-miss shapes untouched"
else
  report bad "anchor: near-miss shapes untouched"
  diff "$LEGACY_FRAGMENT.orig" "$LEGACY_FRAGMENT" || true
fi
rm -f "$LEGACY_FRAGMENT.orig"

# --- Case 7: anchored flip preserves the trailing comment exactly.
printf '      - DOZZLE_ENABLE_SHELL=true  # Enables web-based shell access\n' > "$LEGACY_FRAGMENT"
migrate_legacy_compose_file "$LEGACY_FRAGMENT"
if grep -qx '      - DOZZLE_ENABLE_SHELL=false  # Enables web-based shell access' "$LEGACY_FRAGMENT"; then
  report ok "anchor: trailing comment preserved exactly"
else
  report bad "anchor: trailing comment preserved exactly"
fi

# --- Case 8 (watcher): fixture compose with the key true comes out
# false, idempotently, with no other line changed.
cat > "$WATCHER_COMPOSE" <<'EOF'
  dozzle:
    image: amir20/dozzle:v10.0
    container_name: nomad_dozzle
    environment:
      - DOZZLE_ENABLE_ACTIONS=true
      - DOZZLE_ENABLE_SHELL=true  # Enables web-based shell access
  mysql:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=replaceme
EOF
cat > "$WATCHER_COMPOSE.expected" <<'EOF'
  dozzle:
    image: amir20/dozzle:v10.0
    container_name: nomad_dozzle
    environment:
      - DOZZLE_ENABLE_ACTIONS=true
      - DOZZLE_ENABLE_SHELL=false  # Enables web-based shell access
  mysql:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=replaceme
EOF
COMPOSE_FILE="$WATCHER_COMPOSE" LOG_FILE="$WATCHER_LOG" migrate_dozzle_shell_setting
if grep -q 'DOZZLE_ENABLE_SHELL=false' "$WATCHER_COMPOSE" \
  && ! grep -q 'DOZZLE_ENABLE_SHELL=true' "$WATCHER_COMPOSE" \
  && diff "$WATCHER_COMPOSE.expected" "$WATCHER_COMPOSE" >/dev/null; then
  report ok "watcher: fixture true flipped, exact post-image match"
else
  report bad "watcher: fixture true flipped, exact post-image match"
  diff "$WATCHER_COMPOSE.expected" "$WATCHER_COMPOSE" || true
fi
cp "$WATCHER_COMPOSE" "$WATCHER_COMPOSE.once"
COMPOSE_FILE="$WATCHER_COMPOSE" LOG_FILE="$WATCHER_LOG" migrate_dozzle_shell_setting
if diff -q "$WATCHER_COMPOSE" "$WATCHER_COMPOSE.once" >/dev/null \
  && grep -q 'DOZZLE_ENABLE_SHELL=false' "$WATCHER_COMPOSE" \
  && [[ "$(grep -c 'DOZZLE_ENABLE_SHELL' "$WATCHER_COMPOSE")" == "1" ]]; then
  report ok "watcher: idempotent on second run (migrated state asserted)"
else
  report bad "watcher: idempotent on second run (migrated state asserted)"
fi
rm -f "$WATCHER_COMPOSE.expected" "$WATCHER_COMPOSE.once"

# --- Case 9 (watcher): absent key and already-false are no-ops
# (guard checks, not proof).
printf '    environment:\n      - DOZZLE_ENABLE_SHELL=false\n' > "$WATCHER_COMPOSE"
cp "$WATCHER_COMPOSE" "$WATCHER_COMPOSE.orig"
COMPOSE_FILE="$WATCHER_COMPOSE" LOG_FILE="$WATCHER_LOG" migrate_dozzle_shell_setting
if diff -q "$WATCHER_COMPOSE" "$WATCHER_COMPOSE.orig" >/dev/null; then
  report ok "smoke: watcher already-false untouched (no-op guard, not migration proof)"
else
  report bad "smoke: watcher already-false untouched (no-op guard, not migration proof)"
fi
printf '    environment:\n      - REDIS_PASSWORD=replaceme\n' > "$WATCHER_COMPOSE"
cp "$WATCHER_COMPOSE" "$WATCHER_COMPOSE.orig"
COMPOSE_FILE="$WATCHER_COMPOSE" LOG_FILE="$WATCHER_LOG" migrate_dozzle_shell_setting
if diff -q "$WATCHER_COMPOSE" "$WATCHER_COMPOSE.orig" >/dev/null; then
  report ok "smoke: watcher missing key untouched (no-op guard, not migration proof)"
else
  report bad "smoke: watcher missing key untouched (no-op guard, not migration proof)"
fi
rm -f "$WATCHER_COMPOSE.orig"

# --- Case 10 (watcher): unreadable compose file never aborts the update,
# and the guard's own WARNING is observed (a bare exit-0 check cannot
# tell the unreadable guard from the sed-failure path).
: > "$WATCHER_LOG"
COMPOSE_FILE="$WATCHER_DIR/does-not-exist.yml" LOG_FILE="$WATCHER_LOG" migrate_dozzle_shell_setting
guard_status="$?"
if [[ "$guard_status" == "0" ]] && grep -q 'WARNING.*unreadable' "$WATCHER_LOG"; then
  report ok "watcher: unreadable file is a guarded no-op success"
else
  report bad "watcher: unreadable file is a guarded no-op success"
fi

# --- Case 11 (watcher): near-miss shapes untouched by the watcher too.
cat > "$WATCHER_COMPOSE" <<'EOF'
    environment:
      - MY_DOZZLE_ENABLE_SHELL=true
      - DOZZLE_ENABLE_SHELL=truey
#      - DOZZLE_ENABLE_SHELL=true
      - DOZZLE_ENABLE_SHELL=TRUE
EOF
cp "$WATCHER_COMPOSE" "$WATCHER_COMPOSE.orig"
COMPOSE_FILE="$WATCHER_COMPOSE" LOG_FILE="$WATCHER_LOG" migrate_dozzle_shell_setting
if diff -q "$WATCHER_COMPOSE" "$WATCHER_COMPOSE.orig" >/dev/null; then
  report ok "watcher: near-miss shapes untouched"
else
  report bad "watcher: near-miss shapes untouched"
fi
rm -f "$WATCHER_COMPOSE.orig"

echo "---"
echo "passed=$PASS failed=$FAIL"
[[ "$FAIL" == "0" ]]
