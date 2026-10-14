# Changelog

## Unreleased

- **Docs**: Contributor and agent guidance now describes one workflow: work on `main`, commit each finished change with its changelog entry, review the commits afterwards, and leave pushing and deploying to Foreman (the coordinator). Removed the branch, fork, pull-request, staged-diff and stage-approval steps.
- **Docs**: README and CONTRIBUTING now point upstream-bound changes to Crosstalk-Solutions/project-nomad and require a root `CHANGELOG.md` entry alongside the release-notes entry.
- **Security**: Updated production dependencies in `admin/` within their existing version ranges (`npm audit fix`, no major bumps): `npm audit --omit=dev` drops from 63 findings (4 critical, 37 high) to 28 (1 critical, 15 high). The rest need major bumps and are listed in `issues.md`.
- **Security**: The admin container in `install/management_compose.yaml` now sets `LOG_LEVEL=info` instead of `debug`. Existing hosts pick it up when the compose file is next re-downloaded by the installer.
- **Security**: Dozzle's container shell route is off by default (`DOZZLE_ENABLE_SHELL=false`) in the install compose file for new installs, and `install/update_nomad.sh` and the sidecar updater rewrite `DOZZLE_ENABLE_SHELL=true` to `false` in the deployed compose file on update. Hosts still running older copies of those scripts keep the shell route until the installer is re-run.
