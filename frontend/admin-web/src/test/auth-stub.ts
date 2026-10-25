import { vi } from 'vitest'
import type { AuthGateway, FirebaseSession } from '../firebase/auth'

export function createAuthStub(initial: FirebaseSession | null = null) {
  let current = initial
  const listeners = new Set<(session: FirebaseSession | null) => void>()
  const emit = (session: FirebaseSession | null) => {
    current = session
    listeners.forEach((next) => next(session))
  }
  const gateway: AuthGateway = {
    subscribe(next) {
      listeners.add(next)
      next(current)
      return () => {
        listeners.delete(next)
      }
    },
    signIn: vi.fn(async () => {
      throw { code: 'auth/invalid-credential' }
    }),
    signOut: vi.fn(async () => emit(null)),
    refresh: vi.fn(async () => current),
  }
  return { gateway, emit, load: () => Promise.resolve(gateway) }
}
