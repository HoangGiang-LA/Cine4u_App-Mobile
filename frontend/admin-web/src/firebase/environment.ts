import type { FirebaseOptions } from 'firebase/app'
import { firebaseConfig } from './config'

export const localProjectId = 'demo-englishbattle'

export function firebaseEnvironment(enabled: string | undefined, development: boolean) {
  if (enabled && !['true', 'false'].includes(enabled)) throw { code: 'emulator/invalid-config' }
  const local = enabled === 'true'
  if (local && !development) throw { code: 'emulator/invalid-config' }
  const config: FirebaseOptions = local
    ? {
        apiKey: 'demo-emulator-only',
        appId: '1:1234567890:web:emulator',
        projectId: localProjectId,
        authDomain: `${localProjectId}.firebaseapp.com`,
        databaseURL: `https://${localProjectId}-default-rtdb.firebaseio.com`,
      }
    : firebaseConfig
  return { local, config }
}

export const environment = firebaseEnvironment(
  import.meta.env.VITE_USE_FIREBASE_EMULATORS as string | undefined,
  import.meta.env.DEV,
)
