# Changelog

## Unreleased

- **Docs**: Contributor and agent guidance now describes one workflow: work on `main`, commit each finished change with its changelog entry, review the commits afterwards, and leave pushing and deploying to Foreman (the coordinator). Removed the branch, fork, pull-request, staged-diff and stage-approval steps.
- **Docs**: README and CONTRIBUTING now point upstream-bound changes to Crosstalk-Solutions/project-nomad and require a root `CHANGELOG.md` entry alongside the release-notes entry.
- **Security**: Updated production dependencies in `admin/` within their existing version ranges (`npm audit fix`, no major bumps): `npm audit --omit=dev` drops from 63 findings (4 critical, 37 high) to 28 (1 critical, 15 high). The rest need major bumps and are listed in `issues.md`.
