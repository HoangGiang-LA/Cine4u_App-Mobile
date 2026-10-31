import { afterEach, describe, expect, it, vi } from 'vitest'
import { verifyAdminAccess } from '../firebase/backend'

afterEach(() => vi.unstubAllGlobals())
describe('trusted server authorization', () => {
  it('sends the Firebase ID token without client role or UID overrides', async () => {
    const request = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ result: { role: 'admin' } }), { status: 200 }),
      )
    vi.stubGlobal('fetch', request)
    await verifyAdminAccess('test-token')
    expect(request).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        method: 'POST',
        headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
        body: '{"data":{}}',
      }),
    )
  })
  it('rejects a cached claim when the server refuses access', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 403 })))
    await expect(verifyAdminAccess('stale-token')).rejects.toEqual({
      code: 'backend/access-denied',
    })
  })
  it('does not confirm admin access on a malformed server response or connection failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{"result":{}}', { status: 200 })),
    )
    await expect(verifyAdminAccess('token')).rejects.toEqual({ code: 'backend/unavailable' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network unavailable')))
    await expect(verifyAdminAccess('token')).rejects.toEqual({ code: 'backend/unavailable' })
  })
})
