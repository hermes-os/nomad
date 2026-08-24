import { test } from '@japa/runner'
import type { Job } from 'bullmq'
import { CheckUpdateJob } from '#jobs/check_update_job'
import KVStore from '#models/kv_store'
import { SystemService } from '#services/system_service'

type VersionCheckResult = Awaited<ReturnType<SystemService['checkLatestVersion']>>

function stubVersionCheck(result: VersionCheckResult) {
  const original = SystemService.prototype.checkLatestVersion
  const forceArgs: (boolean | undefined)[] = []

  SystemService.prototype.checkLatestVersion = async function (force?: boolean) {
    forceArgs.push(force)
    return result
  }

  return {
    forceArgs,
    restore: () => {
      SystemService.prototype.checkLatestVersion = original
    },
  }
}

test.group('CheckUpdateJob', () => {
  test('forces a live version check instead of reading the cache it maintains', async ({
    assert,
  }) => {
    const stub = stubVersionCheck({
      success: true,
      updateAvailable: true,
      currentVersion: '1.29.0',
      latestVersion: '1.30.0',
    })

    try {
      await new CheckUpdateJob().handle({} as Job)
    } finally {
      stub.restore()
    }

    assert.deepEqual(stub.forceArgs, [true])
  })

  test('fails the job when the version check could not complete', async ({ assert }) => {
    const stub = stubVersionCheck({
      success: false,
      updateAvailable: false,
      currentVersion: '',
      latestVersion: '',
      message: 'Failed to check latest version: getaddrinfo ENOTFOUND api.github.com',
    })
    const originalSetValue = KVStore.setValue
    const writes: unknown[][] = []
    KVStore.setValue = async (...args: unknown[]) => {
      writes.push(args)
      return {} as KVStore
    }

    try {
      await assert.rejects(
        () => new CheckUpdateJob().handle({} as Job),
        'Failed to check latest version: getaddrinfo ENOTFOUND api.github.com'
      )
      assert.isEmpty(writes)
    } finally {
      stub.restore()
      KVStore.setValue = originalSetValue
    }
  })
})
