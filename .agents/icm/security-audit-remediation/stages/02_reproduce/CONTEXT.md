# 02_reproduce — prove the defect first

One job: demonstrate the confirmed defect before any fix exists.

## Inputs

- Working: `../01_triage/output/finding.md`
- Reference: `../../_shared/codebase-map.md`
- Reference: `../../_shared/verification.md`
- Reference: the module under test and its existing spec, if one exists

Do NOT load: anything outside listed inputs.

## Process

1. Read the finding. Identify the boundary the defect crosses — a service
   method, a validator, a controller action, a compose setting.
2. An `install/` finding has no unit-test surface. Record the exact command and
   the observed wrong state from an isolated Debian environment, then stop.
   Steps 3-6 are for `admin/` findings.
3. Add the spec under `admin/tests/unit/`, in the file named for that module,
   creating it only if none exists. Match the surrounding test style.
4. Assert observable behavior at that boundary: the call throws, or the resolved
   path stays inside storage. Never assert on internals or on a mock being
   called.
5. Add the boundary cases the defect implies, including those that must keep
   working — an RFC1918 host, a legitimate filename, a valid settings key.
6. Run the unit suite and capture the failure.
7. Hard limits: no application-code changes here. No test that passes before
   the fix. No mocking of pure code.

## Outputs

- Spec file(s) → `admin/tests/unit/<module>.spec.ts`, for an `admin/` finding
- Failing-run transcript, or the manual reproduction → `output/failing-test.md`

## Human check

Read `output/failing-test.md` and confirm the defect is demonstrated for its
own reason, not a typo, a missing import, or a misread setting.
