# 04_verify — run the gate

One job: produce evidence the change is correct and complete.

## Inputs

- Working: the fix and spec from stages 02-03
- Reference: `../../_shared/verification.md`
- Reference: `../../_shared/constraints.md`
- Working: `git diff` against `HEAD`

Do NOT load: anything outside listed inputs.

## Process

1. Run every gate command in `../../_shared/verification.md`, in order, and note
   each exit status and output tail.
2. Read the diff adversarially: does the fix close the finding's exact trigger,
   or only the one shape the spec covers? Is there a second call site with the
   same defect? Does a legitimate input now get rejected?
3. Check the constraints: RFC1918 still reachable, no dependency added, no
   version field touched, no unrelated formatting.
4. Verify each problem against real code before acting on it. Fix every defect
   that survives, then re-run the gate. A defect outside this finding's scope
   goes in `issues.md`, not into this change.
5. Hard limits: no unverified claims. A command you could not run is a blocker,
   reported as one — not a skipped step.

## Outputs

- Commands, exit statuses, and output tails → the worker's report.
- Anything found and not fixed → `issues.md`, in its own commit.
