import { vi } from 'vitest'
import type { AuthGateway, FirebaseSession } from '../firebase/auth'

export function createAuthStub(initial: FirebaseSession | null = null) {
  let current = initial
  const listeners = new Set<(session: FirebaseSession | null) => void>()
  const errors = new Set<(error: unknown) => void>()
  const emit = (session: FirebaseSession | null) => {
    current = session
    listeners.forEach((next) => next(session))
  }
  const gateway: AuthGateway = {
    subscribe(next, error) {
      listeners.add(next)
      errors.add(error)
      next(current)
      return () => {
        listeners.delete(next)
        errors.delete(error)
      }
    },
    signIn: vi.fn(async () => {
      throw { code: 'auth/invalid-credential' }
    }),
    signOut: vi.fn(async () => emit(null)),
    refresh: vi.fn(async () => current),
  }
  return {
    gateway,
    emit,
    fail: (error: unknown) => errors.forEach((listener) => listener(error)),
    load: () => Promise.resolve(gateway),
  }
}

export const adminSession: FirebaseSession = {
  uid: 'test-admin',
  email: 'admin@example.test',
  name: 'Test Admin',
  isAdmin: true,
}
