# security-audit-remediation

Land the still-open findings from `admin/docs/security-audit-v1.md`, one
narrowly scoped change at a time.

Form: pipeline. One pass handles exactly one finding. The pipeline leaves no
files of its own: its results are the spec, the fix, and the commit.

## Path convention

Paths starting `admin/`, `install/`, or `collections/` are repo-root-relative.
Paths starting `../` are relative to the folder holding that CONTEXT.md.

## Stages

| # | Folder | One job | Result |
|---|--------|---------|--------|
| 01 | `stages/01_triage/` | Confirm the next finding against current code | the defect, stated in the commit body |
| 02 | `stages/02_reproduce/` | Write the spec that fails today | spec, observed failing |
| 03 | `stages/03_fix/` | Make the smallest change that passes it | the fix |
| 04 | `stages/04_verify/` | Run the gate | gate results, stated in the report |
| 05 | `stages/05_land/` | Release notes, `CHANGELOG.md`, commit | one commit |

A stage is complete when its job is done and observed, not when a file exists.
A finding triage rules open but not worth fixing this pass goes in `issues.md`;
the commit that fixes it later removes the entry. A fresh independent reviewer
reads the commits after the worker finishes; fixes from the review are new
commits. Only the coordinator pushes or deploys.

## Factory

| File | Holds |
|------|-------|
| `_shared/constraints.md` | Repo invariants and scope rules every stage obeys |
| `_shared/codebase-map.md` | Where the audited surfaces and their specs live |
| `_shared/fix-patterns.md` | Containment and SSRF idioms already in the tree |
| `_shared/verification.md` | Gate commands and their known baseline |
| `_shared/delivery.md` | Commit, release-notes, and CHANGELOG conventions |

The audit report lists the findings. It marks findings 10, 11, and 13 accepted
risk and its two INFORMATIONAL entries by design; those are not work items.
Findings still open at the time of writing are listed in `issues.md`.
