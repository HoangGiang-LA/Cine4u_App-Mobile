import {test} from 'node:test'
import assert from 'node:assert/strict'
import {connectFirebase} from '../src/firebase.mjs'

const configured = {FIREBASE_PROJECT_ID: 'demo-auth', FIREBASE_DATABASE_URL: 'https://demo-auth-default-rtdb.firebaseio.com'}
test('rejects partial or non-loopback emulator settings before initializing Firebase', () => {
  for (const hosts of [
    {FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099'},
    {FIREBASE_DATABASE_EMULATOR_HOST: '127.0.0.1:9000'},
    {FIREBASE_AUTH_EMULATOR_HOST: 'example.com:9099', FIREBASE_DATABASE_EMULATOR_HOST: '127.0.0.1:9000'},
    {FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099', FIREBASE_DATABASE_EMULATOR_HOST: 'example.com:9000'},
  ]) assert.throws(() => connectFirebase({...configured, ...hosts}), /both Auth and Database on loopback/)
})
test('requires explicit project configuration and private credentials outside emulator mode', () => {
  assert.throws(() => connectFirebase({}), /FIREBASE_PROJECT_ID/)
  assert.throws(() => connectFirebase(configured), /GOOGLE_APPLICATION_CREDENTIALS/)
})
