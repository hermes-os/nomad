# Stage 03 fix: Dozzle web-shell access

Finding: Dozzle web shell access (Stage 01 audit entry 5, MEDIUM).

## Changed file and lines

`install/management_compose.yaml`, line 56 — one line, one file.

```diff
       - DOZZLE_ENABLE_ACTIONS=true # Enables the action buttons (restart, stop, etc.)
-      - DOZZLE_ENABLE_SHELL=true  # Enables web-based shell access
+      - DOZZLE_ENABLE_SHELL=false  # Shell access is unauthenticated on the LAN; keep disabled
```

`git diff --stat` for this candidate: `1 file changed, 1 insertion(+),
1 deletion(-)`.

## Why the old setting exposed the surface

Stage 01 located the trigger at `install/management_compose.yaml:50-56`: the
Dozzle listener is published as `9999:8080` on all host interfaces, the host
Docker socket is mounted into the container, and `DOZZLE_ENABLE_SHELL=true`
turned on the container-shell feature. Nomad has no application
authentication, so any client that can reach LAN port 9999 reached the shell
surface without a credential.

Reading the pinned image's own source (`amir20/dozzle:v10.0`, tag `v10.0.0`)
shows the value is what registers the shell endpoints. In
`internal/web/routes.go:147-150`, the attach and exec routes are registered
only inside `if h.config.EnableShell`:

```go
if h.config.EnableShell {
    r.Get("/hosts/{host}/containers/{id}/attach", h.attach)
    r.Get("/hosts/{host}/containers/{id}/exec", h.exec)
}
```

`internal/web/index.go:49,53` gates the UI's `enableShell` flag on the same
value, which matches the Stage 02 observation that the UI rendered a `Shell`
action and opened a terminal dialog.

## Chosen fix and why disable rather than remove

Set the existing key to `false` rather than deleting the line.

Both options close the surface: `internal/support/cli/args.go:27` declares
`EnableShell bool` with `arg:"--enable-shell,env:DOZZLE_ENABLE_SHELL"` and
`default:"false"`, so an absent variable and an explicit `false` both leave the
routes unregistered. Deleting the line was rejected for two source-backed
reasons:

1. The installer rewrites the compose file by line-oriented `sed` and then
   greps it for unresolved values (`install/install_nomad.sh:504-533`). An
   explicit key keeps the setting greppable in the deployed
   `/opt/nomad/compose.yml` for an operator or a later audit; a deleted line
   leaves nothing to inspect and makes an accidental re-enable invisible.
2. The audit's own stated remediation is `Set DOZZLE_ENABLE_SHELL=false`
   (`admin/docs/security-audit-v1.md:149`), and pinning the value defensively
   states intent if a future Dozzle release changes its default.

The value is parsed as a Go bool: go-arg reads the env var
(`parse.go:535,563`) and go-scalar parses it with `strconv.ParseBool`
(`scalar.go:104-109`), so the string `false` is accepted and yields `false`.

## Deliberately preserved behavior

- `DOZZLE_ENABLE_ACTIONS=true` (line 55) is unchanged. It is a separate flag on
  a separate route: `routes.go:144-146` registers only
  `POST .../actions/{action}`, and `container.ParseContainerAction`
  (`internal/container/types.go:173-181`) accepts only `start`, `stop`, and
  `restart`, returning an error for anything else. Actions cannot reach attach
  or exec, so restart/stop control survives without re-opening the shell.
- The LAN logging surface is intact: the `9999:8080` publish, the
  `/var/run/docker.sock` mount, the `amir20/dozzle:v10.0` image pin, the
  container name, and the restart policy are untouched. Log viewing is not
  gated by `EnableShell`.
- Host/container topology, every other service, and both credential
  placeholders are unchanged.
- Out of scope by the finding and `_shared/constraints.md`: application
  authentication, narrowing the published port, database, updater, and the
  other audit entries. Nomad remains unsuitable for direct public-internet
  exposure; this change does not alter that.

## Checks observed in this pass

Run from the repository root. Only results actually observed are recorded.

```text
docker compose -f install/management_compose.yaml config --quiet
```

Exit status `0`. Parse and schema validation only; no service was created or
started.

```text
docker compose -f install/management_compose.yaml config
```

Exit status `0`. The rendered `dozzle` service shows
`DOZZLE_ENABLE_SHELL: "false"` alongside `DOZZLE_ENABLE_ACTIONS: "true"`, with
`published: "9999"` → `target: 8080` preserved.

```text
python3 -c "import yaml; ..."   # PyYAML 6.0.3 safe_load
```

Exit status `0`. Parsed `services.dozzle.environment` is
`['DOZZLE_ENABLE_ACTIONS=true', 'DOZZLE_ENABLE_SHELL=false']`; ports and the
socket mount are unchanged; the service list is still `admin, dozzle, mysql,
redis, updater`.

```text
agent-repo-check --repo "$PWD"
```

Exit status `0`. Output: `Repository check: PASS`.

Static source review of the pinned image: `amir20/dozzle` tag `v10.0.0` source
was downloaded and read at `internal/support/cli/args.go:26-27`,
`internal/web/routes.go:144-150`, `internal/web/index.go:49,53`,
`internal/web/actions.go:12-54`, and `internal/container/types.go:173-181`.

No new runtime reproduction was attempted in this pass. The worker's Docker
daemon remains inaccessible (`docker info` exit `1`, permission denied on
`unix:///var/run/docker.sock`; the process runs as uid 961 `agent-worker`,
which is not in the `docker` group), so no disposable container was started or
removed here. Stage 02's Cal-owned bounded loopback reproduction stands as the
reproduction evidence; the Nomad production stack was not started.

## Residual risk

- No post-fix runtime confirmation exists: this pass did not observe the Dozzle
  UI with `DOZZLE_ENABLE_SHELL=false` and therefore does not claim the `Shell`
  action is gone from the rendered interface. The claim rests on the route
  registration in the pinned image's source plus the rendered compose config.
  A bounded loopback run in an isolated Debian environment would close this gap.
- The template is only the default. A host whose `/opt/nomad/compose.yml` was
  already written by an earlier install keeps `true` until it is re-downloaded
  or hand-edited; `install/install_nomad.sh:484-496` preserves existing
  credentials but does not migrate this setting.
- The Docker socket mount and the all-interfaces `9999` publish are unchanged
  and remain in the threat model as designed. Anyone reaching port 9999 can
  still read logs and start/stop/restart containers without authentication;
  closing that would require the auth work the pipeline places out of scope
  under finding 10.
- `install/` has no automated test surface, so no spec was added and none was
  run. The admin gate (`npm --prefix admin test/lint/typecheck/build`) was not
  run because this candidate touches no `admin/` source.

## State

Candidate is uncommitted in the canonical checkout. Stage 01 and Stage 02
outputs are untouched and remain untracked. No commit, push, approval, or
delivery was performed.
