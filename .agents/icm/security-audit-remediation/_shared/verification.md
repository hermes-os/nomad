# Verification

## Gate

Run from the repository root, narrow first:

```bash
npm --prefix admin ci        # first run in a fresh checkout only
npm --prefix admin test
npm --prefix admin run lint
npm --prefix admin run typecheck
npm --prefix admin run build
agent-repo-check --repo "$PWD"
```

`npm --prefix admin test` runs `node ace test` across both suites declared in
`admin/adonisrc.ts`. It binds `0.0.0.0:3333`; a sandbox that forbids listening
sockets cannot run it, and that is a blocker to report, not a step to skip.

`agent-repo-check` checks repository hygiene, not the project's own gate. Run
both.

## Evidence

A stage that claims a check passed records, per command:

- the exact command line,
- its exit status,
- the last lines of output, including assertion or file counts.

## Rules

- Never claim a result you did not observe in this pass. A remembered green run
  from an earlier finding is not evidence for this one.
- The reproduce spec must be observed failing before the fix and passing after.
  A spec that passes before the fix is testing the wrong thing.
- If a command cannot run here, say which one and why, and state the residual
  risk plainly rather than reporting a partial gate as a full one.
- `install/` changes are not covered by any of these commands. Their evidence
  is a reading of the diff plus, when behavior changes, a run in an isolated
  Debian environment.
