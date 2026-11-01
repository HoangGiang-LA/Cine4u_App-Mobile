import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {test as nodeTest} from 'node:test';
import {mobileContract} from '../../../frontend/contracts/mobile.v1.mjs';
import {startBackend} from './battle/helpers/backendClient.mjs';
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9199');
assert.equal(process.env.FIREBASE_DATABASE_EMULATOR_HOST, '127.0.0.1:9100');
assert.equal(process.env.GCLOUD_PROJECT, 'demo-englishbattle-finalization');
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const {adminAuth, adminDb} = require('./lib/config/firebaseAdmin.js');
const {deleteApp} = require('firebase-admin/app');
const {ensureUserProfile} = require('./lib/be1/auth/ensureUserProfile.js');
const {getUserDashboard} = require('./lib/be1/user/getUserDashboard.js');
const {getLeaderboard} = require('./lib/be1/community/getLeaderboard.js');
const {getNotifications} = require('./lib/be1/community/getNotifications.js');
const {markNotificationsRead} = require('./lib/be1/user/markNotificationsRead.js');
const {runCommunityMaintenance} = require('./lib/be1/community/communityMaintenance.js');
const {syncLeaderboardPlayer} = require('./lib/be1/community/leaderboardProjection.js');
const {publishNotification, drainNotificationReads} = require('./lib/be1/community/notifications.js');
const {startAttempt} = require('./lib/be1/practice/startAttempt.js');
const {getAttemptResult} = require('./lib/be1/practice/getAttemptResult.js');
const Ajv = require('ajv');
const ajv = new Ajv({strict: false});
const validate = name => ajv.compile(mobileContract.methods[name].response);
assert.match(adminDb.ref().toString(), /^http:\/\/127\.0\.0\.1:9100\//);
const seed = JSON.parse(readFileSync(new URL('../../database/english-battle.seed.json', import.meta.url), 'utf8'));
const test = (name, run) => nodeTest(name, {timeout: 45000}, run);
const call = (fn, uid, data = {}) => fn.run({auth: uid ? {uid} : undefined, data});
const read = async path => (await adminDb.ref(path).get()).val();
const clockAt = async (time, run) => {
  const now = Date.now; Date.now = () => time;
  try { return await run(); } finally { Date.now = now; }
};
let me, other;
async function fresh(players = 0) {
  await adminDb.ref().set(seed);
  const users = [];
  for (let i = 0; i < 2; i++) {
    const u = await adminAuth.createUser({email: `community-${randomUUID()}@example.test`, displayName: `Viewer ${i}`});
    await call(ensureUserProfile, u.uid);
    users.push(u.uid);
  }
  [me, other] = users;
  const updates = {};
  for (let i = 0; i < players; i++) {
    const uid = `player_${String(i).padStart(3, '0')}`;
    updates[`users/${uid}`] = {displayName: `Player ${i}`, updatedAt: 1};
    updates[`userStats/${uid}`] = {rating: (i % 5) * 5, updatedAt: 1};
    updates[`accountAccess/${uid}`] = {status: 'active'};
  }
  if (players) await adminDb.ref().update(updates);
}
const board = async (cursor = null, uid = me, period = 'week') => {
  const response = await call(getLeaderboard, uid, {period, cursor});
  const check = validate('getLeaderboard');
  assert.ok(check(response), JSON.stringify(check.errors));
  return response.page;
};
const inbox = async (cursor = null, uid = me) => {
  const response = await call(getNotifications, uid, {cursor});
  const check = validate('getNotifications');
  assert.ok(check(response), JSON.stringify(check.errors));
  return response.page;
};
const note = (createdAt = 1000) => ({title: 'Notification', body: 'Earned event',
  targetType: 'Achievements', createdAt});

try {
  const ns = new URL(adminDb.app.options.databaseURL).hostname.split('.')[0];
  const rules = await fetch(`http://127.0.0.1:9100/.settings/rules.json?ns=${ns}`, {
    method: 'PUT', headers: {Authorization: 'Bearer owner', 'Content-Type': 'application/json'},
    body: readFileSync(new URL('../../../database.rules.json', import.meta.url), 'utf8'),
  });
  assert.equal(rules.status, 200);

  await test('All provisioned players rank by rating then UID, with identical week/month and a self rank outside page one', async () => {
    await fresh(74);
    const first = await board();
    assert.equal(first.entries.length, 25);
    const all = [...first.entries];
    let cursor = first.nextCursor;
    while (cursor) { const page = await board(cursor); all.push(...page.entries); cursor = page.nextCursor; }
    assert.equal(all.length, 76); assert.equal(new Set(all.map(e => e.uid)).size, 76);
    assert.deepEqual(all, [...all].sort((a, b) => b.rating - a.rating || (a.uid < b.uid ? -1 : 1)));
    assert.deepEqual(all.map(e => e.rank), Array.from({length: 76}, (_, i) => i + 1));
    assert.deepEqual(first.self, all.find(e => e.uid === me));
    assert.ok(first.self.rank > 25);
    const month = await board(null, me, 'month');
    assert.deepEqual(month.entries, first.entries); assert.deepEqual(month.self, first.self);
  });

  await test('Rating changes while paging preserve the frozen order; refresh uses the new rating', async () => {
    await fresh(60);
    const first = await board();
    await adminDb.ref(`userStats/${me}`).update({rating: 999, battleStatsSequence: 1, updatedAt: Date.now()});
    await syncLeaderboardPlayer(me);
    const oldNext = await board(first.nextCursor);
    assert.equal(oldNext.self.rating, 0);
    const refreshed = await board();
    assert.equal(refreshed.entries[0].uid, me); assert.equal(refreshed.self.rating, 999);
    assert.equal(refreshed.self.rank, 1);
    assert.equal(oldNext.entries.some(e => e.rank <= 25), false);
  });

  await test('Banned players remain ranked, deleted players are excluded and old names are redacted', async () => {
    await fresh(55);
    await adminDb.ref('accountAccess/player_054/status').set('banned');
    await adminDb.ref('accountAccess/player_053/status').set('deleted');
    const first = await board();
    assert.ok(first.entries.some(e => e.uid === 'player_054'));
    let page = first; const all = [];
    do { all.push(...page.entries); page = page.nextCursor ? await board(page.nextCursor) : null; } while (page);
    assert.equal(all.some(e => e.uid === 'player_053'), false);
    const doomed = all.find(e => e.rank > 25 && e.uid.startsWith('player_'));
    await adminDb.ref(`accountAccess/${doomed.uid}/status`).set('deleted');
    page = await board(first.nextCursor);
    while (!page.entries.some(e => e.uid === doomed.uid) && page.nextCursor) page = await board(page.nextCursor);
    assert.equal(page.entries.find(e => e.uid === doomed.uid).name, 'Tài khoản đã xóa');
  });

  await test('Leaderboard cursors are owner/query bound, expire, and reject forged inputs', async () => {
    await fresh(30);
    const first = await board();
    await assert.rejects(board(first.nextCursor, other), {code: 'permission-denied'});
    await assert.rejects(board(first.nextCursor, me, 'month'), {code: 'invalid-argument'});
    await assert.rejects(inbox(first.nextCursor), {code: 'permission-denied'});
    await assert.rejects(board('../bad'), {code: 'invalid-argument'});
    await assert.rejects(call(getLeaderboard, me, {period: 'year'}), {code: 'invalid-argument'});
    await assert.rejects(call(getLeaderboard, me, {period: 'week', uid: other}), {code: 'invalid-argument'});
    const t = await read(`communityCursors/${first.nextCursor}`);
    await clockAt(t.expiresAt, () => assert.rejects(board(first.nextCursor), {code: 'failed-precondition'}));
    await assert.rejects(call(getLeaderboard, null, {period: 'week'}), {code: 'unauthenticated'});
    await adminDb.ref(`accountAccess/${me}/status`).set('banned');
    await assert.rejects(board(), {code: 'permission-denied'});
  });

  await test('Bootstrap persists its cursor across more than 200 legacy players before publishing a complete ranking', async () => {
    await fresh(205);
    await assert.rejects(board(), {code: 'unavailable'});
    await runCommunityMaintenance(); await runCommunityMaintenance();
    const first = await board();
    assert.equal(first.entries.length, 25);
    const snapshot = (await read(`communityOwners/${me}/ranking`)).id;
    assert.equal(Object.keys(await read(`communityRankings/${snapshot}/ranks`)).length, 207);
  });

  await test('Profile sync changes public names without exposing email and ranking uses source rating', async () => {
    await fresh();
    await adminAuth.updateUser(me, {displayName: 'Public new name'});
    await call(ensureUserProfile, me);
    await adminDb.ref(`userStats/${me}`).update({rating: 15, battleStatsSequence: 3, updatedAt: Date.now()});
    await syncLeaderboardPlayer(me);
    const result = await board();
    assert.equal(result.self.name, 'Public new name'); assert.equal(result.self.rating, 15);
    assert.deepEqual(Object.keys(result.self).sort(), ['name', 'rank', 'rating', 'uid']);
  });

  await test('Notification pagination handles equal timestamps, numeric IDs and more than 50 unread events', async () => {
    await fresh();
    const raw = Object.fromEntries(Array.from({length: 106}, (_, i) => [String(i), note()]));
    raw.invalid = {...note(2000), targetType: 'https://evil.test'};
    await adminDb.ref(`notifications/${me}`).set(raw);
    const expected = [];
    (await adminDb.ref(`notifications/${me}`).orderByChild('createdAt').startAt(0).endAt(1000).get())
      .forEach(child => { expected.push(child.key); });
    expected.reverse();
    const first = await inbox();
    assert.equal(first.unreadCount, 106); assert.equal(first.totalCount, 106);
    const ids = first.entries.map(n => n.id);
    await publishNotification(me, 'new', note(3000));
    let cursor = first.nextCursor;
    while (cursor) { const page = await inbox(cursor); ids.push(...page.entries.map(n => n.id)); cursor = page.nextCursor; }
    assert.deepEqual(ids, expected); assert.equal(new Set(ids).size, 106);
    assert.equal((await inbox()).entries[0].id, 'new');
    const d = (await call(getUserDashboard, me)).dashboard;
    assert.equal(d.unreadNotificationCount, 107); assert.equal(d.notifications.length, 50);
  });

  await test('Mark all reads every owned notification including older pages, preserves other UID and survives interrupted projection', async () => {
    await fresh();
    await adminDb.ref(`notifications/${me}`).set(Object.fromEntries(Array.from({length: 80}, (_, i) => [`n${i}`, note()])));
    await publishNotification(other, 'other', note());
    await inbox();
    await call(markNotificationsRead, me, {all: true});
    let page = await inbox();
    assert.equal(page.unreadCount, 0);
    do { assert.ok(page.entries.every(n => n.read)); page = page.nextCursor ? await inbox(page.nextCursor) : null; } while (page);
    assert.equal((await inbox(null, other)).unreadCount, 1);
    await drainNotificationReads(me);
    assert.equal(await read(`notificationCounts/${me}/pendingReads`), null);
    assert.ok(Object.values(await read(`notifications/${me}`)).every(n => n.readAt > 0));
    await publishNotification(me, 'after-all', note(5000));
    assert.equal((await inbox()).unreadCount, 1);
  });

  await test('A failed read projection keeps a durable read intent and counts, then worker repairs it once', async () => {
    await fresh(); await publishNotification(me, 'read-recovery', note());
    const original = adminDb.ref; let injected = false;
    adminDb.ref = function(path) {
      const ref = original.call(this, path);
      if (path === `notifications/${me}/read-recovery`) {
        ref.transaction = async () => { injected = true; throw new Error('injected-read'); };
      }
      return ref;
    };
    try { await assert.rejects(call(markNotificationsRead, me, {ids: ['read-recovery']}), /injected-read/); }
    finally { adminDb.ref = original; }
    assert.ok(injected);
    const before = await inbox(); assert.equal(before.unreadCount, 0); assert.equal(before.entries[0].read, true);
    assert.ok(await read(`notificationCounts/${me}/pendingReads/read-recovery`));
    await runCommunityMaintenance();
    const timestamp = await read(`notifications/${me}/read-recovery/readAt`); assert.ok(timestamp > 0);
    await call(markNotificationsRead, me, {ids: ['read-recovery']});
    assert.equal(await read(`notifications/${me}/read-recovery/readAt`), timestamp);
  });

  await test('Notifications validate destinations, cursor ownership and mutually exclusive all/ids requests', async () => {
    await fresh();
    await assert.rejects(publishNotification(me, 'bad', {...note(), targetType: 'Login'}), /Invalid notification/);
    await adminDb.ref(`notifications/${me}`).set(Object.fromEntries(Array.from({length: 30}, (_, i) => [`n${i}`, note()])));
    const first = await inbox();
    await assert.rejects(inbox(first.nextCursor, other), {code: 'permission-denied'});
    for (const data of [{ids: [], all: true}, {all: false}, {all: true, uid: other}]) {
      await assert.rejects(call(markNotificationsRead, me, data), {code: 'invalid-argument'});
    }
    await assert.rejects(call(getNotifications, null), {code: 'unauthenticated'});
    await adminAuth.updateUser(me, {disabled: true});
    await assert.rejects(inbox(), {code: 'permission-denied'});
  });

  await test('Practice milestone notification is frozen at unlock and retry neither duplicates it nor rewards extra coins', async () => {
    await fresh();
    await adminDb.ref(`learningProgress/${me}/vocabulary_daily_life`).set({completedAttempts: 19});
    const {attempt} = await call(startAttempt, me, {mode: 'PRACTICE', topicId: 'vocabulary_daily_life', requestId: randomUUID()});
    const at = Date.now();
    const answers = Object.fromEntries(attempt.questions.map((q, ordinal) => [ordinal, {
      questionId: q.id, selectedOptionId: seed.questionAnswers[q.id][q.version].correctOptionId,
      isCorrect: true, timedOut: false, ordinal, requestId: randomUUID(), receivedAt: at,
    }]));
    await adminDb.ref(`practiceAttempts/${me}/${attempt.id}`).update({status: 'waiting', currentIndex: 9,
      answers, answerStateVersion: 1, correctCount: 10, answeredCount: 10, finishedAt: at});
    await call(getAttemptResult, me, {attemptId: attempt.id});
    const original = await inbox(); assert.equal(original.totalCount, 1);
    assert.equal(original.entries[0].destination, 'Achievements');
    await call(markNotificationsRead, me, {all: true});
    await Promise.all(Array.from({length: 8}, () => call(getAttemptResult, me, {attemptId: attempt.id})));
    assert.equal((await inbox()).totalCount, 1); assert.equal((await inbox()).unreadCount, 0);
    assert.equal(await read(`wallets/${me}/coinBalance`), 1);
    assert.equal(await read(`learningProgress/${me}/vocabulary_daily_life/completedAttempts`), 20);
  });

  await test('Expired ranking snapshots and cursors are cleaned without touching live snapshots', async () => {
    await fresh(30); const first = await board();
    const token = await read(`communityCursors/${first.nextCursor}`);
    await clockAt(token.expiresAt + 1, () => runCommunityMaintenance());
    assert.equal(await read(`communityCursors/${first.nextCursor}`), null);
    assert.equal(await read(`communityRankings/${token.data.snapshotId}`), null);
    assert.equal((await board()).entries.length, 25);
  });

  await test('One account inbox failure does not block ranking bootstrap or other account read recovery', async () => {
    await fresh(30);
    const original = adminDb.ref;
    let injected = false;
    adminDb.ref = function(path) {
      const ref = original.call(this, path);
      if (path === `notificationCounts/${me}/pendingReads`) {
        ref.get = async () => { injected = true; throw new Error('injected-inbox'); };
      }
      return ref;
    };
    try { await runCommunityMaintenance(); } finally { adminDb.ref = original; }
    assert.ok(injected);
    assert.equal(await read('communityMaintenance/discovery/ready'), true);
    assert.equal((await board()).entries.length, 25);
  });

  await test('Independent backends share ranking cursors and the same account unread/read state', async () => {
    await fresh(40);
    await runCommunityMaintenance();
    await publishNotification(me, 'cross-backend', note());
    const actors = await Promise.all([startBackend(), startBackend()]);
    const user = {uid: me, sid: randomUUID()};
    try {
      const first = (await actors[0].call('getLeaderboard', user, {period: 'week'})).page;
      const second = (await actors[1].call('getLeaderboard', user, {period: 'week', cursor: first.nextCursor})).page;
      assert.equal(new Set([...first.entries, ...second.entries].map(e => e.uid)).size, 42);
      await actors[0].call('markNotificationsRead', user, {all: true});
      const feed = (await actors[1].call('getNotifications', user)).page;
      assert.equal(feed.unreadCount, 0); assert.equal(feed.entries[0].read, true);
    } finally { await Promise.all(actors.map(actor => actor.close())); }
  });

  await test('A delayed public rating projection cannot overwrite a newer settlement sequence', async () => {
    await fresh();
    const original = adminDb.ref;
    let release, arrived, intercepted = false;
    const pause = new Promise(resolve => { release = resolve; });
    const reached = new Promise(resolve => { arrived = resolve; });
    adminDb.ref = function(path) {
      const ref = original.call(this, path);
      if (path === `leaderboardPlayers/${me}`) {
        const transaction = ref.transaction.bind(ref);
        ref.transaction = async (...args) => {
          if (!intercepted) { intercepted = true; arrived(); await pause; }
          return transaction(...args);
        };
      }
      return ref;
    };
    const old = syncLeaderboardPlayer(me);
    try {
      await reached;
      await adminDb.ref(`userStats/${me}`).update({rating: 20, battleStatsSequence: 4, updatedAt: Date.now()});
      await syncLeaderboardPlayer(me);
    } finally { release(); try { await old; } finally { adminDb.ref = original; } }
    assert.equal(await read(`leaderboardPlayers/${me}/rating`), 20);
    assert.equal(await read(`leaderboardPlayers/${me}/sequence`), 4);
  });
  await test('Two backends can concurrently read a full batch of fifty without losing counters or pending work', async () => {
    await fresh();
    const ids = Array.from({length: 50}, (_, i) => `batch_${i}`);
    await adminDb.ref(`notifications/${me}`).set(Object.fromEntries(ids.map(id => [id, note()])));
    await inbox();
    const actors = await Promise.all([startBackend(), startBackend()]);
    try {
      await Promise.all(actors.map(actor => actor.call('markNotificationsRead', {uid: me, sid: randomUUID()}, {ids})));
      const feed = await inbox();
      assert.equal(feed.totalCount, 50); assert.equal(feed.unreadCount, 0);
      assert.equal(await read(`notificationCounts/${me}/pendingReads`), null);
      assert.ok(Object.values(await read(`notifications/${me}`)).every(n => n.readAt > 0));
    } finally { await Promise.all(actors.map(actor => actor.close())); }
  });
} finally { await deleteApp(adminDb.app); }
