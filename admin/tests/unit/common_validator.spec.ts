import { test } from '@japa/runner'
import { assertNotPrivateUrl } from '../../app/validators/common.js'

function isRejected(url: string): boolean {
  try {
    assertNotPrivateUrl(url)
    return false
  } catch {
    return true
  }
}

test.group('assertNotPrivateUrl', () => {
  test('rejects loopback and link-local hosts', ({ assert }) => {
    const blocked = [
      'http://localhost:8080/file.zim',
      'http://127.0.0.1/file.zim',
      'http://127.1/file.zim',
      'http://2130706433/file.zim',
      'http://0.0.0.0/file.zim',
      'http://169.254.169.254/latest/meta-data/',
      'http://[::1]/file.zim',
      'http://[0:0:0:0:0:0:0:1]/file.zim',
      'http://[fe80::1]/file.zim',
    ]

    assert.deepEqual(blocked.filter(isRejected), blocked)
  })

  test('rejects IPv4-mapped IPv6 hosts pointing at loopback or link-local', ({ assert }) => {
    const blocked = [
      'http://[::ffff:127.0.0.1]/file.zim',
      'http://[0:0:0:0:0:ffff:127.0.0.1]/file.zim',
      'http://[::ffff:169.254.169.254]/latest/meta-data/',
    ]

    assert.deepEqual(blocked.filter(isRejected), blocked)
  })

  test('rejects the IPv6 unspecified address', ({ assert }) => {
    assert.isTrue(isRejected('http://[::]/file.zim'))
  })

  test('allows LAN and public hosts', ({ assert }) => {
    const allowed = [
      'http://192.168.1.10:8080/file.zim',
      'http://10.0.0.5/file.zim',
      'http://172.16.4.2/file.zim',
      'http://my-nas:8080/file.zim',
      'https://download.kiwix.org/zim/wikipedia_en_all_nopic_2024-06.zim',
      'http://[::ffff:192.168.1.5]/file.zim',
      'http://[2606:4700::1]/file.zim',
    ]

    assert.deepEqual(allowed.filter(isRejected), [])
  })
})
