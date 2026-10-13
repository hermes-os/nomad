# 03_fix — smallest change that passes

One job: make the failing spec pass without changing anything else.

## Inputs

- Working: the confirmed defect from stage 01 and the failing spec from stage 02
- Reference: `../../_shared/fix-patterns.md`
- Reference: `../../_shared/constraints.md`
- Reference: the source file the finding names

Do NOT load: anything outside listed inputs.

## Process

1. Read the defect and the failing spec.
2. Reach for an existing idiom first — `resolveWithinDirectory`,
   `assertNotPrivateUrl`, the ENOENT convention. A new helper needs a stated
   reason the existing one does not fit.
3. Write the fix at the boundary where bad input arrives, not downstream of it.
   Reject with a terse, greppable message.
4. Run the unit suite: the new spec passes, no existing spec breaks. For an
   `install/` change, run `npm test` (temp-file tests only).
5. Hard limits: touch only the lines the fix requires. No reformatting, no
   renaming, no consolidating the two inlined containment call sites unless the
   finding already changes them. No new dependency.

## Outputs

- Source edits → the file(s) the finding names
- Which idiom was reused and why → the commit body (stage 05)
