# Nomad

Hermes's copy of the upstream Nomad project (Crosstalk Solutions). Remotes: `origin` (Forgejo) and `upstream`. Keep upstream's architecture and conventional commits so changes can flow back; an upstream-facing change also gets an `issues.md` entry so Foreman can raise it upstream.

- `admin/`: AdonisJS 6, Inertia, React, TypeScript management app.
- `install/`: Debian installer, updaters, Docker compose. It runs as root and manages host services, so never run it on a dev machine; test it only in an isolated Debian environment. `install/tests/test_dozzle_shell_migration.sh` is safe (temp files only).
- `collections/`: curated offline-content manifests.

## Rules and why
- Nomad is a trusted-LAN appliance with no app login. Never call it safe for direct internet exposure, in code, comments or release notes.
- Download hosts on private networks (RFC1918) must stay reachable. Only loopback, unspecified and link-local addresses are blocked (`assertNotPrivateUrl`).
- `DOZZLE_ENABLE_SHELL` stays `false`; the updaters rewrite deployed compose files to match.
- semantic-release owns the root `package.json` version; `admin/package.json` stays `0.0.0`.
- Old product-name spellings fail `npm run check:branding`. Exceptions go in `.branding-allowlist.json`.

## Gate
Node 24 comes from `.mise.toml`.
```bash
npm test
npm --prefix admin ci            # first run only
npm --prefix admin test          # export admin/.env.example values first; never commit admin/.env
npm --prefix admin run lint
npm --prefix admin run typecheck
npm --prefix admin run build
```

## Release notes
A user-visible change gets an `## Unreleased` entry in both `admin/docs/release-notes.md` (shown in the UI, format `- **Area**: Description`) and the root `CHANGELOG.md`. CI and Foreman add the release headings.
