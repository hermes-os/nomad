READ ~/.agents/AGENTS.md BEFORE ANYTHING (skip if missing).

# Nomad Repository Guide

## Repository

- This checkout mirrors the upstream Nomad project from
  Crosstalk Solutions. Preserve its contribution and release conventions.
- `admin/` is the AdonisJS 6, Inertia, React, and TypeScript management app.
- `install/` owns Debian installation, updates, Docker orchestration, and
  privileged host integration.
- `collections/` contains curated offline-content manifests.

## Invariants

- Nomad is designed for a trusted local network and currently has
  no application authentication. Do not represent it as safe for direct public
  internet exposure.
- Installation scripts use root privileges and manage host services. Test
  changes in an isolated Debian environment; never point them at this Mac.
- Keep credentials, downloaded content, databases, container volumes, model
  files, and other runtime state out of Git.
- Preserve upstream-compatible architecture and conventional commits.
- User-facing changes belong in `admin/docs/release-notes.md`.

## Commands

```bash
npm test
npm --prefix admin ci
npm --prefix admin run lint
npm --prefix admin run typecheck
npm --prefix admin test
npm --prefix admin run build
agent-repo-check --repo "$PWD"
```

## Delivery

The default branch is `main`. Follow `CONTRIBUTING.md`, discuss upstream-facing
changes before implementation, and keep repository-only adaptations narrowly
scoped.
