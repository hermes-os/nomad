# 03_fix — smallest change that passes

One job: make the failing spec pass without changing anything else.

## Inputs

- Working: `../01_triage/output/finding.md`
- Working: `../02_reproduce/output/failing-test.md`
- Reference: `../../_shared/fix-patterns.md`
- Reference: `../../_shared/constraints.md`
- Reference: the source file the finding names

Do NOT load: anything outside listed inputs.

## Process

1. Read the finding and the failing spec.
2. Reach for an existing idiom first — `resolveWithinDirectory`,
   `assertNotPrivateUrl`, the ENOENT convention. A new helper needs a stated
   reason the existing one does not fit.
3. Write the fix at the boundary where bad input arrives, not downstream of it.
   Reject with a terse, greppable message.
4. Run the unit suite: the new spec passes, no existing spec breaks. For an
   `install/` change, re-run the manual reproduction instead.
5. Hard limits: touch only the lines the fix requires. No reformatting, no
   renaming, no consolidating the two inlined containment call sites unless the
   finding already changes them. No new dependency.

## Outputs

- Source edits → the file(s) the finding names
- Diff summary, the idiom reused, and the passing run → `output/change.md`

## Human check

Read `git diff` against `output/change.md` and confirm every changed line is
required by the finding.
