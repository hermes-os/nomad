import { BaseSchema } from '@adonisjs/lucid/schema'

interface RawQueryDatabase {
  rawQuery(sql: string, bindings: string[]): Promise<unknown>
}

export async function migrateLegacyNomadStoragePaths(database: RawQueryDatabase) {
  await database.rawQuery(
    'UPDATE `services` SET `container_config` = REPLACE(`container_config`, ?, ?) WHERE `container_config` LIKE ?',
    ['/opt/project-nomad/storage', '/opt/nomad/storage', '%/opt/project-nomad/storage%']
  )
}

export default class extends BaseSchema {
  async up() {
    await migrateLegacyNomadStoragePaths(this.db)
  }

  async down() {
    // The installer does not move persisted storage back to the legacy path during rollback.
  }
}
