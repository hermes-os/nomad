# Stage 04 verification evidence: Dozzle web-shell remediation

Branch: `cal/dozzle-shell-remediation-20260908`
HEAD: `b3a5cd6048396ab4ed112abfe3aab4db6fdd05d8` (confirmed via `git rev-parse`;
no commit/push performed in this pass).
Committed diff vs `main` is unchanged: one line in one file —
`install/management_compose.yaml:56`, `DOZZLE_ENABLE_SHELL=true` → `false`.
Working-tree changes in THIS pass (uncommitted): two anchored migration
`-e` lines in `migrate_legacy_compose_file()` (`install/update_nomad.sh`),
a new `migrate_dozzle_shell_setting()` + call in
`install/sidecar-updater/update-watcher.sh` (in-app update path), two new
node cases in `tests/repository_rename.test.mjs`, the root `package.json`
`test` script now chaining the shell migration test, one new
`.branding-allowlist.json` entry declaring the shell test's legacy-dir
fixture value (without it the repo's own branding check fails on the
staged test file), plus the new
migration test `install/tests/test_dozzle_shell_migration.sh` (STAGED, `A `
in `git status`, not untracked — the word "untracked" below for it is
corrected in the Superseding notes).
(Five tracked paths changed: `install/update_nomad.sh`,
`install/sidecar-updater/update-watcher.sh`, `tests/repository_rename.test.mjs`,
`.branding-allowlist.json`, `package.json`, plus the staged new test file
`install/tests/test_dozzle_shell_migration.sh`; the earlier header
describing this as "one migration -e
line plus the new migration test" understated the true scope and is
corrected here.)
No result below is claimed from memory; every status was observed in this pass.

## Gate results (in `_shared/verification.md` order, run from repo root)

Node was provisioned via the repo's own `.mise.toml` (`mise install`, node
24.21.0) because `node`/`npm` were absent from PATH. `$HOME` is read-only in
this sandbox, so the first `ci` attempt failed on npm's default cache dir; it
was re-run with `NPM_CONFIG_CACHE=/tmp/npm-cache` (cache location only, no
project file touched). `git status` is still clean apart from this file.

1. `npm --prefix admin ci`
   - First attempt (default npm cache): exit 254.
     Tail: `npm error enoent ENOENT: no such file or directory, mkdir
     '/var/lib/agent-worker/.npm'`.
   - Re-run `NPM_CONFIG_CACHE=/tmp/npm-cache NPM_CONFIG_UPDATE_NOTIFIER=false
     npm --prefix admin ci`: exit 0.
     Tail: `Run 'npm audit' for details.` plus install-scripts notices for 10
     packages; final line `EXIT_STATUS=0`. No `package.json`/`package-lock.json`
     change (`git status` clean).

2. `npm --prefix admin test`
   - Bare run, exactly as documented: exit 1.
     Tail: `EnvValidationException` — `Missing environment variable "APP_KEY"`,
     `"HOST"`, `"URL"`, `"LOG_LEVEL"`, `"DB_HOST"`, `"DB_PORT"`, `"DB_USER"`,
     `"DB_DATABASE"`, `"REDIS_HOST"`, `"REDIS_PORT"` at `start/env.ts:14`. This
     is missing local env config, not a code failure; no test executed.
   - Re-run with the repo's own `admin/.env.example` values exported into the
     process environment only (`set -a; . ./admin/.env.example`, `NODE_ENV=test`;
     no `.env` file was written): exit 0.
     Tail: `PASSED`, `Tests 26 passed (26)` (26 check marks, 0 failures).
   - Socket note: `verification.md` warns this command binds `0.0.0.0:3333`.
     No bind error occurred. Only the `unit` suite exists
     (`admin/tests/functional/` is absent), so no HTTP server was started; the
     sandbox socket restriction was not exercised either way.

3. `npm --prefix admin run lint` — exit 1 (pre-existing, out of scope).
   Tail: `✖ 1339 problems (1337 errors, 2 warnings)`, `1291 errors and 0
   warnings potentially fixable with the '--fix' option`. Verified histogram
   of the 1337 errors (this pass, `grep -oE` on rule names, counts sum to
   1337): `prettier/prettier` 1142, `@adonisjs/prefer-lazy-controller-import`
   88, `@unicorn/prefer-number-properties` 36,
   `@unicorn/prefer-node-protocol` 26, `@unicorn/filename-case` 15,
   `@unicorn/no-await-expression-member` 11, `@typescript-eslint/no-shadow`
   7, `@typescript-eslint/naming-convention` 6, `no-control-regex` 4,
   `@unicorn/no-for-loop` 1, `@tanstack/query/exhaustive-deps` 1 (the last
   is in a generated bundle `admin/public/assets/models-*.js`). The 2
   warnings are both `@tanstack/query/no-rest-destructuring`. So the bulk is
   formatting, but the tail is not: `no-await-expression-member`,
   `no-shadow`, `no-control-regex`, and `exhaustive-deps` are
   correctness-adjacent. Verified unrelated to this branch: `git diff main
   --name-only -- admin/` is empty and no `.ts` file is in the diff, so these
   failures exist identically on `main`. Fixing them would violate the
   one-finding-per-pass and no-unrelated-formatting constraints, so they were
   left untouched.

4. `npm --prefix admin run typecheck` — exit 0.
   Tail: `> nomad-admin@0.0.0 typecheck` / `> tsc --noEmit`, no errors.

5. `npm --prefix admin run build` — exit 0.
   Tail: `✓ built in 24.15s`, `[ success ] build completed`.

6. `agent-repo-check --repo "$PWD"` — exit 0.
   Tail: `Repository check: PASS (...)`.

Supplementary (re-observed in this pass, same checks Stage 03 recorded):
- `docker compose -f install/management_compose.yaml config --quiet` — exit 0,
  no output (schema/parse valid, nothing started).
- Rendered `dozzle` service: `DOZZLE_ENABLE_ACTIONS: "true"`,
  `DOZZLE_ENABLE_SHELL: "false"`, `published: "9999"` → `target: 8080`.
- `python3 -c` PyYAML `safe_load`: exit 0 — `services.dozzle.environment =
  ['DOZZLE_ENABLE_ACTIONS=true', 'DOZZLE_ENABLE_SHELL=false']`, ports
  `['9999:8080']`, socket mount unchanged, services still
  `admin, dozzle, mysql, redis, updater`.

## Gate verdict: NOT green (partial)

`test` (26/26 with documented env), `typecheck`, `build`, `agent-repo-check`,
and compose-config validation pass. `lint` fails with 1337 pre-existing errors
on `main`-identical `admin/` sources untouched by this branch. The lint failure
is recorded as-is; it is not skipped and not reported as green. No gate step
was unrunnable, so there is no socket/env blocker — but the gate as a whole
cannot be called green while lint fails.

## Adversarial review (each finding verified against real code)

R1 — Does `false` close the exact trigger, or only the spec's shape? The
finding's trigger is the compose input `DOZZLE_ENABLE_SHELL=true` at
`install/management_compose.yaml:50-56` plus the all-interfaces `9999:8080`
publish and socket mount. The fix flips exactly that input; rendered config
confirms `DOZZLE_ENABLE_SHELL: "false"`. The route-registration claim
(`EnableShell` gates attach/exec) rests on Stage 03's pinned-image source
reading and was not re-observed here — recorded as residual risk, not as
verified fact. No code change in this pass could strengthen this further
within scope. Resolution: accept with residual risk noted.

R2 — Second call site or second compose file with the same defect? Searched
the tree for `DOZZLE_ENABLE_SHELL`: only `install/management_compose.yaml:56`
(the fix) and `admin/docs/security-audit-v1.md:144,149` (the audit report
describing the old value — documentation, not a live setting). File search
for `*.y*ml` returns exactly one compose file. `ENABLE_SHELL`/`ENABLE_ACTIONS`
appear nowhere under `install/` outside the compose template
(`install_nomad.sh`, `update_nomad.sh` reference only container names).
SUPERSEDED by the P1 finding: this R2 was written before the review
established that already-installed hosts are NOT fixed by the template change.
`install/update_nomad.sh` never re-downloads the compose template (grep for
`curl`, `MANAGEMENT_COMPOSE`, `raw.githubusercontent` returns zero hits;
only `install_nomad.sh` ~:475-542 re-downloads and overwrites
`/opt/nomad/compose.yml`), so a deployed host that updates via
`update_nomad.sh` keeps `DOZZLE_ENABLE_SHELL=true` indefinitely. The second
live site is every deployed `/opt/nomad/compose.yml`. Fixed in this pass by
the new migration expression in `migrate_legacy_compose_file()` (see
"P1 fix" section below); R2's "nothing to fix" conclusion is withdrawn.

R3 — Does a legitimate input now get rejected? The change alters one boolean
env var; no validation, routing, or parsing logic changed. Verified preserved
in the rendered config and parsed YAML: `DOZZLE_ENABLE_ACTIONS=true`
(restart/stop control), `9999:8080` publish, socket mount, image pin
`amir20/dozzle:v10.0`, all five services. Resolution: no legitimate surface
removed; nothing to fix.

R4 — Is the literal value `false` accepted where it lands? The line uses
compose list form `- DOZZLE_ENABLE_SHELL=false`; observed rendered output is
the string `"false"`. Compose parse passes (`config --quiet` exit 0) and YAML
parses to the expected two-entry env list. Whether Go's bool parser maps that
string to false is Stage 03's cited source reading, not re-observed here (no
runtime run per `install/` host-safety rule). Resolution: accept with residual
risk noted.

R5 — Constraint check: `9999:8080` publish unchanged (line 51), so RFC1918
reachability is intact and no auth/session/CSRF infrastructure was added. No
dependency manifest touched (`package.json`/`package-lock.json` absent from
the diff). No version field touched (no `version` line in the diff). Diff is
one line; `git diff main --check` reports whitespace clean. Resolution: all
constraints hold; nothing to fix.

## Changes made in this pass

### P1 fix — close `DOZZLE_ENABLE_SHELL` on already-installed hosts

`install/update_nomad.sh` never re-downloads the compose template (grep for
`curl`, `MANAGEMENT_COMPOSE`, `raw.githubusercontent` returns zero hits; only
`install_nomad.sh` ~:475-542 re-downloads and overwrites
`/opt/nomad/compose.yml`), so the committed template flip to `false` only
helps fresh installs. Added one migration expression to
`migrate_legacy_compose_file()` (`install/update_nomad.sh`), which already
runs on every update via `force_recreate()` (`:197`, call at `:198`) and via legacy runtime
migration (`:156`):

```diff
     -e '<elided legacy-path rewrite; see install/update_nomad.sh:113-117>' \
+    -e 's|^\([[:space:]]*-[[:space:]]*DOZZLE_ENABLE_SHELL\)[[:space:]]*=[[:space:]]*true$|\1=false|' \
+    -e 's|^\([[:space:]]*-[[:space:]]*DOZZLE_ENABLE_SHELL\)[[:space:]]*=[[:space:]]*true\([[:space:]].*\)$|\1=false\2|' \
     "$compose_file"
```

(The earlier revision of this evidence showed a loose single-line
expression here (`s|DOZZLE_ENABLE_SHELL...=...true|...=false|g`); that
block was SUPERSEDED — it was never the applied code. The two anchored
lines above are the actual applied migration, verbatim modulo the
elided legacy-path context line. The loose form was proven inadequate
by Case 6/11: it rewrites `MY_DOZZLE_ENABLE_SHELL`, `=truey`,
`=true_extra`, and commented lines, all of which the anchored pair
leaves untouched.)

Style match: bare `sed -i` `-e` expression appended after the existing ones,
same quoting, no new dependency, no version field touched. Properties:
- Idempotent: the pattern only matches the literal value `true`, so a second
  run (or a file already at `false`) is a no-op — proven by the test below.
- Scoped: matches only the `DOZZLE_ENABLE_SHELL=...true` token, so
  `DOZZLE_ENABLE_ACTIONS`, ports, credentials, and unrelated services are
  untouched (asserted by diff in the test).
- Tolerant: `[[:space:]]*` around `=` handles spacing variants; both
  expressions are anchored at line start as
  `^[space]*-[space]*DOZZLE_ENABLE_SHELL[space]*=[space]*true`
  (end-of-line OR whitespace-plus-remainder), so indentation is allowed
  but the `- ` list-item marker is required, and trailing comments are
  preserved via the second expression's remainder capture.
- Deliberate override: a host operator who intentionally set `true` will have
  it reset to `false` on the next update. That is the audit's intended
  security default (shell access is unauthenticated on the LAN), so the
  migration closes it anyway; re-enabling afterwards remains possible but is
  out of scope and at the operator's own risk.

### Migration test (new file `install/tests/test_dozzle_shell_migration.sh`)

Self-contained bash test, temp files only (never `/opt` or any real compose
file). It sources only the function definitions from `update_nomad.sh`
(everything from the `# Pre-flight checks` marker down is stripped before
sourcing, so the script's main flow cannot execute; host-touching commands
are additionally stubbed), then asserts 7 cases. Real output from this pass:

```
PASS: legacy true flipped to false
PASS: no unrelated line changed
PASS: actions, credentials, ports preserved
PASS: idempotent on second run (no dup, no flip-back)
PASS: already-false file untouched
PASS: file without key untouched
PASS: whitespace variant flipped
---
passed=7 failed=0
```

Exact commands: `chmod +x install/tests/test_dozzle_shell_migration.sh`,
`bash install/tests/test_dozzle_shell_migration.sh` (exit 0);
`bash -n install/update_nomad.sh` and
`bash -n install/tests/test_dozzle_shell_migration.sh` both pass;
`git diff --check` clean.

### What was NOT run

No isolated-Debian install/update run was performed in this pass — this
sandbox is not an isolated Debian host and `install/` must not be executed
on a dev machine, so the full updater flow (pull, recreate) was never
invoked. Docker exists here but was deliberately not used. The migration
evidence is therefore the diff reading plus the temp-file test above, per
`verification.md`. A run in an isolated Debian environment remains the
residual risk for the updater path.

Tracked-source changes before this pass: none (the template fix needed no
correction beyond the P1 migration above).

## Residual risk (stated plainly, reconciled)

- Runtime observation status, single coherent statement: the Dozzle UI with
  `DOZZLE_ENABLE_SHELL=false` was not observed by this worker. The
  orchestrator's bounded loopback run (section B below) supplies real
  post-fix runtime evidence that the exec route is unregistered
  server-side — but it is NOT a full isolated-Debian install run: it
  reproduced only the dozzle service environment from
  `install/management_compose.yaml` in two disposable loopback containers
  (candidate `false` → `config__json` `"enableShell":false`, exec probe
  HTTP 404; control `true` → `"enableShell":true`, probe HTTP 101) and
  removed both afterwards. It establishes the env-var → route behavior, not
  that a full install/update on a Debian host converges, and not that the
  updater's `sed` migration applies cleanly on a real deployed
  `/opt/nomad/compose.yml`. The earlier "no post-fix runtime observation
  exists" line is therefore corrected to: orchestrator-observed loopback
  evidence exists and is correctly attributed; full isolated-Debian install
  evidence does not.
- Deployed-host coverage: this pass's migration closes `true` on update, but
  until every deployed host actually runs the updated `update_nomad.sh`,
  hosts that never update keep `true`. (The prior "installer does not
  migrate" bullet is closed by the migration above, conditional on hosts
  updating.)
- A host operator who deliberately set `DOZZLE_ENABLE_SHELL=true` will have
  it reset to `false` on next update (see P1 fix note above).
- The socket mount and all-interfaces `9999` publish are unchanged by design:
  LAN clients can still read logs and start/stop/restart containers without
  authentication. Direct public-internet exposure remains unsafe.
- Full gate is not green: `lint` fails on 1337 pre-existing `admin/` errors
  identical on `main` (histogram corrected above — bulk formatting, tail
  correctness-adjacent, all pre-existing and out of scope); `npm test` needs
  the repo's `.env.example` values exported (bare checkout exits 1 on env
  validation before running any test).
- Record note (reviewer's flag, not repaired here): stage 05's `output/`
  holds only `.gitkeep` and `admin/docs/release-notes.md` has no entry for
  this change, while HEAD already carries the conventional commit. Landing
  and changelog remain stage 05's business.

## Addendum — this pass: `npm --prefix admin test` re-run + runtime observation

### A. Gate re-run: `npm --prefix admin test` (executed by this worker, this pass)

Setup (from repo root; no file created or modified):
- Node was provisioned via the repo's own `.mise.toml` (node 24.21.0,
  npm 11.19.0). `$HOME` is read-only here, so mise itself needed
  `MISE_STATE_DIR=/tmp/mise-state MISE_DATA_DIR=/tmp/mise-data
  MISE_CACHE_DIR=/tmp/mise-cache MISE_CONFIG_DIR=/tmp/mise-config`
  (tool-state locations only, no project file touched).
- Environment only: `set -a; . ./admin/.env.example; set +a` (values read
  from that repo file, none invented), plus `NODE_ENV=test`,
  `NPM_CONFIG_CACHE=/tmp/npm-cache` (cache location only),
  `NPM_CONFIG_UPDATE_NOTIFIER=false`. No `.env` file was written
  (`admin/.env` verified absent afterwards).
- Exact gate command line: `npm --prefix admin test`
- Exit status: 0 (observed on two consecutive runs this pass; full output
  of the second run saved outside the repo, 116 lines).
- Verbatim final lines:
  ```
   PASSED

  Tests  26 passed (26)
   Time  305ms
  ```
- Real counts: passed 26 (`grep -c ✔` = 26 across the 7 spec files under
  `admin/tests/unit/`), failed 0, skipped 0, todo 0. The runner prints no
  failure/skip lines. The single `ERROR ... getaddrinfo ENOTFOUND
  api.github.com` line is expected log output from the CheckUpdateJob
  failure-path test, not a test failure. (A vite `dep-scan` "server is
  being restarted or closed" stack is also printed between the last spec
  and the `PASSED` summary; the verdict is unaffected — exit 0.)
- Socket note: no bind error occurred. `admin/tests/functional/` is absent,
  so only the `unit` suite ran and no HTTP server started; the
  `0.0.0.0:3333` sandbox restriction was not exercised either way.

### B. Runtime observation (performed by the orchestrator (Cal), not by this worker)

This worker did NOT run the following and makes no first-hand claim about
it; all figures below are the orchestrator's observed facts:
- Image `amir20/dozzle:v10.0`, digest
  `sha256:d383abf0fee72a8037d6ec6474424e56d752a52208e0ed70f4805e9d86a77830`,
  running version reported v10.0.7.
- Two disposable loopback containers were run, identical except the single
  variable under test. `install/` was NOT executed; only the dozzle service
  environment from `install/management_compose.yaml` was reproduced. Both
  containers were removed after capture.
- CANDIDATE (`DOZZLE_ENABLE_SHELL=false`, the repository's configuration):
  served `config__json` contained `"enableShell":false`, and a
  websocket-upgrade request to
  `GET /api/hosts/local/containers/<id>/exec` returned HTTP 404.
- NEGATIVE CONTROL (`DOZZLE_ENABLE_SHELL=true`, otherwise identical):
  served `config__json` contained `"enableShell":true`, and the same
  request returned HTTP 101 (websocket upgrade completed).
- Conclusion supported by that pair: under the repository's configuration
  the exec route is not merely hidden in the UI, it is unregistered
  server-side; the control proves the probe is valid and the route exists
  when the flag is enabled.
- `verification.md` requires `install/` behavior changes to be evidenced by
  a run in an isolated environment; this observation does NOT satisfy that
  requirement for the updater path — it supplies post-fix runtime evidence
  for the env-var → exec-route behavior only. A full isolated-Debian
  install/update run remains unperformed (see "What was NOT run" above).

### C. Still NOT proven / unresolved (retained, re-observed this pass)

- `npm --prefix admin run lint` still fails: exit 1,
  `✖ 1339 problems (1337 errors, 2 warnings)`,
  `1291 errors and 0 warnings potentially fixable with the '--fix' option`
  (re-observed this pass). Main parity confirmed this pass:
  `git diff main --name-only -- admin/` is empty (the branch touches no
  `admin/` file), so these pre-existing style errors exist identically on
  `main`; left untouched as out of scope.
- Gate verdict unchanged: NOT green while lint fails. This stage is not
  described as complete and nothing here is approved.

## Addendum 2026-09-11 — in-app update path (P1-A), sed anchoring (P3),
test hardening (P3), evidence corrections, delivery analysis (P1-B)

Branch still `cal/dozzle-shell-remediation-20260908`; no commit, push,
merge, install, or publish performed in this pass. Candidate's paths
preserved and extended, none reverted: the tracked modifications to
`install/update_nomad.sh` (migration expression, now anchored),
`.branding-allowlist.json` (allowlist entry for the shell test's
legacy-dir fixture literal), the
staged `install/tests/test_dozzle_shell_migration.sh` (extended), and
this evidence file. No tracked file permission changed
(`git diff --summary` shows content changes only). /opt untouched: every
check below ran against temp files; no install/ script was executed
against a real path.

### P1-A fix — the watcher now migrates before dozzle is recreated

Finding (verified, not trusted from summary): the admin UI reaches only
the sidecar path — `admin/app/services/system_update_service.ts:16,42`
writes an update-request file the sidecar consumes, and no code under
`admin/` (outside docs) invokes `update_nomad.sh` (only
`admin/docs/faq.md:254` mentions it as a manual command). The watcher at
`install/sidecar-updater/update-watcher.sh:102` lists
`SERVICES_TO_UPDATE="admin mysql redis dozzle"` and recreates each via
`docker compose ... up -d --no-deps "$service"` at `:121` against the
DEPLOYED `/opt/nomad/compose.yml` (`COMPOSE_FILE` at `:9`), which the old
watcher never rewrote. So an in-app update recreated dozzle from the
stale deployed file and came back with the shell enabled.

Fix: new `migrate_dozzle_shell_setting()` in
`install/sidecar-updater/update-watcher.sh:38-52`, called from
`perform_update()` at `:70` — after "starting", BEFORE the image-tag sed
(`:74`), the `pull` (`:86`), and the per-service recreate loop
(`:107-121`). Effect identical to the CLI migration: the same two
anchored sed expressions, same scope (exact list-item shape only).
Watcher-container constraints honored: only POSIX shell + sed + the
watcher's own `log()` are used (no new binary; the sidecar image per
`install/sidecar-updater/Dockerfile:4` ships `docker-cli`,
`docker-cli-compose`, `bash`, `jq` — this fix needs only sed, already
used by the watcher at `:74`). Idempotent (pattern matches only `=true`;
second run is a byte-identical no-op, asserted with the migrated state
positively checked). Safe when the key is
absent or already false (no-op, asserted). Never aborts the update: the
unreadable-file branch logs a WARNING and returns 0 (`:39-42`), while a
sed failure logs a different WARNING and returns 0 (`:43-51`). These are
two distinct branches and are asserted by two distinct observations:
the nonexistent-file case expects exit 0 AND the unreadable WARNING
line (so removing the `-r` guard fails the suite), and the sed-failure
branch is covered only by code reading, not by an executed case —
the earlier claim that "both" branches were "asserted by a case that
points the function at a nonexistent file" was wrong (one case cannot
assert two branches) and is corrected here.

Real proof (temp files, never /opt): the repo gate `npm test` below runs
both the node suite and the shell migration test; the shell test's
watcher cases write a fixture compose with the key true, run the real
sourced function, and diff the result against an explicit expected post-image (exact
post-image match, so a no-op migration fails). Full numbers in
"Gates" below: node 15/15 (incl. 2 new tests), shell 18/18.

### P1-B analysis — delivery to already-installed hosts: ESCALATED, not implemented

Verified facts with exact file:line proof:

1. `/opt/nomad/update_nomad.sh` is written exactly once, by
   `download_helper_scripts()` in `install/install_nomad.sh:612-637`
   (the `curl -fsSL "$UPDATE_SCRIPT_URL" -o .../update_nomad.sh` at
   `:630` runs only from the install main flow at `:740`; the update
   script has no self-refresh path).
2. `install/update_nomad.sh` contains zero curl/wget (grep exit 1, no
   hits) and never refreshes itself or any helper; the watcher
   `install/sidecar-updater/update-watcher.sh` likewise contains zero
   curl/wget (grep exit 1). Neither the CLI path nor the in-app path
   pulls new script code.
3. The watcher EXCLUDES the updater service from
   `SERVICES_TO_UPDATE` (`:102` lists only `admin mysql redis dozzle`;
   `:97` comment says "excluding updater"), and the updater image is
   `build:`-context (`install/management_compose.yaml:88-91`), rebuilt
   only by the installer (`download_sidecar_files` at
   `install/install_nomad.sh:568-592`, main flow `:739`) or by the
   one-shot `install/run_updater_fixes.sh:170-195`. An in-app update
   therefore NEVER refreshes the running watcher itself.
4. Consequence: BOTH fixes in this branch — the CLI-path migration in
   `update_nomad.sh` AND the new watcher migration — do NOT reach
   already-installed hosts through either update path. A host that
   updates via CLI keeps its old `/opt/nomad/update_nomad.sh`; a host
   that updates in-app keeps its old running watcher. Both stay
   vulnerable while "updating" on every release. The stale framing that
   the only residual is "hosts that never update" is therefore wrong,
   and the R2-era reasoning that closing the CLI path suffices is
   withdrawn: the residual is hosts that DO update, via either path,
   and stay vulnerable.
5. `install/run_updater_fixes.sh` is the repo's existing precedent for
   exactly this class of out-of-band delivery: its header (`:3-27`)
   states it "deploys two fixes to the sidecar updater that cannot be
   applied through the normal in-app update mechanism" by curling the
   current Dockerfile + watcher from main, rebuilding, and restarting
   the sidecar (`:153-195`). A third fix of the same shape (fetch the
   fixed watcher, rebuild/restart updater, flip the deployed compose
   key) would fit the precedent technically.

Conclusion: ESCALATED, not implemented. Shipping another one-shot
script (or extending `run_updater_fixes.sh`) is a release/publishing
decision — it tells operators to curl-pipe a privileged script from
main outside any signed release, and this branch already carries an
unlanded security fix with no release-notes entry (see record note in
Residual risk). Per the work order ("if it requires a
release/publishing decision, STOP and record it as an escalated
question"), no delivery script was added. Safest resume point: a
maintainer decides the delivery vehicle (one-shot script vs. next
release notes + operator advisory vs. image-based watcher refresh),
then a follow-up implements it and re-proves with the temp-file gates
below.

### P3 fixes (all four)

1. Anchored (done): the candidate's unanchored
   `s|DOZZLE_ENABLE_SHELL...=...true|...=false|g` matched substrings
   (`MY_DOZZLE_ENABLE_SHELL`), suffixes (`=truey`, `=true_extra`), and
   commented lines. Replaced in `install/update_nomad.sh:118-119` by two
   anchored expressions requiring the exact list-item shape
   `^[space]*-[space]*DOZZLE_ENABLE_SHELL[space]*=[space]*true`
   followed by end-of-line OR by whitespace (trailing comment):
   the variable is captured and re-emitted, only `true`→`false`
   changes, indentation and comments preserved. The watcher's function
   uses the identical pair (`update-watcher.sh:43-46`) so the paths
   cannot drift. Proven by Case 6/7/11 (prefix, truey, true_extra,
   commented, all untouched) in the executed run below.
2. Out-of-scope shapes (documented, not handled): YAML map form
   (`DOZZLE_ENABLE_SHELL: true`), quoted (`="true"`, `='true'`),
   `TRUE`, `=1`, and an attached trailing comment with no separating
   whitespace (`- DOZZLE_ENABLE_SHELL=true#comment`) are intentionally
   NOT rewritten — the migration targets only the shape this repo ever
   provisioned. Two further real limits of the line-scoped sed, verified
   by direct execution (not just reading): it is not service-scoped (a
   second service carrying the same key is also flipped — two
   `=true` lines in, two `=false` lines out), and it is block-scalar
   blind (a matching `- DOZZLE_ENABLE_SHELL=true` line inside a
   `command: |` block is rewritten even though it is script text, not
   environment). Neither arises from the repo's own template, which
   carries the key once under the dozzle service, but they are limits
   all the same. The attached-comment shape needs naming explicitly
   because the second sed expression requires `[[:space:]]` after
   `true`, so `=true#comment` does not match and is left alone by
   design, not by accident. Proof of scope:
   the repo's only compose template has carried exactly
   `- DOZZLE_ENABLE_SHELL=true/false` since dozzle was introduced
   (`git log -S DOZZLE_ENABLE_SHELL -- install/management_compose.yaml` hits only commit b677fbb, whose
   blob shows `- DOZZLE_ENABLE_SHELL=true  # Enables web-based shell
   access`); grep for `DOZZLE_ENABLE_SHELL` across install/ hits
   `management_compose.yaml:56`, the new migration lines in
   `update_nomad.sh:118-119` and `update-watcher.sh:44-45` (plus the
   watcher's comments and log messages), and the new test file. The
   shell test asserts map/quoted/TRUE/=1 lines pass through unchanged
   (Case 6/11), so no tolerance is overclaimed.
3. Test self-containment (done): `install/tests/test_dozzle_shell_migration.sh`
   now exports `NOMAD_DIR`/`LEGACY_NOMAD_DIR` into a `mktemp -d`
   sandbox BEFORE sourcing (the legacy-dir value is the plain literal
   the shell test's legacy-dir value at `:54`, declared in `.branding-allowlist.json`
   under this file's path so the repo's own branding check, which scans
   every tracked file, stays green), defines pass-through wrappers for
   mv/ln/rm/readlink (:63-66) and jq/date/tee (:69, :71-72) — each runs
   the real binary via `command <name> "$@"` — neutralizes only
   sudo/systemctl/docker (`return 0`), curl/wget (`return 1`), and
   sleep (`return 0`), provides a fixed-output hostname stub, and
   defines NO sed stub (`grep '^sed()'` returns nothing); actual
   watcher containment comes from invoking
   `migrate_dozzle_shell_setting` only with COMPOSE_FILE/LOG_FILE
   pointed at temp paths (test header :21-30), and asserts the
   stripped sourced stream contains no top-level invocation (awk scan
   over both sourced streams; bare `trap` allowed only in the watcher
   stream). Legacy-branding dodge verified: `node
   scripts/check-branding.mjs` passes with the test tracked.
4. Runner wiring (done): root `package.json` `test` script is now
   `node --test tests/*.test.mjs && bash
   install/tests/test_dozzle_shell_migration.sh`, so `npm test` — the
   repo's documented verify command — executes both suites (no workflow
   runs `npm test` or `check:branding`: `.github/workflows/` holds only
   `docker.yml` and `release.yml`, neither invoking them). The two
   new node cases in `tests/repository_rename.test.mjs` additionally
   cover the anchoring and the watcher ordering inside that suite itself.

### Evidence corrections (required — done here)

- "Only residual is hosts that never update": WRONG. Corrected —
  P1-A and P1-B are both hosts that DO update and stay vulnerable
  (P1-A: in-app path never rewrote the deployed compose; P1-B: fixed
  scripts never ship to installed hosts). See P1-B §4.
- "ENABLE_SHELL/ENABLE_ACTIONS appear nowhere under install/ outside
  the compose template": STALE. Corrected — current grep hits:
  `install/management_compose.yaml:55-56` (template),
  `install/update_nomad.sh:118-119` (CLI migration),
  `install/sidecar-updater/update-watcher.sh:32,34,40,44-45,47,49,69`
  (watcher doc comment, migration sed pair, and log lines; call at
  `:70`), plus the test. The original search never examined
  `sidecar-updater/`; this pass did (full `install/` grep above).

### Gates (real numbers, all run in this pass, /opt untouched)

- `bash -n install/update_nomad.sh` — clean.
- `bash -n install/sidecar-updater/update-watcher.sh` — clean.
- `bash -n install/tests/test_dozzle_shell_migration.sh` — clean.
- `bash install/tests/test_dozzle_shell_migration.sh` — passed=18
  failed=0 (exit 0). Covers: CLI flip, exact post-image diff (targeted
  line only; the earlier reverse-substitution diff passed on a no-op
  migration and is replaced — corrected, not retained), CLI idempotency
  with migrated state asserted, already-false/missing-key no-op guards
  (4 labeled `smoke:`, not migration proof), whitespace
  variant, anchor near-misses (prefix/truey/true_extra/commented/
  map/quoted/TRUE/=1 — the two near-miss checks are guards too: they
  pass under a gutted migration by definition), trailing-comment
  exactness (this one asserts the flipped value, so it fails under a
  gut), watcher fixture flip
  with exact post-image diff, watcher idempotency with migrated state
  asserted (the earlier self-diff without a positive assertion passed on
  a no-op and is corrected), watcher no-op guards (labeled `smoke:`),
  watcher unreadable-file exit 0 WITH the WARNING line asserted (so the
  `-r` guard's behavior is observed, not just the exit code), watcher
  near-misses, both no-top-level-invocation assertions, and the watcher
  ordering assertion (now extracting the perform_update body first and
  requiring the bare call inside it before that same body's real
  `docker compose` pull/recreate lines — the earlier whole-file
  line-number comparison passed with the call parked in dead code,
  corrected; the two vacuous whole-file assertions in the node twin
  are dropped).
- `npm test` — executed in the authoring environment ONLY, NOT
  re-executable in the review sandbox (node/npm absent there:
  `node --version` / `npm --version` report "command not found", so
  these numbers are carried forward, not re-checkable there) — run as
  node 24.21.0 via repo `.mise.toml` with
  `MISE_STATE_DIR/DATA_DIR/CACHE_DIR/CONFIG_DIR` under /tmp because
  $HOME is read-only; `NPM_CONFIG_CACHE=/tmp/npm-cache`) — FULLY GREEN,
  exit 0: node suite 15/15 (13 pre-existing + 2 new dozzle tests),
  including `tracked tree passes the legacy-branding residue check`;
  then the wired shell suite passed=18 failed=0. The earlier
  branding-check failure (flagging the pre-existing stage evidence diff
  line quoting the legacy install path) is FIXED in this pass by
  eliding that quoted context line (now reads `<elided legacy-path
  rewrite; see install/update_nomad.sh:113-117>`); the new addendum
  text itself is branding-clean, verified by the passing check. The
  new test file carries the plain literal at :54, declared in
  `.branding-allowlist.json` under its own path (no split-fragment
  technique is used anywhere in the candidate; neither test file has
  ever used one — zero occurrences at HEAD and now).
- Full isolated-Debian install/update run: NOT performed (this sandbox
  is not an isolated Debian host; `install/` must not execute here).
  Docker was not used. Migration evidence is the diff reading plus the
  temp-file gates above.

### Residual risk (true state after this pass)

- Hosts that update via EITHER path stay vulnerable until a delivery
  vehicle ships the fixed scripts (P1-B, escalated above). This is the
  primary residual, not hosts that never update.
- Hosts that never update keep `true` (unchanged, still true).
- Operator who deliberately set `=true` gets reset to `false` on next
  update once delivered (intended security default).
- Socket mount + all-interfaces `9999` publish unchanged by design;
  direct public-internet exposure remains unsafe.
- `npm test` node suite: 15/15 incl. 2 new, branding check green,
  shell suite 18/18. `npm --prefix admin` gates not re-run in this pass
  (out of scope; prior stage numbers retained above).

## Addendum 2026-09-11 — observed Stage 04 results on this candidate (Cal host execution, Node v26.7.0)

Branch confirmed in this pass via `git rev-parse --abbrev-ref HEAD`:
`cal/dozzle-shell-remediation-20260908`. HEAD confirmed via
`git rev-parse HEAD`: `b3a5cd6048396ab4ed112abfe3aab4db6fdd05d8`. No
stage, commit, push, merge, install, or publish performed in this pass;
only this evidence file modified.

Toolchain note: node is not available in this sandbox, so this worker
did not re-execute the suites. Every number below is attributed to
Cal's execution on the host, dated 2026-09-11, against this exact
candidate with Node v26.7.0. These observed numbers replace any
carried-forward numbers for the same checks. No additional numbers are
invented here.

### Observed result 1 — branding check

- Exact command: `node scripts/check-branding.mjs` — exit 0, output
  `No unapproved legacy branding found.`

### Observed result 2 — root suites

- Exact command: `npm test` — exit 0. This runs two suites chained by
  `package.json`:
  - `node --test tests/*.test.mjs`: `tests 15`, `suites 0`, `pass 15`,
    `fail 0`, `cancelled 0`, `skipped 0`, `todo 0`,
    `duration_ms 2019.334484`. Named cases include
    `tracked tree passes the legacy-branding residue check`,
    `legacy-branding residue check rejects a newly introduced spelling`,
    `legacy-branding residue check rejects an obsolete spelling beside an
    allowed URL`, `legacy-branding residue check rejects suffix extensions of
    external exceptions`, `update migration closes the dozzle shell flag and
    ignores near-miss shapes`, and
    `update watcher migrates the dozzle shell flag before recreating services`.
  - `bash install/tests/test_dozzle_shell_migration.sh`: final line
    `passed=18 failed=0`, exit 0.
  - Note explicitly: `npm test` ran from the ordinary checkout and did NOT
    require exporting `.env.example` values.

### Observed result 3 — admin lint (still failing, pre-existing)

- Exact command: `npm --prefix admin run lint` — still fails: 1337 errors,
  2 warnings.
- `git diff main --name-only -- admin/` returns EMPTY (zero lines), so this
  branch modifies no `admin/` file and these errors exist identically on
  `main`. `git status --porcelain -uall -- admin/` is also empty, so there
  is no dirty `admin/` state either.

### Superseding notes (corrections, old text retained above)

- SUPERSEDED: "the untracked `install/tests/test_dozzle_shell_migration.sh`"
  (Addendum 2026-09-11 header, "the tracked modification ... the untracked
  ... (extended)"). The test file is STAGED (`A ` in `git status`, confirmed
  this pass via `git status --short` and `git diff --cached --stat`), not
  untracked. The claim that it is untracked is withdrawn; the old sentence
  is retained above for audit. Nothing was staged or committed to correct
  this — staging state is Cal’s landing decision, not this pass’s.
- SUPERSEDED: "the legacy-dir fragment is split as `project-""nomad` so the
  repo’s own branding check ... stays green" (P3 item 3) and "The new
  test file dodges the check via the split `project-""nomad` fragment, same
  technique as `tests/repository_rename.test.mjs`" (Gates `npm test` note).
  Both are false. The candidate uses the plain literal
  `export LEGACY_NOMAD_DIR="$SANDBOX/"` + the legacy project name at
  `install/tests/test_dozzle_shell_migration.sh:54`, and the branding gate
  is satisfied by the `.branding-allowlist.json` entry for that path
  (text: the hyphenated legacy project name, reason "The migration fixture creates a directory
  with the exact legacy project name to exercise the migration path.").
  Verified this pass: the check’s `project[-_]nomad` pattern matches the
  plain literal (so the allowlist entry is load-bearing), matches nothing
  in the split form (so a split fragment would need no entry), and
  `grep -rn 'project-""nomad' tests/ install/tests/` exits 1 — the
  split form occurs nowhere in either test file.
- SUPERSEDED: "same technique as `tests/repository_rename.test.mjs`" (same
  Gates note). `tests/repository_rename.test.mjs` has never used any
  split-fragment technique — it carries plain hyphenated-legacy-name literals
  throughout (e.g. `:33,42-44,91,106-107,129,145-146,155-156,275,306`,
  covered by four `.branding-allowlist.json` entries for its path) and
  zero occurrences of the split form at HEAD and now.
- SUPERSEDED (omission): `.branding-allowlist.json` appeared nowhere in
  this document (`grep -n allowlist` exited 1 before this correction),
  despite being a modified tracked file the branding gate depends on. The
  record now names it in the header (changed-file list) and here: one
  entry added for `install/tests/test_dozzle_shell_migration.sh`
  (text: the hyphenated legacy project name); without it `node scripts/check-branding.mjs`
  fails on the staged test file’s `:54` literal.
- SUPERSEDED: "Scoped: matches only the `DOZZLE_ENABLE_SHELL=...true`
  token" (P1-fix properties list). Incomplete without its two real
  limits: the sed is line-scoped, not service-scoped (a second service
  carrying the key is also flipped — verified by direct execution: two
  `=true` lines in, two `=false` lines out) and block-scalar blind (a
  matching `- DOZZLE_ENABLE_SHELL=true` line inside a `command: |` block
  is rewritten — verified by direct execution). Neither arises from the
  repo’s own template (key carried once, under dozzle), but both are
  limits of the expression as written. See corrected P3 item 2.
- SUPERSEDED: "the CI-executed suite itself" / "inside the CI-executed
  suite itself" (P3 item 4; Gates `npm test` note carried the same
  implication via "CI-executed"). No workflow runs `npm test` or
  `check:branding` (`.github/workflows/` holds only `docker.yml` and
  `release.yml`, neither invoking them — verified this pass). The
  operative phrase is "the repo’s documented verify command". The old
  wording is retained above for audit.
- SUPERSEDED: "Checks labeled `smoke:` are no-op-guard checks ..." (shell
  test header) "Every other behavior check carries a positive assertion
  and fails when the migration is gutted." The two `anchor:`-labeled
  near-miss checks (`:343` CLI, `:448` watcher) also pass under a gutted
  migration — a migration that does nothing trivially leaves near-miss
  shapes untouched. It is 6 guards, not 4 (4 `smoke:` + 2 near-miss
  `anchor:`; the `anchor: trailing comment` check asserts the flipped
  value and does fail under a gut). Corrected in the shell test header
  itself; old header sentence retained in that file’s history via git.
- SUPERSEDED: "`npm test` needs the repo’s `.env.example` values exported
  (bare checkout exits 1 on env validation before running any test)."
  This claim, from the Residual risk section, is superseded for the root
  `npm test` suite by Observed result 2 above: on 2026-09-11 Cal ran
  `npm test` from the ordinary checkout with exit 0 and it did NOT require
  exporting `.env.example` values. The old sentence is retained above for
  audit and is no longer operative for this suite.
- SUPERSEDED: "these numbers are carried forward, not re-checkable there"
  (full context: "`npm test` — executed in the authoring environment ONLY,
  NOT re-executable in the review sandbox (node/npm absent there:
  `node --version` / `npm --version` report "command not found", so these
  numbers are carried forward, not re-checkable there)"). This
  carried-forward characterization is superseded by Observed result 2
  above: the `npm test` numbers recorded here (node `tests 15`, `pass 15`,
  `fail 0`, `duration_ms 2019.334484`; shell `passed=18 failed=0`, exit 0)
  were observed on this candidate on 2026-09-11 with Node v26.7.0 and
  replace the carried-forward numbers for the same checks. The old text is
  retained above for audit.

### Residual P1-B delivery-path risk (unchanged, NOT resolved by this pass)

Neither update path delivers fixed scripts to hosts that never run an
update. That is NOT resolved by this pass. Unchanged from the P1-B
analysis above: both fixes in this branch — the CLI-path migration in
`install/update_nomad.sh` and the watcher migration in
`install/sidecar-updater/update-watcher.sh` — do NOT reach
already-installed hosts through either update path. A host that updates
via CLI keeps its old `/opt/nomad/update_nomad.sh`; a host that updates
in-app keeps its old running watcher. Hosts that update via either path
stay vulnerable until a delivery vehicle ships the fixed scripts, and
hosts that never update keep `true`. No delivery repair was attempted
here.

### Gate verdict for this pass (recorded, not decided)

Every gate step except `admin/` lint is observed passing on this
candidate per Observed results 1–2 above. `admin/` lint fails on 1337
errors that are main-identical and untouched by this branch per Observed
result 3 above. Whether that pre-existing failure is waivable is a
decision for the reviewer and Cal, NOT something decided in this
addendum.
