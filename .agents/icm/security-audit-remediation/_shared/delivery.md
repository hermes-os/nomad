# Delivery

## Branch

Branch off `main`, one branch per finding, named for the change:
`vm-cal/fix-content-update-path-traversal`,
`vm-cal/fix-ssrf-ipv4-mapped-bypass`, `vm-cal/fix-registry-tag-pagination`.
Do not commit directly to `main`. Do not push unless asked.

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

## Release notes

User-visible changes go in `admin/docs/release-notes.md` under `## Unreleased`,
in `### Features`, `### Bug Fixes`, or `### Improvements`. Format:
`- **Area**: Description`. Describe the behavior a user now sees, not the code.

CI stamps the version and date on release; never edit released sections.

An internal-only change — a refactor with no behavior delta, a test-only
commit — gets no entry.

## Pull request

Open against `main`. The description summarizes what changed and why,
references the issue (`Closes #123`), and names the verification run.
