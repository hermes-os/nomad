# Contributing to Nomad

Thank you for your interest in contributing to Nomad! Community contributions are what keep this project growing and improving. Please read this guide fully before getting started — it will save you (and the maintainers) a lot of time.

> **Note:** Acceptance of contributions is not guaranteed. All contributions are evaluated based on quality, relevance, and alignment with the project's goals. The maintainers of Nomad reserve the right accept, deny, or modify any contribution at their sole discretion.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Before You Start](#before-you-start)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Commit Messages](#commit-messages)
- [Release Notes](#release-notes)
- [Versioning](#versioning)
- [Delivery](#delivery)
- [Feedback & Community](#feedback--community)

---

## Code of Conduct

Please read and review our full [Code of Conduct](https://github.com/hermes-os/nomad/blob/main/CODE_OF_CONDUCT.md) before contributing. In short: please be respectful and considerate in all interactions with maintainers and other contributors.

We are committed to providing a welcoming environment for everyone. Disrespectful or abusive behavior will not be tolerated. 

---

## Before You Start

**Open an issue first.** Before writing any code, please [open an issue](../../issues/new) to discuss your proposed change. This helps avoid duplicate work and ensures your contribution aligns with the project's direction.

When opening an issue:
- Use a clear, descriptive title
- Describe the problem you're solving or the feature you want to add
- If it's a bug, include steps to reproduce it and as much detail about your environment as possible
- Ensure you redact any personal or sensitive information in any logs, configs, etc.

---

## Getting Started with Contributing
**Please note**: this is the Getting Started guide for developing and contributing to Nomad, NOT [installing Nomad](https://github.com/hermes-os/nomad/blob/main/README.md) for regular use!

### Prerequisites

- A Debian-based OS (Ubuntu recommended)
- `sudo`/root privileges
- Docker installed and running
- A stable internet connection (required for dependency downloads)
- Node.js (for frontend/admin work)

### Clone

```bash
git clone https://github.com/hermes-os/nomad.git
cd nomad
```

### Avoid Installing a Release Version Locally
Because Nomad relies heavily on Docker, we actually recommend against installing a release version of the project on the same local machine where you are developing. This can lead to conflicts with ports, volumes, and other resources. Instead, you can run your development version in a separate Docker environment while keeping your local machine clean. It certainly __can__ be done, but it adds complexity to your setup and workflow. If you choose to install a release version locally, please ensure you have a clear strategy for managing potential conflicts and resource usage.

---

## Development Workflow

1. **Work on `main`.** There are no feature branches.

2. **Make your changes.** Follow existing code style and conventions. Test your changes locally against a running Nomad instance.

3. **Run the checks** from the repository root before you commit:
   ```bash
   npm test
   npm --prefix admin ci        # first run in a fresh checkout only
   npm --prefix admin test
   npm --prefix admin run lint
   npm --prefix admin run typecheck
   npm --prefix admin run build
   ```
   `install/` scripts run as root and manage host services. Never execute them on a development machine; test them only in an isolated Debian environment.

4. **Add release notes** (see [Release Notes](#release-notes) below).

5. **Commit your changes** using [Conventional Commits](#commit-messages).

---

## Commit Messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/). All commit messages must follow this format:

```
<type>(<scope>): <description>
```

**Common types:**

| Type | When to use |
|------|-------------|
| `feat` | A new user-facing feature |
| `fix` | A bug fix |
| `docs` | Documentation changes only |
| `refactor` | Code change that isn't a fix or feature and does not affect functionality |
| `chore` | Build process, dependency updates, tooling |
| `test` | Adding or updating tests |

**Scope** is optional but encouraged — use it to indicate the area of the codebase affected (e.g., `api`, `ui`, `maps`).

**Examples:**
```
feat(ui): add dark mode toggle to Command Center
fix(api): resolve container status not updating after restart
docs: update hardware requirements in README
chore(deps): bump docker-compose to v2.24
```

---

## Release Notes

Human-readable release notes live in [`admin/docs/release-notes.md`](admin/docs/release-notes.md) and are displayed directly in the Command Center UI.

When your changes include anything user-facing, **add a summary to the `## Unreleased` section** at the top of that file under the appropriate heading:

- **Features** — new user-facing capabilities
- **Bug Fixes** — corrections to existing behavior
- **Improvements** — enhancements, refactors, docs, or dependency updates

Use the format `- **Area**: Description` to stay consistent with existing entries.

**Example:**
```markdown
## Unreleased

### Features
- **Maps**: Added support for downloading South America regional maps

### Bug Fixes
- **AI Chat**: Fixed document upload failing on filenames with special characters
```

> When a release is triggered, CI automatically stamps the version and date, commits the update, and publishes the content to the GitHub release. You do not need to do this manually.

---

## Versioning

This project uses [Semantic Versioning](https://semver.org/). Versions are managed in the root `package.json` and updated automatically by `semantic-release`. The `nomad` Docker image uses this version. The `admin/package.json` version stays at `0.0.0` and should not be changed manually.

---

## Delivery

Pushing, releasing, and deploying are done by the maintainers and are not part of making a change. Open an issue first for anything that changes upstream-facing behavior (see [Before You Start](#before-you-start)).

---

## Feedback & Community

Have questions or want to discuss ideas before opening an issue? Join the community:

- **Source:** [Forgejo](https://git.ashwren.com/hermes/nomad) · [GitHub mirror](https://github.com/hermes-os/nomad)
- **Discord:** [Join the Crosstalk Solutions server](https://discord.com/invite/crosstalksolutions) — the best place to get help, share your builds, and talk with other Nomad users
- **Website:** [www.projectnomad.us](https://www.projectnomad.us)
- **Benchmark Leaderboard:** [benchmark.projectnomad.us](https://benchmark.projectnomad.us)

---

*Nomad is licensed under the [Apache License 2.0](LICENSE).*
