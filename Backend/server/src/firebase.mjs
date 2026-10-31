import {initializeApp, applicationDefault} from 'firebase-admin/app'
import {getAuth} from 'firebase-admin/auth'
import {getDatabase} from 'firebase-admin/database'

export function connectFirebase(env = process.env) {
  const projectId = env.FIREBASE_PROJECT_ID
  const databaseURL = env.FIREBASE_DATABASE_URL
  if (!projectId || !databaseURL) throw new Error('Set FIREBASE_PROJECT_ID and FIREBASE_DATABASE_URL in the server environment.')
  const emulator = Boolean(env.FIREBASE_AUTH_EMULATOR_HOST || env.FIREBASE_DATABASE_EMULATOR_HOST)
  // BE1's existing suite uses its configured project ID. Both services MUST
  // stay on loopback so QA can share that suite without reaching production.
  if (emulator && (!/^127\.0\.0\.1:\d+$/.test(env.FIREBASE_AUTH_EMULATOR_HOST || '') ||
      !/^127\.0\.0\.1:\d+$/.test(env.FIREBASE_DATABASE_EMULATOR_HOST || ''))) {
    throw new Error('Emulators require both Auth and Database on loopback hosts.')
  }
  if (!emulator && !env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS to the private Admin SDK key path on this server.')
  }
  const credential = emulator ? {getAccessToken: async () => ({access_token: 'owner', expires_in: 3600})} : applicationDefault()
  const app = initializeApp({projectId, databaseURL, credential})
  return {app, auth: getAuth(app), database: getDatabase(app)}
}
