import { test } from '@japa/runner'
import SettingsController from '#controllers/settings_controller'
import KVStore from '#models/kv_store'
import { getSettingSchema } from '../../app/validators/settings.js'
import { SETTINGS_KEYS } from '../../constants/kv_store.js'
import { KV_STORE_SCHEMA } from '../../types/kv_store.js'
import type { HttpContext } from '@adonisjs/core/http'

function makeController() {
  return new SettingsController({} as any, {} as any, {} as any, {} as any)
}

function makeCtx(queryKey: unknown) {
  let statusCode: number | undefined
  let body: unknown
  const ctx = {
    request: {
      qs: () => ({ key: queryKey }),
      validateUsing: (schema: typeof getSettingSchema) => schema.validate({ key: queryKey }),
    },
    response: {
      status: (code: number) => ({
        send: (payload: unknown) => {
          statusCode = code
          body = payload
          return payload
        },
      }),
    },
  } as unknown as HttpContext
  return { ctx, getStatus: () => statusCode, getBody: () => body }
}

test.group('SettingsController.getSetting validation', () => {
  test('rejects an unknown settings key at the request boundary', async ({ assert }) => {
    await assert.rejects(() => getSettingSchema.validate({ key: 'does.not.exist' }))
  })

  test('getSettingSchema accepts configured keys and rejects non-settings KV store keys', async ({ assert }) => {
    const nonSettingsKeys = Object.keys(KV_STORE_SCHEMA).filter(
      (key) => !SETTINGS_KEYS.some((allowed) => allowed === key)
    )
    assert.isAbove(nonSettingsKeys.length, 0, 'expected KV_STORE_SCHEMA to contain keys deliberately absent from SETTINGS_KEYS')
    for (const key of nonSettingsKeys) {
      await assert.rejects(() => getSettingSchema.validate({ key }))
    }
    for (const key of SETTINGS_KEYS) {
      const payload = await getSettingSchema.validate({ key })
      assert.equal(payload.key, key)
    }
  })

  test('getSetting rejects an unknown key instead of hitting the store', async ({ assert }) => {
    const controller = makeController()
    const { ctx } = makeCtx('does.not.exist')

    let storeCalls = 0
    let error: unknown = undefined
    const original = KVStore.getValue
    KVStore.getValue = (async () => {
      storeCalls += 1
      return null
    }) as typeof KVStore.getValue
    try {
      await controller.getSetting(ctx)
    } catch (caught) {
      error = caught
    } finally {
      KVStore.getValue = original
    }
    assert.isDefined(error, 'expected getSetting to reject for an unknown key')
    assert.equal((error as { code?: unknown }).code, 'E_VALIDATION_ERROR')
    assert.equal(storeCalls, 0)
  })

  test('getSetting returns the stored value for a known key', async ({ assert }) => {
    const controller = makeController()
    const { ctx, getStatus, getBody } = makeCtx(SETTINGS_KEYS[0])

    const original = KVStore.getValue
    KVStore.getValue = (async () => 'stored') as unknown as typeof KVStore.getValue
    try {
      await controller.getSetting(ctx)
    } finally {
      KVStore.getValue = original
    }
    assert.equal(getStatus(), 200)
    assert.deepEqual(getBody(), { key: SETTINGS_KEYS[0], value: 'stored' })
  })
})
