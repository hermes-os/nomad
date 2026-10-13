# Verification

## Gate

Run from the repository root, narrow first:

```bash
npm --prefix admin ci        # first run in a fresh checkout only
npm test                     # root: branding check, install-script tests
npm --prefix admin test
npm --prefix admin run lint
npm --prefix admin run typecheck
npm --prefix admin run build
agent-repo-check --repo "$PWD"
```

`npm --prefix admin test` runs `node ace test` across the suites declared in
`admin/adonisrc.ts`. Only `unit` has specs today. The `functional` suite would
bind `0.0.0.0:3333`; a sandbox that forbids listening sockets cannot run it, and
that is a blocker to report, not a step to skip.

`agent-repo-check` checks repository hygiene, not the project's own gate. Run
both.

`admin/` reads and validates its environment at startup (`admin/start/env.ts`).
The tests pass with a git-ignored `admin/.env`, or with the values from
`admin/.env.example` exported into the shell. Do not commit an `.env` file.

## Known baseline

- `npm --prefix admin run lint` fails on `main` with pre-existing errors in
  `admin/` (see `issues.md`). A change is judged by not adding to that count,
  not by a clean run. Report the before and after totals.
- `npm test` and `npm --prefix admin test` both pass on `main`.

## Evidence

Per command, the report states the exact command line, its exit status, and the
last lines of output, including assertion or file counts.

## Rules

- Never claim a result you did not observe in this pass.
- The reproduce spec must be observed failing before the fix and passing after.
  A spec that passes before the fix is testing the wrong thing.
- If a command cannot run here, say which one and why, and state the residual
  risk plainly rather than reporting a partial gate as a full one.
- `install/` changes are not covered by `npm --prefix admin ...`. `npm test`
  runs `install/tests/test_dozzle_shell_migration.sh` against temp files only.
  For anything else under `install/`, the evidence is a reading of the diff
  plus, when behavior changes, a run in an isolated Debian environment.
