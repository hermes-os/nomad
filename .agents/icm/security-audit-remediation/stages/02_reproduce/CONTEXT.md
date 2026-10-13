# 02_reproduce — prove the defect first

One job: demonstrate the confirmed defect before any fix exists.

## Inputs

- Working: the confirmed defect from stage 01
- Reference: `../../_shared/codebase-map.md`
- Reference: `../../_shared/verification.md`
- Reference: the module under test and its existing spec, if one exists

Do NOT load: anything outside listed inputs.

## Process

1. Identify the boundary the defect crosses — a service method, a validator, a
   controller action, a compose setting.
2. An `install/` finding has no `admin/` unit-test surface. If the behavior can
   be exercised against temp files, extend
   `install/tests/test_dozzle_shell_migration.sh` or `tests/*.test.mjs` (both
   run by `npm test`). Otherwise the evidence is the exact command and observed
   wrong state from an isolated Debian environment. Never run `install/`
   scripts on the worker host. Steps 3-6 are for `admin/` findings.
3. Add the spec under `admin/tests/unit/`, in the file named for that module,
   creating it only if none exists. Match the surrounding test style.
4. Assert observable behavior at that boundary: the call throws, or the resolved
   path stays inside storage. Never assert on internals or on a mock being
   called.
5. Add the boundary cases the defect implies, including those that must keep
   working — an RFC1918 host, a legitimate filename, a valid settings key.
6. Run the unit suite and observe the failure.
7. Hard limits: no application-code changes here. No test that passes before
   the fix. No mocking of pure code.

## Outputs

- Spec file(s) → `admin/tests/unit/<module>.spec.ts`, for an `admin/` finding
- The failing run, summarized in the commit body of the fix. Do not write it to
  a file.
