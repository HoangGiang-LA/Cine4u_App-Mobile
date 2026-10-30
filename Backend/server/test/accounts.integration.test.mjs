import {before, after, test} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {deleteApp} from 'firebase-admin/app'
import {connectFirebase} from '../src/firebase.mjs'
import {createAccounts} from '../src/accounts.mjs'
import {createApiServer} from '../src/http.mjs'

// These tests can mutate only local emulators in a demo project.
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:19099')
assert.equal(process.env.FIREBASE_DATABASE_EMULATOR_HOST, '127.0.0.1:19000')
process.env.FIREBASE_PROJECT_ID = 'demo-english-battle-auth'
process.env.FIREBASE_DATABASE_URL = 'https://demo-english-battle-auth-default-rtdb.firebaseio.com'
const {app, auth, database} = connectFirebase()
const server = createApiServer(createAccounts(auth, database))
let base

async function signIn(email, password) {
  const response = await fetch('http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=test', {
    method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({email, password, returnSecureToken: true}), signal: AbortSignal.timeout(15_000),
  })
  const value = await response.json()
  assert.equal(response.status, 200, JSON.stringify(value))
  return value.idToken
}

async function account() {
  const email = `${randomUUID()}@example.test`
  const password = 'emulator-only-password'
  const user = await auth.createUser({email, password, displayName: 'Người học thử'})
  return {uid: user.uid, email, password, token: await signIn(email, password)}
}

async function call(name, token, data = {}) {
  const response = await fetch(`${base}/api/${name}`, {method: 'POST', headers: token ? {authorization: `Bearer ${token}`} : {}, body: JSON.stringify({data}), signal: AbortSignal.timeout(25_000)})
  return {status: response.status, body: await response.json()}
}

before(async () => {
  await database.ref().set({categories: {published: {name: 'Từ vựng', status: 'published'}, draft: {name: 'Draft', status: 'draft'}}})
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})
after(async () => { await new Promise(resolve => server.close(resolve)); await deleteApp(app) })

test('automatically provisions a new Auth user and grants only published catalog reads', async () => {
  const user = await account()
  assert.equal((await call('ensureUserProfile', user.token)).status, 200)
  for (const path of ['users', 'userPrivate', 'userSettings', 'userStats', 'wallets', 'accountAccess']) {
    assert.equal((await database.ref(`${path}/${user.uid}`).get()).exists(), true, path)
  }
  assert.equal((await database.ref(`accountAccess/${user.uid}/status`).get()).val(), 'active')
  assert.notEqual((await auth.getUser(user.uid)).customClaims?.admin, true)
  assert.equal((await database.ref(`userSettings/${user.uid}/soundVolume`).get()).val(), 0.7)
  const url = new URL('http://127.0.0.1:19000/categories.json')
  url.searchParams.set('ns', 'demo-english-battle-auth-default-rtdb')
  url.searchParams.set('auth', user.token)
  url.searchParams.set('orderBy', JSON.stringify('status'))
  url.searchParams.set('equalTo', JSON.stringify('published'))
  const published = await fetch(url)
  assert.equal(published.status, 200)
  assert.deepEqual(Object.keys(await published.json()), ['published'])
  url.searchParams.delete('equalTo')
  assert.equal((await fetch(url)).status, 401)
  const writeUrl = new URL(`http://127.0.0.1:19000/accountAccess/${user.uid}.json`)
  writeUrl.searchParams.set('ns', 'demo-english-battle-auth-default-rtdb')
  writeUrl.searchParams.set('auth', user.token)
  assert.equal((await fetch(writeUrl, {method: 'PUT', body: '{"status":"active","admin":true}'})).status, 401)
})

test('repeated and concurrent sign-ins preserve wallet, rating and progress', async () => {
  const user = await account()
  await call('ensureUserProfile', user.token)
  await database.ref().update({[`wallets/${user.uid}/coinBalance`]: 27, [`userStats/${user.uid}/rating`]: 42, [`learningProgress/${user.uid}/topic/completedAttempts`]: 3})
  const results = await Promise.all(Array.from({length: 5}, () => call('ensureUserProfile', user.token)))
  assert.ok(results.every(result => result.status === 200))
  assert.equal((await database.ref(`wallets/${user.uid}/coinBalance`).get()).val(), 27)
  assert.equal((await database.ref(`userStats/${user.uid}/rating`).get()).val(), 42)
  assert.equal((await database.ref(`learningProgress/${user.uid}/topic/completedAttempts`).get()).val(), 3)
})

test('existing Auth users and partially initialized profiles recover automatically', async () => {
  const user = await account()
  await database.ref(`wallets/${user.uid}`).set({coinBalance: 9})
  assert.equal((await call('ensureUserProfile', user.token)).status, 200)
  assert.equal((await database.ref(`wallets/${user.uid}/coinBalance`).get()).val(), 9)
  assert.equal((await database.ref(`accountAccess/${user.uid}/status`).get()).val(), 'active')
})

test('does not reactivate banned/deleted users or allow disabled Auth accounts', async () => {
  for (const status of ['banned', 'deleted']) {
    const user = await account()
    await database.ref(`accountAccess/${user.uid}`).set({status})
    assert.equal((await call('ensureUserProfile', user.token)).status, 403)
    assert.equal((await database.ref(`accountAccess/${user.uid}/status`).get()).val(), status)
  }
  const user = await account()
  await auth.updateUser(user.uid, {disabled: true})
  assert.equal((await call('ensureUserProfile', user.token)).status, 403)
})

test('rejects client identity/role overrides and requires an authenticated request', async () => {
  const user = await account()
  assert.equal((await call('ensureUserProfile', null)).status, 401)
  assert.equal((await call('ensureUserProfile', user.token, {uid: 'another-user', admin: true})).status, 400)
  assert.equal((await database.ref('accountAccess/another-user').get()).exists(), false)
})

test('requires a boolean admin claim and rejects stale tokens after revocation', async () => {
  const user = await account()
  assert.equal((await call('getAdminSession', user.token)).status, 403)
  await call('ensureUserProfile', user.token)
  assert.equal((await call('adminListUsers', user.token)).status, 403)
  await auth.setCustomUserClaims(user.uid, {admin: 'true'})
  assert.equal((await call('getAdminSession', await signIn(user.email, user.password))).status, 403)
  await auth.setCustomUserClaims(user.uid, {admin: true})
  const adminToken = await signIn(user.email, user.password)
  const allowed = await call('getAdminSession', adminToken)
  assert.equal(allowed.status, 200)
  assert.equal(allowed.body.result.role, 'admin')
  await auth.setCustomUserClaims(user.uid, {})
  assert.equal((await call('getAdminSession', adminToken)).status, 403)
})
