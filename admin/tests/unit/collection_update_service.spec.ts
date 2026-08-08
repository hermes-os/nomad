import { test } from '@japa/runner'
import { CollectionUpdateService } from '#services/collection_update_service'
import { RunDownloadJob } from '#jobs/run_download_job'
import { join } from 'node:path'
import type { Job } from 'bullmq'
import type { RunDownloadJobParams } from '../../types/downloads.js'
import type { ResourceUpdateInfo } from '../../types/collections.js'

/**
 * The download queue is a Redis-backed boundary; stub it so these tests observe
 * what would be written to disk without needing a broker.
 */
function stubDownloadQueue() {
  const originalGetByUrl = RunDownloadJob.getByUrl
  const originalDispatch = RunDownloadJob.dispatch
  const dispatched: RunDownloadJobParams[] = []

  RunDownloadJob.getByUrl = async () => undefined
  RunDownloadJob.dispatch = async (params: RunDownloadJobParams) => {
    dispatched.push(params)
    return {
      job: { id: 'stub-job' } as unknown as Job,
      created: true as const,
      message: 'stubbed',
    }
  }

  return {
    dispatched,
    restore() {
      RunDownloadJob.getByUrl = originalGetByUrl
      RunDownloadJob.dispatch = originalDispatch
    },
  }
}

function makeUpdate(overrides: Partial<ResourceUpdateInfo> = {}): ResourceUpdateInfo {
  return {
    resource_id: 'wikipedia_en_all_maxi',
    resource_type: 'zim',
    installed_version: '2025-05',
    latest_version: '2025-06',
    download_url: 'https://download.example.com/wikipedia_en_all_maxi_2025-06.zim',
    ...overrides,
  }
}

test.group('CollectionUpdateService.applyUpdate', (group) => {
  let queue: ReturnType<typeof stubDownloadQueue>

  group.each.setup(() => {
    queue = stubDownloadQueue()
    return () => queue.restore()
  })

  test('downloads a zim update into the zim storage directory', async ({ assert }) => {
    const result = await new CollectionUpdateService().applyUpdate(makeUpdate())

    assert.isTrue(result.success)
    assert.lengthOf(queue.dispatched, 1)
    assert.equal(
      queue.dispatched[0].filepath,
      join(process.cwd(), '/storage/zim', 'wikipedia_en_all_maxi_2025-06.zim')
    )
  })

  test('downloads a map update into the pmtiles storage directory', async ({ assert }) => {
    const result = await new CollectionUpdateService().applyUpdate(
      makeUpdate({ resource_id: 'north-america', resource_type: 'map' })
    )

    assert.isTrue(result.success)
    assert.equal(
      queue.dispatched[0].filepath,
      join(process.cwd(), '/storage/maps', 'pmtiles', 'north-america_2025-06.pmtiles')
    )
  })

  test('rejects a resource id that escapes the storage directory', async ({ assert }) => {
    const result = await new CollectionUpdateService().applyUpdate(
      makeUpdate({ resource_id: '../../../../tmp/nomad-escape' })
    )

    assert.isFalse(result.success)
    assert.match(result.error!, /Invalid resource id or version/)
    assert.isEmpty(queue.dispatched)
  })

  test('rejects a version that escapes the storage directory', async ({ assert }) => {
    const result = await new CollectionUpdateService().applyUpdate(
      makeUpdate({ resource_type: 'map', latest_version: '../../../../tmp/nomad-escape' })
    )

    assert.isFalse(result.success)
    assert.match(result.error!, /Invalid resource id or version/)
    assert.isEmpty(queue.dispatched)
  })

  test('rejects a resource id that resolves to a subdirectory of storage', async ({ assert }) => {
    const result = await new CollectionUpdateService().applyUpdate(
      makeUpdate({ resource_id: 'wikipedia/en_all_maxi' })
    )

    assert.isFalse(result.success)
    assert.match(result.error!, /Invalid resource id or version/)
    assert.isEmpty(queue.dispatched)
  })

  test('rejects a version that resolves to a subdirectory of storage', async ({ assert }) => {
    const result = await new CollectionUpdateService().applyUpdate(
      makeUpdate({ resource_type: 'map', latest_version: '2025/06' })
    )

    assert.isFalse(result.success)
    assert.match(result.error!, /Invalid resource id or version/)
    assert.isEmpty(queue.dispatched)
  })
})

test.group('CollectionUpdateService.applyAllUpdates', (group) => {
  let queue: ReturnType<typeof stubDownloadQueue>

  group.each.setup(() => {
    queue = stubDownloadQueue()
    return () => queue.restore()
  })

  test('rejects only the escaping update and still applies the valid one', async ({ assert }) => {
    const { results } = await new CollectionUpdateService().applyAllUpdates([
      makeUpdate({ resource_id: '../../../../tmp/nomad-escape' }),
      makeUpdate(),
    ])

    assert.lengthOf(results, 2)
    assert.isFalse(results[0].success)
    assert.isTrue(results[1].success)
    assert.lengthOf(queue.dispatched, 1)
  })
})
