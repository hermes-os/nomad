# Codebase map

Addresses of the surfaces the audit report names. Paths are repo-root-relative.

## Audited surfaces

| Path | Surface |
|------|---------|
| `admin/app/services/zim_service.ts` | ZIM storage, listing, delete by filename |
| `admin/app/services/map_service.ts` | pmtiles storage and delete by filename |
| `admin/app/services/docs_service.ts` | Markdoc documentation read by slug |
| `admin/app/services/collection_update_service.ts` | Content update apply, download destination |
| `admin/app/services/container_registry_service.ts` | Registry tag listing and pagination |
| `admin/app/services/benchmark_service.ts` | Benchmark run and leaderboard HMAC |
| `admin/app/validators/common.ts` | Remote download URL validators, `assertNotPrivateUrl` |
| `admin/app/controllers/settings_controller.ts` | Settings read and write endpoints |
| `admin/app/utils/fs.ts` | Path containment, directory and file helpers |
| `admin/config/shield.ts` | CSRF configuration |
| `admin/config/cors.ts` | CORS origin and credentials |
| `admin/config/bodyparser.ts` | Upload size limits |
| `install/management_compose.yaml` | Production compose env, including Dozzle and log level |

## Tests

- Specs live in `admin/tests/unit/*.spec.ts`; bootstrap is `admin/tests/bootstrap.ts`.
- Suites are declared in `admin/adonisrc.ts`: `unit` (`tests/unit/**/*.spec.ts`,
  2000 ms timeout) and `functional` (`tests/functional/**/*.spec.ts`, 30000 ms).
  No functional specs exist yet.
- Existing specs: `collection_update_service.spec.ts`, `common_validator.spec.ts`,
  `container_registry_service.spec.ts`, `env_example.spec.ts`, `fs.spec.ts`.
- Naming: one spec per module, named after the module under test.
- `admin/config/transmit.ts` disables the Redis transport in test mode, so the
  suite runs without a Redis server.

## Documents

- `admin/docs/security-audit-v1.md` — the backlog and its severity ordering.
- `admin/docs/release-notes.md` — user-facing changelog, rendered in the UI.
