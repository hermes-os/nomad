READ ~/.agents/AGENTS.md BEFORE ANYTHING (skip if missing).

# Nomad Repository Guide

## Repository
- Mirror of the upstream Nomad project (Crosstalk Solutions); remotes are `origin`
  (Forgejo) and `upstream`. Keep upstream's architecture and conventional commits.
- `admin/`: AdonisJS 6, Inertia, React, TypeScript management app.
- `install/`: Debian installer, updater, sidecar updater, Docker compose.
- `collections/`: curated offline-content manifests.
- `.agents/icm/security-audit-remediation/`: one-finding-per-pass pipeline for
  `admin/docs/security-audit-v1.md`.

## Invariants
- Trusted-LAN appliance, no application authentication. Never call it safe for
  direct internet exposure, in code, comments or release notes.
- RFC1918 download hosts stay reachable. Only loopback, unspecified and
  link-local are blocked (`assertNotPrivateUrl`).
- `install/` runs as root and manages host services. Never execute it on a
  worker or dev host. Test it only in an isolated Debian environment.
  `install/tests/test_dozzle_shell_migration.sh` is the exception: temp files only.
- `DOZZLE_ENABLE_SHELL` stays `false`; the updater and `update_nomad.sh`
  rewrite deployed compose files to match.
- Keep credentials, downloaded content, databases, volumes and model files out of Git.
- Root `package.json` version belongs to semantic-release. `admin/package.json`
  stays `0.0.0`. Never add a release heading to any changelog.
- Legacy product-name spellings fail `npm run check:branding`. Exceptions go in
  `.branding-allowlist.json`.

## Gate
Node 24 comes from `.mise.toml`. Run from the repo root:
```bash
npm test                      # branding + install-script tests (root)
npm --prefix admin ci         # first run only
npm --prefix admin test       # needs admin/.env or admin/.env.example exported
npm --prefix admin run lint   # fails on main today (issues.md); do not add errors
npm --prefix admin run typecheck
npm --prefix admin run build
agent-repo-check --repo "$PWD"
```

## Release notes
A user-visible change gets an `## Unreleased` entry in both
`admin/docs/release-notes.md` (upstream convention, rendered in the UI, format
`- **Area**: Description`) and the repo-root `CHANGELOG.md`, in the same commit.
CI stamps release notes on release; Foreman stamps `CHANGELOG.md`.

## Delivery
Work on `main`. Workers commit. Open an issue before upstream-facing changes.
Only Foreman pushes, releases and deploys (`semantic-release` on `main`,
`workflow_dispatch` workflows).
