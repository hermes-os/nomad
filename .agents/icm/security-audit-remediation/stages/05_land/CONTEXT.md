# 05_land — release notes and commit

One job: land the verified change on a branch, documented for users.

## Inputs

- Working: `../04_verify/output/evidence.md`
- Working: `../01_triage/output/finding.md`
- Reference: `../../_shared/delivery.md`
- Working: `admin/docs/release-notes.md`

Do NOT load: anything outside listed inputs.

## Process

1. Confirm the gate in `evidence.md` is green. A red or partial gate stops here.
2. If the change alters behavior a user can observe, add one line under
   `## Unreleased` → the matching heading in `admin/docs/release-notes.md`,
   formatted `- **Area**: Description`. Describe the behavior, not the code. An
   internal-only change gets no entry.
3. Create the branch off `main` and commit with explicit paths — the fix, its
   spec, and the release note, nothing else.
4. Write the conventional-commit subject and the four-part body from
   `../../_shared/delivery.md`.
5. Hard limits: never mention the audit report's finding number as if it were a
   public issue. Never push or open a PR unless asked. Never commit `output/`.

## Outputs

- Branch and commit in the repository
- Branch name, subject, body, and changed-file list → `output/commit.md`

## Human check

Run `git show --stat` on the new commit and confirm the file list matches
`output/commit.md` before pushing or opening the PR.
