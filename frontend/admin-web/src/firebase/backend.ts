export async function verifyAdminAccess(token: string) {
  const configured = import.meta.env.VITE_BACKEND_BASE_URL as string | undefined
  const baseUrl = configured || (import.meta.env.DEV ? 'http://127.0.0.1:8080' : '')
  if (!baseUrl) throw { code: 'backend/not-configured' }
  const url = new URL(`${baseUrl.replace(/\/$/, '')}/api/getAdminSession`)
  if (url.protocol !== 'https:' && !(import.meta.env.DEV && url.protocol === 'http:')) {
    throw { code: 'backend/not-configured' }
  }
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: {} }),
      signal: AbortSignal.timeout(20_000),
    })
  } catch {
    throw { code: 'backend/unavailable' }
  }
  const value = await response.json().catch(() => null)
  if (!response.ok || value?.result?.role !== 'admin') {
    throw {
      code:
        response.status === 403
          ? 'backend/access-denied'
          : response.status === 401
            ? 'auth/user-token-expired'
            : 'backend/unavailable',
    }
  }
}
