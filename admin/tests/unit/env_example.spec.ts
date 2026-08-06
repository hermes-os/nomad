import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const currentFilePath = fileURLToPath(import.meta.url)
const currentDirPath = dirname(currentFilePath)

function parseEnv(content: string): Map<string, string> {
  const vars = new Map<string, string>()
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }
    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex === -1) {
      continue
    }
    const key = trimmed.slice(0, separatorIndex).trim()
    const value = trimmed.slice(separatorIndex + 1).trim()
    vars.set(key, value)
  }
  return vars
}

test.group('Env example', () => {
  test('.env.example defines APP_KEY with at least 16 characters', ({ assert }) => {
    const envPath = join(currentDirPath, '..', '..', '.env.example')
    const content = readFileSync(envPath, 'utf-8')
    const vars = parseEnv(content)

    assert.isTrue(vars.has('APP_KEY'), 'APP_KEY must be defined')
    const appKey = vars.get('APP_KEY')!
    assert.isAtLeast(appKey.length, 16, 'APP_KEY must be at least 16 characters long')
  })

  test('.env.example defines all required environment variables', ({ assert }) => {
    const envPath = join(currentDirPath, '..', '..', '.env.example')
    const content = readFileSync(envPath, 'utf-8')
    const vars = parseEnv(content)

    const required = [
      'NODE_ENV',
      'PORT',
      'APP_KEY',
      'HOST',
      'URL',
      'LOG_LEVEL',
      'DB_HOST',
      'DB_PORT',
      'DB_USER',
      'DB_DATABASE',
      'REDIS_HOST',
      'REDIS_PORT',
    ]

    for (const key of required) {
      assert.isTrue(vars.has(key), `${key} must be defined in .env.example`)
    }
  })
})
