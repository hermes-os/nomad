# Fix patterns already in the tree

Reuse these. A new helper needs a reason the existing one does not fit.

## Path containment

`resolveWithinDirectory(baseDir, name)` in `admin/app/utils/fs.ts` resolves
`name` against `baseDir` and returns `null` when the result escapes — it
requires the resolved path to start with `base + path.sep`, so a sibling
directory sharing a name prefix does not pass. Callers translate `null` into a
terse boundary error:

```ts
const fullPath = resolveWithinDirectory(join(process.cwd(), ZIM_STORAGE_PATH), fileName)
if (!fullPath) {
  throw new Error('Invalid filename')
}
```

Call sites: `zim_service.ts` delete, `collection_update_service.ts` download
destination.

Two call sites still inline the same `resolve()` + `startsWith(base + sep)`
idiom rather than the helper: `map_service.ts:407-413` and
`docs_service.ts:70-73`. Behavior matches. Consolidating them is a refactor,
not a fix — do it only when a finding already changes those lines.

Containment alone is not enough when the name may contain a separator: the
download job does not create parent directories, so a nested-but-contained
destination fails later as a deep `ENOENT`. Reject the separator at validation.

## SSRF

`assertNotPrivateUrl(urlString)` in `admin/app/validators/common.ts` throws for
`localhost`, `127.0.0.0/8`, `0.0.0.0`, `[::]`, `169.254.0.0/16`, `[::1]`, and
`fe80:` hosts. It unwraps IPv4-mapped IPv6 hosts (`[::ffff:7f00:1]`) back to
dotted-quad first, because the URL parser normalizes them past the IPv4 rules
while the socket layer still connects to the embedded address.

The download validators keep `url({ require_tld: false })` so LAN hostnames
like `http://my-nas:8080/file.zim` stay valid. Do not tighten that.

## Error handling

Helpers in `admin/app/utils/fs.ts` treat `ENOENT` as "absent" and rethrow every
other error. Do not swallow an error class to make a path simpler.
