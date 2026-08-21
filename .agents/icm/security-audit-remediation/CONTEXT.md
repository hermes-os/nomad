# security-audit-remediation

Land the still-open findings from `admin/docs/security-audit-v1.md`, one
narrowly scoped, individually reviewed change at a time.

Form: pipeline. One pass handles exactly one finding. Run it again for the
next one, clearing the `output/` folders between passes.

## Path convention

Paths starting `admin/`, `install/`, or `collections/` are repo-root-relative.
Paths starting `../` are relative to the folder holding that CONTEXT.md.

## Stages

| # | Folder | One job | Output |
|---|--------|---------|--------|
| 01 | `stages/01_triage/` | Confirm the next finding against current code | `finding.md` |
| 02 | `stages/02_reproduce/` | Write the spec that fails today | `failing-test.md` |
| 03 | `stages/03_fix/` | Make the smallest change that passes it | `change.md` |
| 04 | `stages/04_verify/` | Run the gate, review the diff | `evidence.md` |
| 05 | `stages/05_land/` | Release notes and conventional commit | `commit.md` |

A stage is complete when its `output/` holds files. Nothing advances until a
person has read the previous stage's output and edited it in place.

## Factory

| File | Holds |
|------|-------|
| `_shared/constraints.md` | Repo invariants and scope rules every stage obeys |
| `_shared/codebase-map.md` | Where the audited surfaces and their specs live |
| `_shared/fix-patterns.md` | Containment and SSRF idioms already in the tree |
| `_shared/verification.md` | Gate commands and what counts as evidence |
| `_shared/delivery.md` | Commit, release-notes, and branch conventions |

The audit report is the backlog. It marks findings 10, 11, and 13 accepted
risk and its two INFORMATIONAL entries by design; those are not work items.
