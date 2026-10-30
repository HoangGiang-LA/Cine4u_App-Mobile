import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createApiServer} from '../src/http.mjs'
import {ApiError} from '../src/accounts.mjs'

async function fixture(run, overrides = {}, options = {}) {
  const calls = []
  const server = createApiServer({
    authenticate: async token => {
      if (token !== 'valid-token') throw new ApiError('UNAUTHENTICATED', 'Sign in again.')
      return {user: {uid: 'verified-uid'}}
    },
    execute: async (method, data, identity) => { calls.push({method, data, identity}); return {serverNow: 1} },
    ...overrides,
  }, {origins: ['http://localhost:5173'], logError: () => {}, ...options})
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${server.address().port}/api/ensureUserProfile`
  try { await run(url, calls) } finally { await new Promise(resolve => server.close(resolve)) }
}

test('requires a Firebase bearer token before executing an operation', () => fixture(async (url, calls) => {
  for (const authorization of [undefined, 'Bearer invalid']) {
    const response = await fetch(url, {method: 'POST', headers: authorization ? {authorization} : {}, body: '{"data":{}}'})
    assert.equal(response.status, 401)
  }
  assert.equal(calls.length, 0)
}))

test('passes verified identity and data to the service', () => fixture(async (url, calls) => {
  const response = await fetch(url, {method: 'POST', headers: {authorization: 'Bearer valid-token', origin: 'http://localhost:5173'}, body: '{"data":{}}'})
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {result: {serverNow: 1}})
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173')
  assert.equal(calls[0].identity.user.uid, 'verified-uid')
}))

test('rejects unapproved origins, malformed JSON and oversized bodies', () => fixture(async (url, calls) => {
  const headers = {authorization: 'Bearer valid-token'}
  assert.equal((await fetch(url, {method: 'POST', headers: {...headers, origin: 'https://untrusted.test'}, body: '{"data":{}}'})).status, 403)
  for (const body of ['invalid', '[]', '{"uid":"someone-else","data":{}}', JSON.stringify({data: 'x'.repeat(66_000)})]) {
    assert.equal((await fetch(url, {method: 'POST', headers, body})).status, 400)
  }
  assert.equal(calls.length, 0)
}))

test('does not expose server exceptions or secrets in HTTP responses', () => fixture(async url => {
  const response = await fetch(url, {method: 'POST', headers: {authorization: 'Bearer valid-token'}, body: '{"data":{}}'})
  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), {error: {status: 'INTERNAL', message: 'The request could not be completed.'}})
}, {execute: async () => { throw new Error('private-server-credential') }}))

test('returns a retryable timeout if Firebase does not respond', () => fixture(async url => {
  const response = await fetch(url, {method: 'POST', headers: {authorization: 'Bearer valid-token'}, body: '{"data":{}}'})
  assert.equal(response.status, 504)
  assert.equal((await response.json()).error.status, 'DEADLINE_EXCEEDED')
}, {execute: () => new Promise(() => {})}, {timeoutMs: 10}))
