import { test } from '@japa/runner'
import { ensureDirectoryExists } from '../../app/utils/fs.js'
import { mkdir, rmdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

test.group('ensureDirectoryExists', () => {
  test('creates directory when it does not exist', async ({ assert }) => {
    const baseDir = join(tmpdir(), `nomad-test-${Date.now()}`)
    const targetDir = join(baseDir, 'nested', 'path')

    await ensureDirectoryExists(targetDir)

    const info = await stat(targetDir)
    assert.isTrue(info.isDirectory())

    // cleanup
    await rmdir(join(baseDir, 'nested', 'path'))
    await rmdir(join(baseDir, 'nested'))
    await rmdir(baseDir)
  })

  test('does not throw when directory already exists', async ({ assert }) => {
    const baseDir = join(tmpdir(), `nomad-test-${Date.now()}`)
    await mkdir(baseDir, { recursive: true })

    await ensureDirectoryExists(baseDir)

    const info = await stat(baseDir)
    assert.isTrue(info.isDirectory())

    // cleanup
    await rmdir(baseDir)
  })

  test('rethrows non-ENOENT errors from stat', async ({ assert }) => {
    const veryLongPath = 'a'.repeat(10000)

    assert.rejects(async () => {
      await ensureDirectoryExists(veryLongPath)
    })
  })
})
