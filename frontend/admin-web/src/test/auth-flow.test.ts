import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: {currentUser: {uid: 'admin', email: 'admin@example.test', displayName: 'Admin'}},
  token: vi.fn(), provision: vi.fn(), verify: vi.fn(),
  functions: {}, connectEmulator: vi.fn(),
}))
vi.mock('firebase/app', () => ({getApps: () => [], initializeApp: () => ({})}))
vi.mock('firebase/database', () => ({getDatabase: () => ({})}))
vi.mock('firebase/auth', () => ({
  getAuth: () => mocks.auth, getIdTokenResult: mocks.token,
  browserSessionPersistence: {}, onIdTokenChanged: vi.fn(), setPersistence: vi.fn(),
  signInWithEmailAndPassword: vi.fn(), signOut: vi.fn(),
}))
vi.mock('firebase/functions', () => ({
  getFunctions: () => mocks.functions,
  connectFunctionsEmulator: mocks.connectEmulator,
  httpsCallable: () => mocks.provision,
}))
vi.mock('../firebase/backend', () => ({verifyAdminAccess: mocks.verify}))
import {authGateway} from '../firebase/client'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.token.mockResolvedValue({token: 'test-token', claims: {admin: true}})
  mocks.provision.mockResolvedValue({data: {serverNow: 1}})
  mocks.verify.mockResolvedValue(undefined)
})

describe('local Functions with real Firebase authentication', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('routes Functions to localhost only when explicitly enabled in development', async () => {
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_USE_FUNCTIONS_EMULATOR', 'true')
    vi.resetModules()
    await import('../firebase/client')
    expect(mocks.connectEmulator).toHaveBeenCalledWith(mocks.functions, '127.0.0.1', 5001)
  })

  it('keeps production Functions when local mode is not enabled', async () => {
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_USE_FUNCTIONS_EMULATOR', '')
    vi.resetModules()
    await import('../firebase/client')
    expect(mocks.connectEmulator).not.toHaveBeenCalled()
  })

  it('ignores the local Functions flag in production builds', async () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_USE_FUNCTIONS_EMULATOR', 'true')
    vi.resetModules()
    await import('../firebase/client')
    expect(mocks.connectEmulator).not.toHaveBeenCalled()
  })
})

describe('BE1 provisioning ownership and admin HTTP authorization', () => {
  it('awaits Callable provisioning before checking the HTTP admin session', async () => {
    const session = await authGateway.refresh()
    expect(session?.isAdmin).toBe(true)
    expect(mocks.provision).toHaveBeenCalledWith({})
    expect(mocks.verify).toHaveBeenCalledWith('test-token')
    expect(mocks.provision.mock.invocationCallOrder[0]).toBeLessThan(mocks.verify.mock.invocationCallOrder[0])
  })
  it('does not authorize if Callable provisioning fails', async () => {
    mocks.provision.mockRejectedValueOnce(new Error('profile denied'))
    await expect(authGateway.refresh()).rejects.toThrow('profile denied')
    expect(mocks.verify).not.toHaveBeenCalled()
  })
  it('keeps non-admin users outside admin APIs', async () => {
    mocks.token.mockResolvedValueOnce({token: 'user-token', claims: {admin: false}})
    expect((await authGateway.refresh())?.isAdmin).toBe(false)
    expect(mocks.provision).not.toHaveBeenCalled()
    expect(mocks.verify).not.toHaveBeenCalled()
  })
  it('rejects a revoked admin claim even after successful provisioning', async () => {
    mocks.verify.mockRejectedValueOnce({code: 'backend/access-denied'})
    await expect(authGateway.refresh()).rejects.toEqual({code: 'backend/access-denied'})
  })
})
