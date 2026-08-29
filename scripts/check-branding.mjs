import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repositoryRoot = resolve(import.meta.dirname, '..')
const allowlistPath = resolve(repositoryRoot, '.branding-allowlist.json')
const allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8'))
const acronym = ['N', 'O', 'M', 'A', 'D'].join('')
const compactName = ['project', 'nomad'].join('')
const patterns = [
  new RegExp(`Project\\s+(?:${acronym}|N\\.O\\.M\\.A\\.D\\.?|Nomad)`, 'gi'),
  new RegExp(['project', 'nomad'].join('[-_]'), 'gi'),
  new RegExp(`N\\.O\\.M\\.A\\.D\\.?`, 'gi'),
  new RegExp(`\\b${acronym}\\b`, 'g'),
  new RegExp(compactName, 'gi'),
]

const trackedOutput = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { cwd: repositoryRoot, encoding: 'utf8' }
)
const paths = trackedOutput.split('\0').filter(Boolean)
const violations = []

function isAllowed(path, line, start, end) {
  return allowlist.some((entry) => {
    if (entry.path !== '*' && entry.path !== path) {
      return false
    }

    let allowedStart = line.indexOf(entry.text)
    while (allowedStart !== -1) {
      const allowedEnd = allowedStart + entry.text.length
      const before = line[allowedStart - 1]
      const after = line[allowedEnd]
      const hasBoundaries =
        (!before || !/[A-Za-z0-9_.-]/.test(before)) &&
        (!after || !/[A-Za-z0-9_.-]/.test(after))
      if (hasBoundaries && allowedStart <= start && allowedEnd >= end) {
        return true
      }
      allowedStart = line.indexOf(entry.text, allowedStart + 1)
    }
    return false
  })
}

function hasUnapprovedBranding(path, line) {
  return patterns.some((pattern) =>
    [...line.matchAll(pattern)].some(
      (match) => !isAllowed(path, line, match.index, match.index + match[0].length)
    )
  )
}

for (const path of paths) {
  if (path === '.branding-allowlist.json' || !existsSync(resolve(repositoryRoot, path))) {
    continue
  }

  if (hasUnapprovedBranding(path, path)) {
    violations.push(`${path}: legacy branding in tracked path`)
  }

  const buffer = readFileSync(resolve(repositoryRoot, path))
  if (buffer.includes(0)) {
    continue
  }

  const lines = buffer.toString('utf8').split('\n')
  lines.forEach((line, index) => {
    if (hasUnapprovedBranding(path, line)) {
      violations.push(`${path}:${index + 1}:${line.trim()}`)
    }
  })
}

if (violations.length > 0) {
  process.stderr.write(`Legacy Nomad branding found:\n${violations.join('\n')}\n`)
  process.exit(1)
}

process.stdout.write('No unapproved legacy branding found.\n')
