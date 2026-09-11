import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

const repositoryRoot = resolve(import.meta.dirname, '..')

function sourceableScript(relativePath, marker) {
  const source = readFileSync(join(repositoryRoot, relativePath), 'utf8')
  const markerIndex = source.indexOf(marker)
  assert.notEqual(markerIndex, -1, `${relativePath} must contain ${marker}`)

  const fixtureDirectory = mkdtempSync(join(tmpdir(), 'nomad-script-'))
  const fixturePath = join(fixtureDirectory, 'script-under-test.sh')
  writeFileSync(fixturePath, source.slice(0, markerIndex))
  return fixturePath
}

test('installer migrates the legacy installation directory without losing data', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'nomad-install-'))
  const legacyDirectory = join(fixtureRoot, 'project-nomad')
  const nomadDirectory = join(fixtureRoot, 'nomad')
  mkdirSync(join(legacyDirectory, 'storage'), { recursive: true })
  mkdirSync(join(legacyDirectory, 'sidecar-updater'), { recursive: true })
  writeFileSync(join(legacyDirectory, 'storage', 'library.db'), 'preserve me')
  writeFileSync(join(legacyDirectory, 'compose.yml'), 'services: {}\n')
  writeFileSync(
    join(legacyDirectory, 'sidecar-updater', 'update-watcher.sh'),
    [
      'COMPOSE_FILE="/opt/project-nomad/compose.yml"',
      'COMPOSE_PROJECT_NAME="project-nomad"',
      'image="ghcr.io/crosstalk-solutions/project-nomad:latest"',
      '',
    ].join('\n')
  )

  const script = sourceableScript('install/install_nomad.sh', 'Main Script')
  const result = spawnSync(
    'bash',
    [
      '-c',
      'source "$1"; NOMAD_DIR="$2"; LEGACY_NOMAD_DIR="$3"; docker() { return 0; }; migrate_legacy_installation',
      'bash',
      script,
      nomadDirectory,
      legacyDirectory,
    ],
    { encoding: 'utf8' }
  )

  assert.equal(result.status, 0, result.stderr)
  assert.equal(readFileSync(join(nomadDirectory, 'storage', 'library.db'), 'utf8'), 'preserve me')
  assert.equal(lstatSync(legacyDirectory).isSymbolicLink(), true)
  assert.equal(readlinkSync(legacyDirectory), nomadDirectory)
  const watcher = readFileSync(
    join(nomadDirectory, 'sidecar-updater', 'update-watcher.sh'),
    'utf8'
  )
  assert.match(watcher, /COMPOSE_FILE="\/opt\/nomad\/compose\.yml"/)
  assert.match(watcher, /COMPOSE_PROJECT_NAME="nomad"/)
  assert.match(watcher, /ghcr\.io\/hermes-os\/nomad:latest/)
})

test('installer reconnects existing application containers to the renamed network', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'nomad-network-'))
  const callsPath = join(fixtureRoot, 'docker-calls')
  const script = sourceableScript('install/install_nomad.sh', 'Main Script')
  const result = spawnSync(
    'bash',
    [
      '-c',
      [
        'source "$1"',
        'CALLS_PATH="$2"',
        'LEGACY_MIGRATION_PERFORMED=true',
        'docker() {',
        '  printf "%s\\n" "$*" >> "$CALLS_PATH"',
        '  if [[ "$1 $2" == "ps -a" ]]; then printf "nomad_kiwix\\n"; fi',
        '  if [[ "$1" == "inspect" ]]; then printf "nomad_default\\n"; printf "project-nomad_default\\n"; fi',
        '  return 0',
        '}',
        'migrate_legacy_container_networks',
      ].join('\n'),
      'bash',
      script,
      callsPath,
    ],
    { encoding: 'utf8' }
  )

  assert.equal(result.status, 0, result.stderr)
  const calls = readFileSync(callsPath, 'utf8')
  assert.match(calls, /^network connect nomad_default nomad_kiwix$/m)
  assert.match(calls, /^network disconnect project-nomad_default nomad_kiwix$/m)
  assert.match(calls, /^network rm project-nomad_default$/m)
  assert.ok(
    calls.indexOf('network connect nomad_default nomad_kiwix') <
      calls.indexOf('network disconnect project-nomad_default nomad_kiwix')
  )
})

test('installer fails safely when the replacement network connection is unavailable', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'nomad-network-failure-'))
  const callsPath = join(fixtureRoot, 'docker-calls')
  const script = sourceableScript('install/install_nomad.sh', 'Main Script')
  const result = spawnSync(
    'bash',
    [
      '-c',
      [
        'source "$1"',
        'CALLS_PATH="$2"',
        'LEGACY_MIGRATION_PERFORMED=true',
        'docker() {',
        '  printf "%s\\n" "$*" >> "$CALLS_PATH"',
        '  if [[ "$1 $2" == "ps -a" ]]; then printf "nomad_kiwix\\n"; fi',
        '  if [[ "$1" == "inspect" ]]; then printf "project-nomad_default\\n"; fi',
        '  if [[ "$1 $2" == "network connect" ]]; then return 1; fi',
        '  return 0',
        '}',
        'migrate_legacy_container_networks',
      ].join('\n'),
      'bash',
      script,
      callsPath,
    ],
    { encoding: 'utf8' }
  )

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Failed to connect nomad_kiwix to nomad_default/)
  const calls = readFileSync(callsPath, 'utf8')
  assert.doesNotMatch(calls, /^network disconnect project-nomad_default nomad_kiwix$/m)
  assert.doesNotMatch(calls, /^network rm project-nomad_default$/m)
})

test('update migration rewrites owned identifiers and preserves generated credentials', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'nomad-compose-'))
  const composePath = join(fixtureRoot, 'compose.yml')
  writeFileSync(
    composePath,
    [
      'name: project-nomad',
      'COMPOSE_PROJECT_NAME="project-nomad"',
      'services:',
      '  admin:',
      '    image: ghcr.io/crosstalk-solutions/project-nomad:v1.29.0',
      '    volumes:',
      '      - /opt/project-nomad/storage:/app/storage',
      '    environment:',
      '      - APP_KEY=a-generated-key',
      '      - DB_PASSWORD=a-generated-password',
      '',
    ].join('\n')
  )

  const script = sourceableScript('install/update_nomad.sh', 'Main Script')
  const result = spawnSync(
    'bash',
    ['-c', 'source "$1"; migrate_legacy_compose_file "$2"', 'bash', script, composePath],
    { encoding: 'utf8' }
  )

  assert.equal(result.status, 0, result.stderr)
  const migrated = readFileSync(composePath, 'utf8')
  assert.match(migrated, /^name: nomad$/m)
  assert.match(migrated, /^COMPOSE_PROJECT_NAME="nomad"$/m)
  assert.match(migrated, /ghcr\.io\/hermes-os\/nomad:v1\.29\.0/)
  assert.match(migrated, /\/opt\/nomad\/storage:\/app\/storage/)
  assert.match(migrated, /APP_KEY=a-generated-key/)
  assert.match(migrated, /DB_PASSWORD=a-generated-password/)
})

test('update migration closes the dozzle shell flag and ignores near-miss shapes', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'nomad-dozzle-'))
  const composePath = join(fixtureRoot, 'compose.yml')
  writeFileSync(
    composePath,
    [
      '    environment:',
      '      - DOZZLE_ENABLE_ACTIONS=true',
      '      - DOZZLE_ENABLE_SHELL=true  # Enables web-based shell access',
      '      - MY_DOZZLE_ENABLE_SHELL=true',
      '      - DOZZLE_ENABLE_SHELL=truey',
      '#      - DOZZLE_ENABLE_SHELL=true',
      '',
    ].join('\n')
  )

  const script = sourceableScript('install/update_nomad.sh', 'Main Script')
  const result = spawnSync(
    'bash',
    ['-c', 'source "$1"; migrate_legacy_compose_file "$2"', 'bash', script, composePath],
    { encoding: 'utf8' }
  )

  assert.equal(result.status, 0, result.stderr)
  const migrated = readFileSync(composePath, 'utf8')
  assert.match(migrated, /^[ ]*- DOZZLE_ENABLE_SHELL=false  # Enables web-based shell access$/m)
  assert.match(migrated, /MY_DOZZLE_ENABLE_SHELL=true/)
  assert.match(migrated, /DOZZLE_ENABLE_SHELL=truey/)
  assert.match(migrated, /^#      - DOZZLE_ENABLE_SHELL=true$/m)
  assert.match(migrated, /DOZZLE_ENABLE_ACTIONS=true/)
})

test('update watcher migrates the dozzle shell flag before recreating services', () => {
  const watcher = readFileSync(
    join(repositoryRoot, 'install/sidecar-updater/update-watcher.sh'),
    'utf8'
  )
  // Guard the call graph, not file positions: extract the perform_update
  // body (opener `perform_update() {` through the first column-0 `}`) and
  // require the bare migration call to appear INSIDE it, before that same
  // body's real `docker compose` pull and recreate invocations. A bare
  // call parked in dead code elsewhere in the file (or after the pull)
  // must fail this test. Comment lines are skipped on the raw line, and
  // the anchors require the real `docker compose` invocation, so a comment
  // merely mentioning "compose ... pull" cannot stand in for it. The match
  // is a bare invocation only: the () definition, comments, and lines with
  // trailing text never count.
  const bodyStart = watcher.indexOf('perform_update() {')
  assert.notEqual(bodyStart, -1, 'watcher must define perform_update')
  const bodyAfterOpener = watcher.slice(bodyStart).split('\n')
  const bodyEndOffset = bodyAfterOpener.findIndex((line) => /^}$/.test(line))
  assert.notEqual(bodyEndOffset, -1, 'perform_update body must terminate')
  const body = bodyAfterOpener.slice(0, bodyEndOffset + 1)
  const migrationCall = body.findIndex((line) =>
    /^[ \t]*migrate_dozzle_shell_setting[ \t]*$/.test(line)
  )
  const codeLines = body.filter((line) => !/^[ \t]*(#|$)/.test(line))
  const pullLine = codeLines.findIndex((line) =>
    /docker compose.*pull/.test(line)
  )
  const recreateLine = codeLines.findIndex((line) =>
    /up -d --no-deps/.test(line)
  )
  assert.notEqual(
    migrationCall,
    -1,
    'perform_update must call migrate_dozzle_shell_setting'
  )
  assert.notEqual(pullLine, -1)
  assert.notEqual(recreateLine, -1)
  const migrationCodePos = body
    .slice(0, migrationCall)
    .filter((line) => !/^[ \t]*(#|$)/.test(line)).length
  assert.ok(
    migrationCodePos < pullLine,
    'migration must precede the image pull inside perform_update'
  )
  assert.ok(
    migrationCodePos < recreateLine,
    'migration must precede the per-service recreate inside perform_update'
  )

  const fixtureRoot = mkdtempSync(join(tmpdir(), 'nomad-watcher-'))
  const composePath = join(fixtureRoot, 'compose.yml')
  const logPath = join(fixtureRoot, 'update-log')
  writeFileSync(
    composePath,
    [
      '    environment:',
      '      - DOZZLE_ENABLE_ACTIONS=true',
      '      - DOZZLE_ENABLE_SHELL=true  # Enables web-based shell access',
      '',
    ].join('\n')
  )

  const script = sourceableScript(
    'install/sidecar-updater/update-watcher.sh',
    '# Main watch loop'
  )
  const result = spawnSync(
    'bash',
    [
      '-c',
      'source "$1"; COMPOSE_FILE="$2"; LOG_FILE="$3"; migrate_dozzle_shell_setting',
      'bash',
      script,
      composePath,
      logPath,
    ],
    { encoding: 'utf8' }
  )

  assert.equal(result.status, 0, result.stderr)
  const migrated = readFileSync(composePath, 'utf8')
  assert.match(migrated, /DOZZLE_ENABLE_SHELL=false/)
  assert.doesNotMatch(migrated, /DOZZLE_ENABLE_SHELL=true/)
})

test('uninstaller can target an installation created before the rename', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'nomad-uninstall-'))
  const legacyDirectory = join(fixtureRoot, 'project-nomad')
  const nomadDirectory = join(fixtureRoot, 'nomad')
  mkdirSync(legacyDirectory)
  writeFileSync(join(legacyDirectory, 'compose.yml'), 'services: {}\n')

  const script = sourceableScript('install/uninstall_nomad.sh', 'Main')
  const result = spawnSync(
    'bash',
    [
      '-c',
      [
        'NOMAD_DIR="$2"',
        'LEGACY_NOMAD_DIR="$3"',
        'source "$1"',
        'select_installation_directory',
        'printf "%s\\n%s\\n" "$NOMAD_DIR" "$COMPOSE_PROJECT_NAME"',
      ].join('\n'),
      'bash',
      script,
      nomadDirectory,
      legacyDirectory,
    ],
    { encoding: 'utf8' }
  )

  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout, `${legacyDirectory}\n${['project', 'nomad'].join('-')}\n`)
})

test('uninstaller removes only the legacy compatibility link for a migrated installation', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'nomad-uninstall-link-'))
  const legacyDirectory = join(fixtureRoot, 'project-nomad')
  const nomadDirectory = join(fixtureRoot, 'nomad')
  mkdirSync(nomadDirectory)
  symlinkSync(nomadDirectory, legacyDirectory)

  const script = sourceableScript('install/uninstall_nomad.sh', 'Main')
  const result = spawnSync(
    'bash',
    [
      '-c',
      'NOMAD_DIR="$2"; LEGACY_NOMAD_DIR="$3"; source "$1"; remove_legacy_storage_compatibility_link',
      'bash',
      script,
      nomadDirectory,
      legacyDirectory,
    ],
    { encoding: 'utf8' }
  )

  assert.equal(result.status, 0, result.stderr)
  assert.equal(existsSync(legacyDirectory), false)
  assert.equal(existsSync(nomadDirectory), true)
})

test('installer refreshes compose configuration without rotating existing credentials', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'nomad-credentials-'))
  const composePath = join(fixtureRoot, 'compose.yml')
  const templatePath = join(fixtureRoot, 'management_compose.yaml')
  writeFileSync(
    composePath,
    [
      'services:',
      '  admin:',
      '    environment:',
      '      - URL=http://192.0.2.10:8080',
      '      - APP_KEY=existing-app-key',
      '      - DB_PASSWORD=existing-db-password',
      '  mysql:',
      '    environment:',
      '      - MYSQL_ROOT_PASSWORD=existing-root-password',
      '      - MYSQL_PASSWORD=existing-db-password',
      '',
    ].join('\n')
  )
  writeFileSync(
    templatePath,
    [
      'services:',
      '  admin:',
      '    environment:',
      '      - URL=replaceme',
      '      - APP_KEY=replaceme',
      '      - DB_PASSWORD=replaceme',
      '  mysql:',
      '    environment:',
      '      - MYSQL_ROOT_PASSWORD=replaceme',
      '      - MYSQL_PASSWORD=replaceme',
      '',
    ].join('\n')
  )

  const script = sourceableScript('install/install_nomad.sh', 'Main Script')
  const result = spawnSync(
    'bash',
    [
      '-c',
      [
        'source "$1"',
        'NOMAD_DIR="$2"',
        'TEMPLATE="$3"',
        'local_ip_address="198.51.100.20"',
        'curl() { cp "$TEMPLATE" "$4"; }',
        'generateRandomPass() { printf "new-random-value"; }',
        'download_management_compose_file',
      ].join('; '),
      'bash',
      script,
      fixtureRoot,
      templatePath,
    ],
    { encoding: 'utf8' }
  )

  assert.equal(result.status, 0, result.stderr)
  const refreshed = readFileSync(composePath, 'utf8')
  assert.match(refreshed, /URL=http:\/\/192\.0\.2\.10:8080/)
  assert.match(refreshed, /APP_KEY=existing-app-key/)
  assert.match(refreshed, /DB_PASSWORD=existing-db-password/)
  assert.match(refreshed, /MYSQL_ROOT_PASSWORD=existing-root-password/)
  assert.match(refreshed, /MYSQL_PASSWORD=existing-db-password/)
})

test('installer keeps the credential-bearing compose file when refresh download fails', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'nomad-compose-download-'))
  const composePath = join(fixtureRoot, 'compose.yml')
  const existingCompose = [
    'services:',
    '  admin:',
    '    environment:',
    '      - APP_KEY=existing-app-key',
    '      - DB_PASSWORD=existing-db-password',
    '',
  ].join('\n')
  writeFileSync(composePath, existingCompose)

  const script = sourceableScript('install/install_nomad.sh', 'Main Script')
  const result = spawnSync(
    'bash',
    [
      '-c',
      [
        'source "$1"',
        'NOMAD_DIR="$2"',
        'curl() { printf "services:\\n" > "$4"; return 1; }',
        'download_management_compose_file',
      ].join('; '),
      'bash',
      script,
      fixtureRoot,
    ],
    { encoding: 'utf8' }
  )

  assert.notEqual(result.status, 0)
  assert.equal(readFileSync(composePath, 'utf8'), existingCompose)
})

test('repository-owned deployment identifiers use nomad', () => {
  const compose = readFileSync(join(repositoryRoot, 'install/management_compose.yaml'), 'utf8')
  const dockerService = readFileSync(
    join(repositoryRoot, 'admin/app/services/docker_service.ts'),
    'utf8'
  )
  const updateScript = readFileSync(join(repositoryRoot, 'install/update_nomad.sh'), 'utf8')
  const rootPackage = JSON.parse(readFileSync(join(repositoryRoot, 'package.json'), 'utf8'))
  const adminPackage = JSON.parse(readFileSync(join(repositoryRoot, 'admin/package.json'), 'utf8'))

  assert.match(compose, /^name: nomad$/m)
  assert.match(compose, /image: ghcr\.io\/hermes-os\/nomad:latest/)
  assert.match(compose, /\/opt\/nomad\/storage:\/app\/storage/)
  assert.match(dockerService, /NOMAD_NETWORK = 'nomad_default'/)
  assert.match(updateScript, /up -d --force-recreate --build/)
  assert.equal(rootPackage.name, 'nomad')
  assert.equal(adminPackage.name, 'nomad-admin')
})

test('tracked tree passes the legacy-branding residue check', () => {
  execFileSync('node', ['scripts/check-branding.mjs'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: 'pipe',
  })
})

test('legacy-branding residue check rejects a newly introduced spelling', () => {
  const fixtureDirectory = mkdtempSync(join(repositoryRoot, '.branding-fixture-'))
  const fixturePath = join(fixtureDirectory, 'copy.md')
  writeFileSync(fixturePath, `Welcome to Project ${['N', 'O', 'M', 'A', 'D'].join('.')}.
`)

  try {
    const result = spawnSync('node', ['scripts/check-branding.mjs'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /\.branding-fixture-[^/]+\/copy\.md:1/)
  } finally {
    rmSync(fixtureDirectory, { recursive: true })
  }
})

test('legacy-branding residue check rejects an obsolete spelling beside an allowed URL', () => {
  const fixtureDirectory = mkdtempSync(join(repositoryRoot, '.branding-fixture-'))
  const fixturePath = join(fixtureDirectory, 'copy.md')
  writeFileSync(
    fixturePath,
    `Project ${['N', 'O', 'M', 'A', 'D'].join('.')} website: https://projectnomad.us\n`
  )

  try {
    const result = spawnSync('node', ['scripts/check-branding.mjs'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /\.branding-fixture-[^/]+\/copy\.md:1/)
  } finally {
    rmSync(fixtureDirectory, { recursive: true })
  }
})

test('legacy-branding residue check rejects suffix extensions of external exceptions', () => {
  const fixtureDirectory = mkdtempSync(join(repositoryRoot, '.branding-fixture-'))
  const fixturePath = join(fixtureDirectory, 'copy.md')
  const compactLegacyName = ['project', 'nomad'].join('')
  const legacyMapsRepository = ['project', 'nomad', 'maps'].join('-')
  writeFileSync(
    fixturePath,
    [
      `https://${compactLegacyName}.useless`,
      `https://github.com/Crosstalk-Solutions/${legacyMapsRepository}-backup`,
      '',
    ].join('\n')
  )

  try {
    const result = spawnSync('node', ['scripts/check-branding.mjs'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /\.branding-fixture-[^/]+\/copy\.md:1/)
    assert.match(result.stderr, /\.branding-fixture-[^/]+\/copy\.md:2/)
  } finally {
    rmSync(fixtureDirectory, { recursive: true })
  }
})
