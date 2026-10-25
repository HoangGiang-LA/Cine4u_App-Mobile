import {after, before, test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {initializeTestEnvironment, assertFails, assertSucceeds} from '@firebase/rules-unit-testing';

const projectId = 'demo-english-battle';
assert.equal(process.env.FIREBASE_DATABASE_EMULATOR_HOST, '127.0.0.1:19000', 'Rules tests must run only against the local emulator.');
let env;
const active = uid => env.authenticatedContext(uid).database();
const admin = uid => env.authenticatedContext(uid, {admin: true}).database();
const published = (db, path) => db.ref(path).orderByChild('status').equalTo('published').once('value');

before(async () => {
  const rules = fs.readFileSync(fileURLToPath(new URL('../../contracts/database.rules.proposed.json', import.meta.url)), 'utf8');
  env = await initializeTestEnvironment({projectId, database: {host: '127.0.0.1', port: 19000, rules}});
  await env.withSecurityRulesDisabled(async context => context.database().ref().set({
    accountAccess: {alice: {status: 'active'}, bob: {status: 'active'}, admin: {status: 'active'}, banned: {status: 'banned'}, deleted: {status: 'deleted'}},
    categories: {public: {name: 'Published', status: 'published'}, draft: {name: 'Draft', status: 'draft'}},
    topics: {public: {categoryId: 'public', title: 'Topic', status: 'published'}, draft: {title: 'Secret draft', status: 'draft'}},
    users: {alice: {displayName: 'Alice'}, bob: {displayName: 'Bob'}},
    userPrivate: {alice: {email: 'alice@example.test'}, bob: {email: 'bob@example.test'}},
    wallets: {alice: {coinBalance: 1}, bob: {coinBalance: 2}}, userStats: {alice: {rating: 5}},
    questions: {q1: {status: 'published'}}, questionVersions: {q1: {v1: {prompt: 'Question'}}},
    questionAnswers: {q1: {v1: {correctOptionId: 'a'}}}, battleQuestionSets: {b1: {answer: 'secret'}},
    adminProfiles: {admin: {displayName: 'Admin'}}, adminViews: {users: {alice: {displayName: 'Alice'}}},
    analytics: {daily: {sample: {users: 1}}}, appConfig: {server: {winRating: 5}},
  }));
});
after(async () => { await env?.cleanup(); });

test('anonymous clients cannot read root, catalog or private records', async () => {
  const db = env.unauthenticatedContext().database();
  for (const path of ['/', 'users/alice', 'userPrivate/alice', 'wallets/alice']) await assertFails(db.ref(path).once('value'));
  await assertFails(published(db, 'categories'));
});
test('an active user can query only published categories and topics', async () => {
  const db = active('alice');
  for (const path of ['categories', 'topics']) {
    const snap = await assertSucceeds(published(db, path));
    assert.deepEqual(Object.keys(snap.val()), ['public']);
    await assertFails(db.ref(path).once('value'));
    await assertFails(db.ref(path).orderByChild('status').equalTo('draft').once('value'));
  }
});
test('missing, banned or deleted accountAccess cannot access the catalog', async () => {
  for (const uid of ['missing', 'banned', 'deleted']) await assertFails(published(active(uid), 'categories'));
});
test('users can read public individual profiles but not enumerate the user collection', async () => {
  await assertSucceeds(active('alice').ref('users/bob').once('value'));
  await assertFails(active('alice').ref('users').once('value'));
});
test('only the active owner can read private profile, balance and rating', async () => {
  for (const path of ['userPrivate/alice', 'wallets/alice', 'userStats/alice']) {
    await assertSucceeds(active('alice').ref(path).once('value'));
    await assertFails(active('bob').ref(path).once('value'));
  }
});
test('banned users can read their own access status, not private data', async () => {
  await assertSucceeds(active('banned').ref('accountAccess/banned').once('value'));
  await assertFails(active('banned').ref('userPrivate/banned').once('value'));
  await assertFails(active('alice').ref('accountAccess/bob').once('value'));
});
test('an admin claim also requires an active account and boolean true', async () => {
  await assertSucceeds(admin('admin').ref('adminViews').once('value'));
  await assertSucceeds(admin('admin').ref('analytics').once('value'));
  await assertFails(active('alice').ref('adminViews').once('value'));
  await assertFails(admin('banned').ref('adminViews').once('value'));
  await assertFails(admin('missing').ref('adminViews').once('value'));
  await assertFails(env.authenticatedContext('admin', {admin: 'true'}).database().ref('adminViews').once('value'));
});
test('correct answers, raw question sets and server config are hidden even from browser admin', async () => {
  for (const db of [active('alice'), admin('admin')])
    for (const path of ['questionAnswers', 'questionVersions', 'questions', 'battleQuestionSets', 'appConfig/server'])
      await assertFails(db.ref(path).once('value'));
});
test('clients cannot change rating, coins, privileges, results or catalog including multi-path writes', async () => {
  for (const db of [active('alice'), admin('admin')]) {
    for (const [path, value] of Object.entries({'wallets/alice/coinBalance': 999, 'userStats/alice/rating': 999, 'accountAccess/alice/status': 'active', 'adminProfiles/alice/role': 'administrator', 'battleResults/b1/winner': 'alice', 'categories/public/status': 'published'}))
      await assertFails(db.ref(path).set(value));
    await assertFails(db.ref().update({'wallets/alice/coinBalance': 999, 'userStats/alice/rating': 999}));
  }
});
