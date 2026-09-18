import { test } from '@japa/runner'
import SettingsController from '#controllers/settings_controller'
import KVStore from '#models/kv_store'
import { errors } from '@vinejs/vine'
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
    let error: unknown
    try {
      await getSettingSchema.validate({ key: 'does.not.exist' })
    } catch (caught) {
      error = caught
    }
    assert.isDefined(error, 'expected getSettingSchema to reject an unknown key')
    assert.instanceOf(error, errors.E_VALIDATION_ERROR)
    assert.propertyVal(error, 'code', 'E_VALIDATION_ERROR')
  })

  test('getSettingSchema accepts configured keys and rejects non-settings KV store keys', async ({
    assert,
  }) => {
    const nonSettingsKeys = Object.keys(KV_STORE_SCHEMA).filter(
      (key) => !SETTINGS_KEYS.some((allowed) => allowed === key)
    )
    assert.isAbove(
      nonSettingsKeys.length,
      0,
      'expected KV_STORE_SCHEMA to contain keys deliberately absent from SETTINGS_KEYS'
    )
    for (const key of nonSettingsKeys) {
      let error: unknown
      try {
        await getSettingSchema.validate({ key })
      } catch (caught) {
        error = caught
      }
      assert.isDefined(error, `expected getSettingSchema to reject non-settings key: ${key}`)
      assert.instanceOf(error, errors.E_VALIDATION_ERROR)
      assert.propertyVal(error, 'code', 'E_VALIDATION_ERROR')
    }
    assert.isAbove(
      SETTINGS_KEYS.length,
      0,
      'expected SETTINGS_KEYS to contain at least one configured key'
    )
    assert.sameMembers(
      [...SETTINGS_KEYS],
      [
        'chat.suggestionsEnabled',
        'chat.lastModel',
        'ui.hasVisitedEasySetup',
        'system.earlyAccess',
        'ai.assistantCustomName',
      ]
    )
    for (const key of SETTINGS_KEYS) {
      const payload = await getSettingSchema.validate({ key })
      assert.equal(payload.key, key)
    }
  })

  test('getSetting rejects an unknown key instead of hitting the store', async ({
    assert,
    cleanup,
  }) => {
    const controller = makeController()
    const { ctx } = makeCtx('does.not.exist')

    let storeCalls = 0
    let error: unknown
    const original = KVStore.getValue
    cleanup(() => {
      KVStore.getValue = original
    })
    KVStore.getValue = (async () => {
      storeCalls += 1
      return null
    }) as typeof KVStore.getValue
    try {
      await controller.getSetting(ctx)
    } catch (caught) {
      error = caught
    }
    assert.isDefined(error, 'expected getSetting to reject for an unknown key')
    assert.instanceOf(error, errors.E_VALIDATION_ERROR)
    assert.equal((error as { code?: unknown }).code, 'E_VALIDATION_ERROR')
    assert.equal(storeCalls, 0)
  })

  test('getSetting returns the stored value for a known key', async ({ assert, cleanup }) => {
    const controller = makeController()
    const { ctx, getStatus, getBody } = makeCtx(SETTINGS_KEYS[0])

    const original = KVStore.getValue
    cleanup(() => {
      KVStore.getValue = original
    })
    KVStore.getValue = (async () => 'stored') as unknown as typeof KVStore.getValue
    await controller.getSetting(ctx)
    assert.equal(getStatus(), 200)
    assert.deepEqual(getBody(), { key: SETTINGS_KEYS[0], value: 'stored' })
  })
})
