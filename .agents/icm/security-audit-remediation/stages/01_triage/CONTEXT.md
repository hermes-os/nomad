# 01_triage — confirm the next real finding

One job: turn one audit entry into a defect confirmed against today's code.

## Inputs

- Reference: `admin/docs/security-audit-v1.md`
- Reference: `../../_shared/constraints.md`
- Reference: `../../_shared/codebase-map.md`
- Working: `git log --oneline -40` and the source files the entry names

Do NOT load: anything outside listed inputs.

## Process

1. Read the audit report. Skip findings 10, 11, 13 and both INFORMATIONAL
   entries — the report accepts those.
2. For each remaining finding, open the file it names and decide: already
   fixed, partially fixed, or open. The report describes v1.28.0; line numbers
   have moved and some fixes have landed since.
3. Pick the highest-severity open finding. On a tie, pick the one whose fix
   touches the fewest files.
4. Write the confirmed defect: the exact request or input that triggers it, the
   current file and line, the observable wrong behavior, the blast radius, and
   whether it has an automated test surface at all.
5. Hard limits: quote current code, not the report's snippets. Do not propose a
   fix. Do not edit application code. One finding only.

## Outputs

- Confirmed defect → `output/finding.md`
- Findings ruled already-fixed, with the commit that fixed each → same file

## Human check

Read `output/finding.md` and confirm the chosen finding is the one to fix next;
edit the file in place if it is not.
