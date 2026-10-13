# Delivery

## Commit message

Conventional Commits, per `CONTRIBUTING.md`: `<type>(<scope>): <description>`.
Types in use: `feat`, `fix`, `docs`, `refactor`, `chore`, `test`. Scopes seen on
this work: `Security`, `updates`, `fs`, `env`.

The body states, in prose:

1. the defect and the exact request or input that triggers it,
2. why the old code let it through,
3. what the change does,
4. what behavior is deliberately preserved.

Example subject: `fix(Security): reject content update paths that escape content storage`

## Release notes and CHANGELOG

A user-visible change gets two entries in the same commit:

- `admin/docs/release-notes.md` under `## Unreleased`, in `### Features`,
  `### Bug Fixes`, or `### Improvements`. Format: `- **Area**: Description`.
  This file is rendered in the UI, so describe the behavior a user now sees,
  not the code.
- `CHANGELOG.md` at the repository root under `## Unreleased`.

Never add a release heading and never edit released sections. CI
(`.github/scripts/finalize-release-notes.sh`) stamps the version and date into
`admin/docs/release-notes.md` on release; the coordinator does the same for
`CHANGELOG.md`.

An internal-only change — a refactor with no behavior delta, a test-only
commit — gets no `admin/docs/release-notes.md` entry.

## Release and deploy

Releases are cut by `semantic-release` on `main` (`.releaserc.json`; `rc` is
the prerelease branch) and published by the `workflow_dispatch` workflows in
`.github/workflows/`, gated by the `DEPLOYMENT_AUTHORIZED_USERS` secret. Hosts
update through `install/update_nomad.sh` or the in-app sidecar updater
(`install/sidecar-updater/update-watcher.sh`). Neither path downloads newer
copies of the install scripts; see `issues.md`.
