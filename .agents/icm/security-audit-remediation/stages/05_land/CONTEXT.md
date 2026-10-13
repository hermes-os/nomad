# 05_land — release notes, CHANGELOG, commit

One job: commit the verified change on `main`, documented for users.

## Inputs

- Working: the gate results from stage 04
- Working: the confirmed defect from stage 01
- Reference: `../../_shared/delivery.md`
- Working: `admin/docs/release-notes.md`, `CHANGELOG.md`, `issues.md`

Do NOT load: anything outside listed inputs.

## Process

1. Confirm the gate is green against the baseline in
   `../../_shared/verification.md`. A red or partial gate stops here.
2. If the change alters behavior a user can observe, add one line under
   `## Unreleased` → the matching heading in `admin/docs/release-notes.md`,
   formatted `- **Area**: Description`, and an entry under `## Unreleased` in
   `CHANGELOG.md`. Describe the behavior, not the code. An internal-only change
   gets no `admin/docs/release-notes.md` entry.
3. If the finding has an `issues.md` entry, remove it in this commit.
4. Commit on `main` with `committer "<message>" <exact paths>` — the fix, its
   spec, the release note, and the CHANGELOG entry, nothing else.
5. Write the conventional-commit subject and the four-part body from
   `../../_shared/delivery.md`.
6. Hard limits: never mention the audit report's finding number as if it were a
   public issue. Never push, release, or deploy. Never add a release heading.
   Leave `git status` clean.

## Outputs

- One commit on `main`.
