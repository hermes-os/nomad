import { test } from '@japa/runner'
import { migrateLegacyNomadStoragePaths } from '../../database/migrations/1788048000000_migrate_nomad_storage_paths.js'

test('Nomad storage migration rewrites persisted legacy bind paths', async ({ assert }) => {
  const queries: { sql: string; bindings: string[] }[] = []
  const database = {
    rawQuery: async (sql: string, bindings: string[]) => {
      queries.push({ sql, bindings })
    },
  }

  await migrateLegacyNomadStoragePaths(database)

  assert.lengthOf(queries, 1)
  assert.include(queries[0].sql, 'REPLACE(`container_config`, ?, ?)')
  assert.deepEqual(queries[0].bindings, [
    '/opt/project-nomad/storage',
    '/opt/nomad/storage',
    '%/opt/project-nomad/storage%',
  ])
})
