import {before, after, test} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {deleteApp} from 'firebase-admin/app'
import {connectFirebase} from '../src/firebase.mjs'
import {createAccounts} from '../src/accounts.mjs'
import {createApiServer} from '../src/http.mjs'

// Share BE1's local suite, never the production Auth/Database endpoints.
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099')
assert.equal(process.env.FIREBASE_DATABASE_EMULATOR_HOST, '127.0.0.1:9000')
process.env.FIREBASE_PROJECT_ID = 'englishbattleapp-8d764'
process.env.FIREBASE_DATABASE_URL = 'https://englishbattleapp-8d764-default-rtdb.asia-southeast1.firebasedatabase.app'
const {app, auth, database} = connectFirebase()
const server = createApiServer(createAccounts(auth, database))
let base
const paths = ['users', 'userPrivate', 'userSettings', 'userStats', 'wallets',
  'accountAccess', 'userSettlements', 'rewardGrants', 'coinLedger', 'learningProgress']

async function signIn(email, password) {
  const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=test', {
    method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({email, password, returnSecureToken: true}),
  })
  assert.equal(response.status, 200)
  return (await response.json()).idToken
}

async function account(admin = true) {
  const email = `admin-integration-${randomUUID()}@example.test`
  const password = 'EmulatorOnly123!'
  const user = await auth.createUser({email, password, displayName: 'Auth integration'})
  if (admin !== false) await auth.setCustomUserClaims(user.uid, {admin})
  return {uid: user.uid, email, password, token: await signIn(email, password)}
}

async function call(method, token, data = {}) {
  const response = await fetch(`${base}/api/${method}`, {method: 'POST',
    headers: {'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {})},
    body: JSON.stringify({data})})
  return {status: response.status, body: await response.json()}
}

async function provision(user) {
  const response = await fetch('http://127.0.0.1:5001/englishbattleapp-8d764/asia-southeast1/ensureUserProfile', {
    method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${user.token}`},
    body: JSON.stringify({data: {}}),
  })
  assert.equal(response.status, 200, JSON.stringify(await response.json()))
}

async function records(uid) {
  return Object.fromEntries(await Promise.all(paths.map(async path =>
    [path, (await database.ref(`${path}/${uid}`).get()).val()])))
}

function clientUrl(path, token) {
  const url = new URL(`http://127.0.0.1:9000/${path}.json`)
  url.searchParams.set('ns', 'englishbattleapp-8d764-default-rtdb')
  if (token) url.searchParams.set('auth', token)
  return url
}

before(async () => { await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${server.address().port}` })
after(async () => { await new Promise(resolve => server.close(resolve)); await deleteApp(app) })

test('HTTP cannot provision: BE1 Callable alone creates the existing schema', async () => {
  const user = await account()
  assert.equal((await call('getAdminSession', user.token)).status, 409)
  for (const method of ['ensureUserProfile', 'getUserDashboard', 'startAttempt', 'getAttemptResult', 'adminListUsers']) {
    assert.equal((await call(method, user.token)).status, 404, method)
  }
  assert.ok(Object.values(await records(user.uid)).every(value => value === null))
  await provision(user)
  const profile = await records(user.uid)
  for (const path of paths.slice(0, 6)) assert.ok(profile[path], path)
  assert.equal(profile.users.displayCode, `EB-${user.uid}`)
  assert.equal(profile.users.avatarPath, '')
  assert.equal(profile.userStats.winStreak, 0)
  assert.equal(profile.userSettings.theme, 'system')
  assert.equal((await call('getAdminSession', user.token)).body.result.role, 'admin')
})

test('repeated concurrent admin sessions do not mutate profiles, settlements, wallets or grants', async () => {
  const user = await account()
  await provision(user)
  await database.ref().update({
    [`wallets/${user.uid}`]: {coinBalance: 27, appliedGrants: {existing: true}},
    [`userSettlements/${user.uid}`]: {coinBalance: 27, grants: {existing: {coinDelta: 2}}},
    [`rewardGrants/${user.uid}/existing`]: {status: 'completed', coinDelta: 2},
    [`learningProgress/${user.uid}/topic`]: {completedAttempts: 3},
  })
  const before = await records(user.uid)
  const results = await Promise.all(Array.from({length: 5}, () => call('getAdminSession', user.token)))
  assert.ok(results.every(response => response.status === 200))
  assert.deepEqual(await records(user.uid), before)
})

test('requires authentication, empty payload and boolean claims in both token and current Auth record', async () => {
  assert.equal((await call('getAdminSession', null)).status, 401)
  const user = await account(false)
  await provision(user)
  assert.equal((await call('getAdminSession', user.token)).status, 403)
  await auth.setCustomUserClaims(user.uid, {admin: 'true'})
  assert.equal((await call('getAdminSession', await signIn(user.email, user.password))).status, 403)
  await auth.setCustomUserClaims(user.uid, {admin: true})
  assert.equal((await call('getAdminSession', user.token)).status, 403)
  const token = await signIn(user.email, user.password)
  assert.equal((await call('getAdminSession', token, {uid: 'another-user', admin: true})).status, 400)
  assert.equal((await call('getAdminSession', token)).status, 200)
  await auth.setCustomUserClaims(user.uid, {})
  assert.equal((await call('getAdminSession', token)).status, 403)
})

test('banned, deleted and disabled users are rejected without changing account state', async () => {
  for (const status of ['banned', 'deleted']) {
    const user = await account()
    await provision(user)
    await database.ref(`accountAccess/${user.uid}/status`).set(status)
    const before = await records(user.uid)
    assert.equal((await call('getAdminSession', user.token)).status, 403)
    assert.deepEqual(await records(user.uid), before)
  }
  const user = await account()
  await provision(user)
  await auth.updateUser(user.uid, {disabled: true})
  assert.equal((await call('getAdminSession', user.token)).status, 403)
})

test('merged Rules allow only published catalog and own accountAccess reads', async () => {
  const user = await account(false)
  const other = await account(false)
  const fixture = `auth_${randomUUID()}`
  for (const path of ['categories', 'topics']) {
    await database.ref(`${path}/${fixture}`).set({status: 'published', name: 'Auth QA'})
    const query = clientUrl(path, user.token)
    query.searchParams.set('orderBy', '"status"'); query.searchParams.set('equalTo', '"published"')
    assert.equal((await fetch(query)).status, 401)
    await provision(user)
    const response = await fetch(query)
    assert.equal(response.status, 200)
    assert.ok((await response.json())[fixture])
    assert.equal((await fetch(clientUrl(path, user.token))).status, 401)
    query.searchParams.set('equalTo', '"draft"')
    assert.equal((await fetch(query)).status, 401)
    // Restore an unprovisioned user for the next catalog branch's initial check.
    if (path === 'categories') await database.ref(`accountAccess/${user.uid}`).remove()
  }
  assert.equal((await fetch(clientUrl(`accountAccess/${user.uid}`, user.token))).status, 200)
  assert.equal((await fetch(clientUrl(`accountAccess/${other.uid}`, user.token))).status, 401)
  await database.ref(`accountAccess/${user.uid}/status`).set('banned')
  const query = clientUrl('categories', user.token)
  query.searchParams.set('orderBy', '"status"'); query.searchParams.set('equalTo', '"published"')
  assert.equal((await fetch(query)).status, 401)
})

test('Rules retain BE1 indexes, default-deny private reads and all client writes', async () => {
  const rules = JSON.parse(readFileSync(new URL('../../../database.rules.json', import.meta.url))).rules
  assert.equal(rules['.read'], false); assert.equal(rules['.write'], false)
  assert.deepEqual(rules.practiceAttempts.$uid['.indexOn'], ['finishedAt'])
  assert.deepEqual(rules.notifications.$uid['.indexOn'], ['createdAt'])
  assert.deepEqual(rules.coinLedger.$uid['.indexOn'], ['createdAt'])
  const user = await account()
  await provision(user)
  for (const path of [`wallets/${user.uid}`, `userSettlements/${user.uid}`, `rewardGrants/${user.uid}`, 'questionAnswers']) {
    assert.equal((await fetch(clientUrl(path, user.token))).status, 401, path)
  }
  for (const path of [`accountAccess/${user.uid}`, `wallets/${user.uid}`, 'categories/auth_forbidden']) {
    const response = await fetch(clientUrl(path, user.token), {method: 'PUT', body: '{"status":"active","coinBalance":999}'})
    assert.equal(response.status, 401, path)
  }
  assert.equal((await fetch(clientUrl('categories'))).status, 401)
})
