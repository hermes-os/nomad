# Issues

## Install scripts never refresh themselves, so fixes in them do not reach installed hosts
Where: `install/update_nomad.sh`, `install/sidecar-updater/update-watcher.sh`, `install/install_nomad.sh` (`download_helper_scripts`), `install/management_compose.yaml` (`updater` service).
What happens: `/opt/nomad/update_nomad.sh` is written once, by the installer (`install_nomad.sh:630`), and `update_nomad.sh` contains no `curl` or `wget`. The in-app updater recreates only `admin mysql redis dozzle` (`update-watcher.sh:102`); the `updater` container is built from `./sidecar-updater` and is rebuilt only by the installer or the one-shot `install/run_updater_fixes.sh`. So the Dozzle shell migration in both scripts only runs on hosts that already hold the new scripts. A host on the old scripts that updates by either path keeps `DOZZLE_ENABLE_SHELL=true` in `/opt/nomad/compose.yml`; re-running the installer is the only path that re-downloads the compose file (`install_nomad.sh:504`).
How found: reading `install/` at a20a047; `grep -c 'curl\|wget'` returns 0 for `update_nomad.sh` and `update-watcher.sh`.

## Dozzle shell migration has never run on a real Debian host
Where: `install/update_nomad.sh` (`migrate_legacy_compose_file`), `install/sidecar-updater/update-watcher.sh` (`migrate_dozzle_shell_setting`).
What happens: only temp-file tests exercise the migration (`install/tests/test_dozzle_shell_migration.sh`, `tests/repository_rename.test.mjs`). No isolated Debian update run shows it converging on a deployed `/opt/nomad/compose.yml`, or that the recreated Dozzle comes back without the shell route. Only the Dozzle image itself has been checked at runtime, not the update flow.
How found: `npm test` at a20a047 (21 passed, 0 failed) covers temp files only.

## Dozzle shell migration rewrites by line, not by service
Where: `install/update_nomad.sh:118-119`, `install/sidecar-updater/update-watcher.sh:44-45`.
What happens: the anchored `sed` flips any `- DOZZLE_ENABLE_SHELL=true` list item in the file, whichever service it belongs to, and also one inside a `command: |` block. The shipped template has a single occurrence under `dozzle`, so stock installs are unaffected; a hand-edited compose file with a second matching line would be rewritten. An operator who set `true` on purpose is reset on every update.
How found: direct execution of the expressions against fixture files while verifying e6aa951.

## Dozzle shell change has no release-notes entry
Where: `admin/docs/release-notes.md` (`## Unreleased`), `CHANGELOG.md`.
What happens: b3a5cd6 (shell off in the compose template) and e6aa951 (migration on update) change what users see on port 9999, but neither is listed under Unreleased.
How found: `grep -i dozzle admin/docs/release-notes.md` returns only the v1.x line "Added Dozzle to core containers".

## `npm --prefix admin run lint` fails on main
Where: `admin/`, 94 files.
What happens: exit 1 with 1335 errors and 2 warnings: 1140 `prettier/prettier`, 88 `@adonisjs/prefer-lazy-controller-import`, 36 `@unicorn/prefer-number-properties`, 26 `@unicorn/prefer-node-protocol`, 15 `@unicorn/filename-case`, 11 `@unicorn/no-await-expression-member`, 7 `@typescript-eslint/no-shadow` (`app/utils/fs.ts`, `app/jobs/run_download_job.ts:38`), 6 `@typescript-eslint/naming-convention`, 4 `no-control-regex` (`rag_service.ts:107,109`, `system_service.ts:100`, `benchmark_service.ts:739`), 1 `@unicorn/no-for-loop`, 1 `@tanstack/query/exhaustive-deps` (in generated, git-ignored `admin/public/assets`, present only after a build). The lint step of the gate cannot go green.
How found: `npm --prefix admin run lint` at a20a047, 2026-10-13.

## API responses return raw error messages
Where: `admin/app/controllers/rag_controller.ts:82`, `benchmark_controller.ts:57,186`, `chats_controller.ts:49-109`, `system_controller.ts:142`; `admin/app/services/docker_service.ts:98,370` and `system_update_service.ts:53` build `message` from `error.message`, which `system_controller.ts` sends to the client.
What happens: Docker, filesystem and database error text, including internal paths, reaches API clients. Audit finding 8.
How found: `grep -n 'error.message'` over `admin/app/controllers` and the three services at a20a047.

## No rate limiting on expensive endpoints
Where: `admin/start/routes.ts:127` (`POST /api/rag/upload`), `:141` (`POST /api/system/services/affect`), `:173` (`POST /api/benchmark/run`).
What happens: a client can start benchmarks, upload files or cycle services as fast as it can send requests. Audit finding 9.
How found: no limiter or throttle in `admin/package.json`, `admin/start` or `admin/config` at a20a047.

## Production compose logs at debug level
Where: `install/management_compose.yaml:22` (`LOG_LEVEL=debug`; `admin/.env.example` uses `info`).
What happens: the admin container writes debug output, which can include internal state, to its logs on every deployed host. Audit finding 14.
How found: `grep LOG_LEVEL install/management_compose.yaml admin/.env.example` at a20a047.

## Production dependencies carry critical and high advisories
Where: `admin/package-lock.json`.
What happens: `npm --prefix admin audit --omit=dev` reports 63 vulnerabilities (1 low, 21 moderate, 37 high, 4 critical: `maplibre-gl`, `protobufjs`, `proxy-addr`, `tar`). The audit report listed 2 (finding 12).
How found: `npm --prefix admin audit --omit=dev` at a20a047, 2026-10-13.
