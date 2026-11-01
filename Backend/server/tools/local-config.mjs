import {connectFirebase} from '../src/firebase.mjs'

export const projectId = 'demo-englishbattle'
export const namespace = `${projectId}-default-rtdb`
export const authBase = 'http://127.0.0.1:9099'
export const functionsBase = `http://127.0.0.1:5001/${projectId}/asia-southeast1`
export const demoPassword = 'LocalDemo123!'
export const demoAccounts = [
  {uid: 'local-admin', email: 'admin@example.test', displayName: 'Local Administrator', admin: true},
  {uid: 'local-learner', email: 'learner@example.test', displayName: 'Local Learner', admin: false},
]

export function assertLocalEnvironment(env = process.env) {
  if (env.FIREBASE_LOCAL_MODE !== 'true' || env.FIREBASE_PROJECT_ID !== projectId ||
      env.GCLOUD_PROJECT !== projectId ||
      env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099' ||
      env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9000' ||
      env.FIREBASE_DATABASE_URL !== `https://${namespace}.firebaseio.com`) {
    throw new Error('Local tools require the demo project and both loopback emulators. Use scripts/local/*.ps1.')
  }
}

export async function assertEmulators() {
  assertLocalEnvironment()
  const response = await fetch('http://127.0.0.1:4400/emulators', {signal: AbortSignal.timeout(5000)})
  if (!response.ok) throw new Error('Emulator Hub is unavailable.')
  const services = await response.json()
  for (const [name, port] of [['auth', 9099], ['database', 9000], ['functions', 5001]]) {
    if (services[name]?.port !== port || !['127.0.0.1', 'localhost'].includes(services[name]?.host)) {
      throw new Error(`Missing loopback ${name} emulator on ${port}.`)
    }
  }
  // Verify the demo project's actual Callable exists before any seed writes.
  const callable = await fetch(`${functionsBase}/ensureUserProfile`, {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{"data":{}}',
    signal: AbortSignal.timeout(30000),
  })
  if (callable.status !== 401) throw new Error('Demo ensureUserProfile is not ready; start the matching Functions Emulator.')
}

export function connectLocalFirebase() {
  assertLocalEnvironment()
  return connectFirebase()
}

export async function signIn(email, password = demoPassword) {
  const response = await fetch(`${authBase}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-only`, {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email, password, returnSecureToken: true}), signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error(`Local Auth sign-in failed (${response.status}).`)
  return (await response.json()).idToken
}

export async function callable(method, token, data = {}) {
  const response = await fetch(`${functionsBase}/${method}`, {
    method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
    body: JSON.stringify({data}), signal: AbortSignal.timeout(30000),
  })
  const body = await response.json()
  return {status: response.status, body}
}

if (process.argv[1]?.endsWith('local-config.mjs') && process.argv.includes('--check')) {
  await assertEmulators()
  console.log('Demo Auth, Database and Functions Emulators are ready.')
}
