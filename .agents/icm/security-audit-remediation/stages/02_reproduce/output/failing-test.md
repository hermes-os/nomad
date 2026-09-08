# Stage 02 reproduction: Cal-owned bounded proof

Finding: Dozzle web-shell access (Stage 01 audit entry 5, MEDIUM)

## Current result

The earlier worker-environment blocker is superseded for this handoff by a
Cal-owned bounded reproduction on 2026-09-08. Cal started only a disposable
Dozzle container from the reviewed image, published it on loopback port 19999,
and mounted the Docker socket read-only. The Nomad production compose stack was
not started; its database, updater, persistent volumes, and published service
ports were not touched.

The rendered Dozzle UI returned successfully and showed the disposable running
container. Its container view exposed a `Shell` action. Activating that action
opened the terminal dialog for the disposable container; the dialog reported
that attachment closed, so shell command execution itself is not claimed. This
is sufficient to reproduce the unauthenticated shell surface enabled by the
compose setting, not to claim a successful command session.

The disposable container was removed by its recorded identity and the loopback
port was verified closed afterward. This replaces the environmental blocker as
the current reproduction evidence while retaining the original worker checks
below as provenance.


Result: BLOCKED — the recorded checks identified no usable Docker/default-
context or systemd-machine Debian runtime in this worker. No runtime
reproduction is claimed.

## Boundary under test

The compose boundary is the Dozzle service in
`install/management_compose.yaml`: port `9999:8080`, the Docker socket mount,
and `DOZZLE_ENABLE_SHELL=true`. Demonstrating the finding requires starting
the bounded Dozzle service in an isolated Debian environment and observing the
shell-enabled interface from the published listener. The installation stack
was not started, and no installation script was executed.

## Bounded environment checks

Commands were run from the repository root:

```text
docker info
```

Observed result: exit status `1`. The Docker client reported its default
context, then failed to access the server:

```text
Server:
permission denied while trying to connect to the Docker API at unix:///var/run/docker.sock
```

```text
sed -n '1,12p' /etc/os-release
```

Observed result: exit status `0`; the worker identifies as `Omarchy`,
`ID=omarchy`, and `ID_LIKE=arch`, not Debian.

```text
machinectl list
```

Observed result: exit status `0`, `No machines.` This recorded check did not
identify a systemd-machine Debian runtime.

## Scope and residual risk

The blocker is environmental: Docker is installed, but the default-context
daemon socket is inaccessible, and the recorded systemd-machine check returned
no machines. Other VM/container runtimes were not assessed. This pass
therefore does not establish the Dozzle UI or shell command execution over
port 9999; the Stage 01 static finding remains unmodified and untested at
runtime.

No product or compose source changed in this pass. No `admin/tests/unit` spec
was added because this is an `install/` compose finding with no unit-test
surface.
