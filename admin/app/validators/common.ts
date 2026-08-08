import vine from '@vinejs/vine'

/**
 * Checks whether a URL points to a loopback or link-local address.
 * Used to prevent SSRF — the server should not fetch from localhost
 * or link-local/metadata endpoints (e.g. cloud instance metadata at 169.254.x.x).
 *
 * RFC1918 private ranges (10.x, 172.16-31.x, 192.168.x) are intentionally
 * ALLOWED because NOMAD is a LAN appliance and users may host content
 * mirrors on their local network.
 *
 * Throws an error if the URL is a loopback or link-local address.
 */
export function assertNotPrivateUrl(urlString: string): void {
  const parsed = new URL(urlString)
  const hostname = parsed.hostname.toLowerCase()

  const blockedPatterns = [
    /^localhost$/,
    /^127\.\d+\.\d+\.\d+$/,
    /^0\.0\.0\.0$/,
    /^\[::\]$/, // IPv6 unspecified address, reaches loopback like 0.0.0.0
    /^169\.254\.\d+\.\d+$/, // Link-local / cloud metadata
    /^\[::1\]$/,
    /^\[?fe80:/i, // IPv6 link-local
  ]

  const candidate = unwrapIpv4MappedHost(hostname)

  if (blockedPatterns.some((re) => re.test(candidate))) {
    throw new Error(`Download URL must not point to a loopback or link-local address: ${hostname}`)
  }
}

/**
 * IPv4-mapped IPv6 hosts (`::ffff:a.b.c.d`) reach the embedded IPv4 address through
 * the socket layer, and the URL parser normalizes them to hex groups
 * (`[::ffff:7f00:1]`), so the dotted-quad rules above never match. Rewrite them back
 * to dotted-quad form; leave every other hostname untouched.
 */
function unwrapIpv4MappedHost(hostname: string): string {
  const match = hostname.match(/^\[::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})\]$/)
  if (!match) return hostname

  const high = Number.parseInt(match[1], 16)
  const low = Number.parseInt(match[2], 16)
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.')
}

export const remoteDownloadValidator = vine.compile(
  vine.object({
    url: vine
      .string()
      .url({ require_tld: false }) // Allow LAN URLs (e.g. http://my-nas:8080/file.zim)
      .trim(),
  })
)

export const remoteDownloadWithMetadataValidator = vine.compile(
  vine.object({
    url: vine
      .string()
      .url({ require_tld: false }) // Allow LAN URLs
      .trim(),
    metadata: vine
      .object({
        title: vine.string().trim().minLength(1),
        summary: vine.string().trim().optional(),
        author: vine.string().trim().optional(),
        size_bytes: vine.number().optional(),
      })
      .optional(),
  })
)

export const remoteDownloadValidatorOptional = vine.compile(
  vine.object({
    url: vine
      .string()
      .url({ require_tld: false }) // Allow LAN URLs
      .trim()
      .optional(),
  })
)

export const filenameParamValidator = vine.compile(
  vine.object({
    params: vine.object({
      filename: vine.string().trim().minLength(1).maxLength(4096),
    }),
  })
)

export const downloadCollectionValidator = vine.compile(
  vine.object({
    slug: vine.string(),
  })
)

export const downloadCategoryTierValidator = vine.compile(
  vine.object({
    categorySlug: vine.string().trim().minLength(1),
    tierSlug: vine.string().trim().minLength(1),
  })
)

export const selectWikipediaValidator = vine.compile(
  vine.object({
    optionId: vine.string().trim().minLength(1),
  })
)

const resourceUpdateInfoBase = vine.object({
  resource_id: vine.string().trim().minLength(1),
  resource_type: vine.enum(['zim', 'map'] as const),
  installed_version: vine.string().trim(),
  latest_version: vine.string().trim().minLength(1),
  download_url: vine.string().url({ require_tld: false }).trim(),
})

export const applyContentUpdateValidator = vine.compile(resourceUpdateInfoBase)

export const applyAllContentUpdatesValidator = vine.compile(
  vine.object({
    updates: vine
      .array(resourceUpdateInfoBase)
      .minLength(1),
  })
)
