# 04_verify — run the gate, review the diff

One job: produce evidence the change is correct and complete.

## Inputs

- Working: `../03_fix/output/change.md`
- Working: `../01_triage/output/finding.md`
- Reference: `../../_shared/verification.md`
- Reference: `../../_shared/constraints.md`
- Working: `git diff` against `main`

Do NOT load: anything outside listed inputs.

## Process

1. Run every gate command in `../../_shared/verification.md`, in order, and
   capture each exit status and tail.
2. Review the frozen diff adversarially: does the fix close the finding's exact
   trigger, or only the one shape the spec covers? Is there a second call site
   with the same defect? Does a legitimate input now get rejected?
3. Check the constraints: RFC1918 still reachable, no dependency added, no
   version field touched, no unrelated formatting.
4. Verify each review finding against real code before recording it. Fix every
   defect that survives, then re-run the gate.
5. Hard limits: no unverified claims. A command you could not run is a blocker,
   recorded as one — not a skipped step.

## Outputs

- Commands, exit statuses, and output tails → `output/evidence.md`
- Surviving review findings and their resolutions → same file

## Human check

Read `output/evidence.md` and confirm the gate is green and the residual risk
listed is one you accept.
