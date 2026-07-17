READ ~/.agents/AGENTS.md BEFORE ANYTHING (skip if missing).

# Project N.O.M.A.D. Repository Guide

## Repository

- This checkout mirrors the upstream Project N.O.M.A.D. project from
  Crosstalk Solutions. Preserve its contribution and release conventions.
- `admin/` is the AdonisJS 6, Inertia, React, and TypeScript management app.
- `install/` owns Debian installation, updates, Docker orchestration, and
  privileged host integration.
- `collections/` contains curated offline-content manifests.

## Invariants

- Project N.O.M.A.D. is designed for a trusted local network and currently has
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

## Cursor Cloud specific instructions

Project N.O.M.A.D. is a single deployable app: the **Command Center** (AdonisJS 6 API + React/Inertia UI) living in `admin/`. Its core job is orchestrating third-party tool containers (Kiwix, Ollama, CyberChef, etc.) via the host **Docker** daemon. Standard dev/build/test commands live in `admin/package.json` scripts and `CONTRIBUTING.md`; don't duplicate them here.

### Services and how to start them
The update script only refreshes npm deps. Docker, MySQL, and Redis are installed/created in the VM snapshot but are **not auto-started**, so a fresh session must start them before running the app:

1. **Docker daemon** (required — the app manages tool containers through `/var/run/docker.sock`). If `docker info` fails, start it: `sudo dockerd > /tmp/dockerd.log 2>&1 &` (use a tmux session). It's configured for `fuse-overlayfs` with the containerd snapshotter disabled (`/etc/docker/daemon.json`) — required because we run Docker 29 inside the VM.
2. **MySQL 8 + Redis 7** run as Docker containers named `nomad_mysql` and `nomad_redis` (ports 3306/6379, `restart=unless-stopped`, so they usually come up with dockerd). If not running: `docker start nomad_mysql nomad_redis`. If missing entirely, recreate: `docker run -d --name nomad_mysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=password -e MYSQL_DATABASE=nomad mysql:8.0` and `docker run -d --name nomad_redis -p 6379:6379 redis:7-alpine`.
3. **Command Center** (dev): from `admin/`, `npm run dev` (serves http://localhost:8080 with Vite HMR). Health check: `GET /api/health`.
4. **Queue workers** (needed for downloads / AI / benchmark features): from `admin/`, `npm run work:all`.

Before first run on a brand-new DB: `node ace migration:run --force` then `node ace db:seed` (in `admin/`). The `db:seed` populates the installable tool catalog (`services` table).

### Non-obvious gotchas
- **`admin/.env` is gitignored and must exist.** It requires a `URL` var (e.g. `URL=http://localhost:8080`) that is **not** in `.env.example`; the app fails env validation without it. Generate `APP_KEY` with `node ace generate:key` (note: this command also rewrites `APP_KEY=` in `.env.example` — revert that file afterward).
- **Vite "Outdated Optimize Dep" 504s**: running `node ace test` (or anything that changes the Vite config) while `npm run dev` is running invalidates the running server's Vite optimize cache, causing 504s on `/node_modules/...` and a blank UI. Fix: stop the dev server, `rm -rf admin/node_modules/.vite`, and restart `npm run dev`. Don't run `node ace test` against the live dev server.
- **Tool containers in dev** are only attached to the `project-nomad_default` Docker network when `NODE_ENV=production`; in dev they run on the default bridge with published host ports (e.g. CyberChef on 8100), so installs work without creating that network.
- **Lint is not clean on `main`**: `npm run lint` reports many pre-existing `prettier/prettier` formatting errors. `npm run typecheck` and `npm run build` are clean. There are currently no test spec files, so `node ace test` reports "NO TESTS EXECUTED".
