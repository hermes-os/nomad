# Confirmed finding: Dozzle web shell access

Audit entry: 5 — Web Shell Access (MEDIUM)

Status: open in today’s code. This is the highest-severity open entry after
the four HIGH entries were ruled already-fixed. Its remediation is bounded to
the production compose template, so it wins the tie on smallest change scope
among the remaining MEDIUM entries examined.

## Trigger

Any unauthenticated LAN client can request `GET /` from the host’s published
Dozzle listener at `http://<nomad-host>:9999/`, then select a container and
submit a shell command in the web UI. No special payload is required; the
compose input enabling the behavior is:

```yaml
    ports:
      - "9999:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock # Allows Dozzle to read logs from the Host's Docker daemon
    environment:
      - DOZZLE_ENABLE_SHELL=true  # Enables web-based shell access
```

Current locations: `install/management_compose.yaml:50-56`.

## Observable behavior

The Dozzle interface exposed on port 9999 offers interactive shell access to
containers. The current value `DOZZLE_ENABLE_SHELL=true` explicitly enables
that feature.

## Blast radius

The listener is published on all host interfaces by `9999:8080`, and the
Dozzle container has the host Docker socket mounted. A client able to reach
port 9999 can therefore obtain a container shell and use the Docker control
plane available to that container. This crosses the intended LAN-appliance
boundary into control of Nomad-managed containers and, through the mounted
socket, potentially host Docker resources. Nomad has no application
authentication by design, so the reachable LAN is the only access boundary;
this does not make the service suitable for direct public-internet exposure.

## Automated test surface

No automated test covers this compose-template setting in the listed test
surfaces. Confirmation is static review of the production compose file; the
codebase map lists only admin unit/functional suites and no compose security
spec.

## Higher-severity entries ruled already-fixed

- Finding 1 (ZIM file delete): fixed by `75106a8`; current
  `admin/app/services/zim_service.ts:336-339` resolves through
  `resolveWithinDirectory` and rejects an invalid result.
- Finding 2 (map file delete): fixed by `75106a8`; current
  `admin/app/services/map_service.ts:407-413` resolves the candidate and
  rejects paths outside the base directory.
- Finding 3 (documentation read): fixed by `75106a8`; current
  `admin/app/services/docs_service.ts:69-74` resolves the candidate and
  rejects paths outside the docs directory.
- Finding 4 (download-endpoint SSRF): fixed by `75106a8`, with later
  hardening in `5d3c659` and `7f45147`; current
  `admin/app/validators/common.ts:14-32,41-48` contains the loopback,
  unspecified, link-local, and IPv4-mapped-host checks described by the
  audit’s fix.
