import {after, before, test} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {readFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {deleteApp} from 'firebase-admin/app'
import {assertEmulators, connectLocalFirebase, signIn, callable, namespace} from '../tools/local-config.mjs'

await assertEmulators()
const {app, auth, database} = connectLocalFirebase()
const temporaryUsers = []
const records = async uid => Object.fromEntries(await Promise.all([
  'users', 'userPrivate', 'userSettings', 'userStats', 'accountAccess', 'wallets', 'userSettlements', 'rewardGrants',
].map(async path => [path, (await database.ref(`${path}/${uid}`).get()).val()])))

async function session(token, method = 'getAdminSession') {
  const response = await fetch(`http://127.0.0.1:8080/api/${method}`, {method: 'POST',
    headers: {'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {})},
    body: '{"data":{}}'})
  return {status: response.status, body: await response.json()}
}

before(async () => {
  assert.equal((await fetch('http://127.0.0.1:8080/health')).status, 200)
})
after(async () => {
  // Only temporary Auth fixtures are removed; no demo/user runtime data is cleared.
  for (const uid of temporaryUsers) await auth.deleteUser(uid)
  await deleteApp(app)
})

test('demo admin uses the real Auth, Callable and HTTP server without profile/wallet mutations', async () => {
  const token = await signIn('admin@example.test')
  const before = await records('local-admin')
  assert.equal((await callable('ensureUserProfile', token)).status, 200)
  assert.equal((await session(token)).body.result.role, 'admin')
  assert.deepEqual(await records('local-admin'), before)
  assert.equal((await session(token, 'ensureUserProfile')).status, 404)
  assert.equal((await session(token, 'startAttempt')).status, 404)
})

test('seed can run again without changing existing demo runtime records', async () => {
  const before = await records('local-learner')
  execFileSync(process.execPath, [fileURLToPath(new URL('../tools/seed-local.mjs', import.meta.url))],
    {env: process.env, timeout: 90000, stdio: 'pipe'})
  assert.deepEqual(await records('local-learner'), before)
})

test('anonymous, ordinary, banned and disabled accounts cannot get an admin session', async () => {
  assert.equal((await session(null)).status, 401)
  assert.equal((await session(await signIn('learner@example.test'))).status, 403)
  const uid = `local-test-${randomUUID()}`
  const email = `${uid}@example.test`
  await auth.createUser({uid, email, password: 'LocalDemo123!'})
  temporaryUsers.push(uid)
  let token = await signIn(email)
  assert.equal((await callable('ensureUserProfile', token)).status, 200)
  await auth.setCustomUserClaims(uid, {admin: true})
  token = await signIn(email)
  await database.ref(`accountAccess/${uid}/status`).set('banned')
  assert.equal((await session(token)).status, 403)
  assert.equal((await callable('ensureUserProfile', token)).status, 403)
  await auth.updateUser(uid, {disabled: true})
  assert.equal((await session(token)).status, 403)
})

test('local learning uses real BE1 Callables and protected Database Rules', async () => {
  const token = await signIn('learner@example.test')
  assert.equal((await callable('getUserDashboard', token)).status, 200)
  const start = await callable('startAttempt', token, {
    mode: 'PRACTICE', topicId: 'vocabulary_daily_life', requestId: randomUUID(),
  })
  assert.equal(start.status, 200, JSON.stringify(start.body))
  const attemptId = start.body.result.attempt.id
  assert.equal((await callable('resumeAttempt', token, {attemptId})).status, 200)
  assert.equal((await callable('leaveAttempt', token, {attemptId, requestId: randomUUID()})).status, 200)
  assert.equal((await callable('getAttemptResult', token, {attemptId})).status, 200)
  const rules = JSON.parse(await readFile(new URL('../../../database.rules.json', import.meta.url), 'utf8')).rules
  assert.equal(rules['.read'], false)
  assert.equal(rules['.write'], false)
  for (const [path, index] of [['practiceAttempts', 'finishedAt'], ['notifications', 'createdAt'], ['coinLedger', 'createdAt']]) {
    assert.deepEqual(rules[path].$uid['.indexOn'], [index])
  }
  const dbUrl = path => `http://127.0.0.1:9000/${path}.json?ns=${namespace}&auth=${token}`
  assert.equal((await fetch(dbUrl('categories') + '&orderBy=%22status%22&equalTo=%22published%22')).status, 200)
  assert.equal((await fetch(dbUrl('wallets/local-learner'))).status, 401)
  assert.equal((await fetch(dbUrl('wallets/local-learner'), {method: 'PUT', body: '{"coinBalance":999}'})).status, 401)
})
