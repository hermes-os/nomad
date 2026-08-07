import { test } from '@japa/runner'
import {
  ContainerRegistryService,
  ParsedImageReference,
} from '../../app/services/container_registry_service.js'

const IMAGE: ParsedImageReference = {
  registry: 'ghcr.io',
  namespace: 'kiwix',
  repo: 'kiwix-serve',
  tag: '3.7.0',
  fullName: 'kiwix/kiwix-serve',
}

function stubFetch(handler: (url: string) => Response) {
  const original = globalThis.fetch
  const requested: string[] = []

  globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
    const url = input.toString()
    // Mirror undici: fetch has no notion of a current origin, so a relative URL throws.
    if (!URL.canParse(url)) {
      throw new TypeError(`Failed to parse URL from ${url}`)
    }
    requested.push(url)
    return handler(url)
  }) as typeof fetch

  return {
    requested,
    restore: () => {
      globalThis.fetch = original
    },
  }
}

function tagsPage(tags: string[], nextLink?: string) {
  return new Response(JSON.stringify({ tags }), {
    status: 200,
    headers: nextLink ? { link: `<${nextLink}>; rel="next"` } : {},
  })
}

function tokenPage() {
  return new Response(JSON.stringify({ token: 'test-token' }), { status: 200 })
}

test.group('ContainerRegistryService.listTags', (group) => {
  let restore = () => {}
  group.each.teardown(() => restore())

  test('follows a path-relative rel="next" Link header across pages', async ({ assert }) => {
    const stub = stubFetch((url) => {
      if (url.includes('/token')) return tokenPage()
      if (url.includes('last=1.0.0')) return tagsPage(['2.0.0'])
      return tagsPage(['1.0.0'], '/v2/kiwix/kiwix-serve/tags/list?n=1000&last=1.0.0')
    })
    restore = stub.restore

    const tags = await new ContainerRegistryService().listTags(IMAGE)

    assert.deepEqual(tags, ['1.0.0', '2.0.0'])
    assert.include(
      stub.requested,
      'https://ghcr.io/v2/kiwix/kiwix-serve/tags/list?n=1000&last=1.0.0'
    )
  })

  test('follows an absolute rel="next" Link header across pages', async ({ assert }) => {
    const stub = stubFetch((url) => {
      if (url.includes('/token')) return tokenPage()
      if (url.includes('last=1.0.0')) return tagsPage(['2.0.0'])
      return tagsPage(['1.0.0'], 'https://ghcr.io/v2/kiwix/kiwix-serve/tags/list?n=1000&last=1.0.0')
    })
    restore = stub.restore

    const tags = await new ContainerRegistryService().listTags(IMAGE)

    assert.deepEqual(tags, ['1.0.0', '2.0.0'])
  })

  test('stops after one request when no Link header is returned', async ({ assert }) => {
    const stub = stubFetch((url) => {
      if (url.includes('/token')) return tokenPage()
      return tagsPage(['1.0.0'])
    })
    restore = stub.restore

    const tags = await new ContainerRegistryService().listTags(IMAGE)

    assert.deepEqual(tags, ['1.0.0'])
    assert.lengthOf(
      stub.requested.filter((url) => url.includes('/tags/list')),
      1
    )
  })
})
