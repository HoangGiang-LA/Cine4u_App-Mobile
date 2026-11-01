import {test} from 'node:test'
import assert from 'node:assert/strict'
import {assertLocalEnvironment} from '../tools/local-config.mjs'
import {connectFirebase} from '../src/firebase.mjs'

const local = {FIREBASE_LOCAL_MODE: 'true', FIREBASE_PROJECT_ID: 'demo-englishbattle', GCLOUD_PROJECT: 'demo-englishbattle',
  FIREBASE_DATABASE_URL: 'https://demo-englishbattle-default-rtdb.firebaseio.com',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099', FIREBASE_DATABASE_EMULATOR_HOST: '127.0.0.1:9000'}

test('seed tools reject production projects, mixed services and external hosts', () => {
  assert.doesNotThrow(() => assertLocalEnvironment(local))
  for (const override of [{FIREBASE_LOCAL_MODE: 'false'}, {FIREBASE_PROJECT_ID: 'englishbattleapp-8d764'},
    {GCLOUD_PROJECT: 'other'}, {FIREBASE_AUTH_EMULATOR_HOST: ''}, {FIREBASE_DATABASE_EMULATOR_HOST: 'remote:9000'},
    {FIREBASE_DATABASE_URL: 'https://production.firebaseio.com'}]) {
    assert.throws(() => assertLocalEnvironment({...local, ...override}), /Local tools require/)
  }
})

test('server local mode fails closed before SDK initialization', () => {
  for (const override of [{FIREBASE_PROJECT_ID: 'production'}, {FIREBASE_AUTH_EMULATOR_HOST: ''},
    {FIREBASE_DATABASE_URL: 'https://production.firebaseio.com'}]) {
    assert.throws(() => connectFirebase({...local, ...override}), /Local mode requires/)
  }
})
