# Constraints

Hard rules for every change made through this pipeline. From `AGENTS.md`,
`CONTRIBUTING.md`, `README.md`, and the audit report's own scope notes.

## Threat model

- Nomad is a LAN appliance with no application authentication. The network
  boundary is the access control. All 60+ API routes are unauthenticated by
  design.
- A fix that requires auth, sessions, or CSRF infrastructure is out of scope
  for this pipeline. The audit records that decision under finding 10.
- RFC1918 addresses (10.x, 172.16-31.x, 192.168.x) must stay reachable — users
  host content mirrors on their own LAN. Only loopback, unspecified, and
  link-local targets are blocked.
- Never describe Nomad as safe for direct internet exposure, in code,
  comments, or release notes.

## Change scope

- One finding per pipeline pass. Touch only the lines that finding requires.
- No drive-by reformatting, renaming, or cleanup. Format only files you edited.
- No new dependency without explicit approval.
- Preserve upstream-compatible architecture: AdonisJS 6 + Inertia + React,
  existing `#services/*`-style subpath imports, existing service boundaries.
- Do not change `admin/package.json` `version` (pinned at `0.0.0`) or the root
  `package.json` `version` (owned by semantic-release).

## Host safety

- `install/` runs as root and manages host services and Docker. Never execute
  anything under `install/` on a development machine. Review those changes by
  reading, and test them only in an isolated Debian environment.

## Repository hygiene

- Secrets come from environment variables. Nothing credential-shaped enters the
  tree, logs, or release notes.
- Keep downloaded content, databases, container volumes, and model files out of
  Git. `.gitignore` already ignores `admin/storage`, `admin/public/assets`,
  `.env`, and `node_modules/`.
