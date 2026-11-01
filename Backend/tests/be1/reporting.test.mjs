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
const {getStudyStatistics, periodBounds} = require('./lib/be1/reporting/getStudyStatistics.js');
const {getHistory} = require('./lib/be1/reporting/getHistory.js');
const {getCoinLedger} = require('./lib/be1/reporting/getCoinLedger.js');
const {getUserDashboard} = require('./lib/be1/user/getUserDashboard.js');
const {studyDuration, durationDays} = require('./lib/be1/reporting/duration.js');
const {projectActivity, projectLearningActivity, studyStreak} = require('./lib/be1/reporting/activity.js');
const {backfillReporting, runReportingMaintenance} = require('./lib/be1/reporting/maintenance.js');
const {startAttempt} = require('./lib/be1/practice/startAttempt.js');
const {getAttemptResult} = require('./lib/be1/practice/getAttemptResult.js');
const {applyBattleAction} = require('./lib/be1/battle/battleState.js');
const {settleBattle} = require('./lib/be1/battle/battleSettlement.js');
const {selectQuestions} = require('./lib/be1/practice/startAttempt.js');
const Ajv = require('ajv');
const ajv = new Ajv({strict: false});
const seed = JSON.parse(readFileSync(new URL('../../database/english-battle.seed.json', import.meta.url), 'utf8'));
assert.match(adminDb.ref().toString(), /^http:\/\/127\.0\.0\.1:9100\//);
const test = (name, run) => nodeTest(name, {timeout: 60000}, run);
const read = async path => (await adminDb.ref(path).get()).val();
const call = async (fn, uid, data = {}) => fn.run({auth: uid ? {uid} : undefined, data});
const checked = async (name, fn, uid, data = {}) => {
  const value = await call(fn, uid, data);
  const check = ajv.compile(mobileContract.methods[name].response);
  assert.ok(check(value), JSON.stringify(check.errors));
  return value;
};
const clockAt = async (time, run) => { const clock = Date.now; Date.now = () => time;
  try { return await run(); } finally { Date.now = clock; } };
let me, other;
const fresh = async () => {
  await adminDb.ref().set(seed);
  const ids = [];
  for (let i = 0; i < 2; i++) {
    const user = await adminAuth.createUser({email: `report-${randomUUID()}@example.test`});
    await call(ensureUserProfile, user.uid); ids.push(user.uid);
  }
  [me, other] = ids;
};
const legacy = (at, correct = 7, total = 10) => ({mode: 'practice', status: 'completed',
  questionCount: total, correctCount: correct, coinsAwarded: 1, finishedAt: at});
const event = (id, at, correct = 7, total = 10, durationMs = 60000) => ({attemptId: id,
  mode: 'PRACTICE', correct, total, coins: 1, ratingDelta: 0, outcome: 'completed',
  completedAt: at, reviews: [], opponentName: '', opponentCorrect: 0, durationMs});

try {
  const ns = new URL(adminDb.app.options.databaseURL).hostname.split('.')[0];
  const rules = await fetch(`http://127.0.0.1:9100/.settings/rules.json?ns=${ns}`, {
    method: 'PUT', headers: {Authorization: 'Bearer owner', 'Content-Type': 'application/json'},
    body: readFileSync(new URL('../../../database.rules.json', import.meta.url), 'utf8')});
  assert.equal(rules.status, 200);

  await test('Calendar boundaries use Vietnam midnight, Monday, leap February and previous calendar month', async () => {
    let bounds = periodBounds('week', Date.parse('2026-11-01T16:59:59Z'));
    assert.equal(bounds.from, '2026-10-26'); assert.equal(bounds.to, '2026-11-02');
    bounds = periodBounds('week', Date.parse('2026-11-01T17:00:00Z'));
    assert.equal(bounds.from, '2026-11-02'); assert.equal(bounds.previousFrom, '2026-10-26');
    bounds = periodBounds('month', Date.parse('2028-03-01T00:00:00+07:00'));
    assert.equal(bounds.previousFrom, '2028-02-01'); assert.equal(bounds.previousTo, '2028-03-01');
    bounds = periodBounds('month', Date.parse('2027-01-01T00:00:00+07:00'));
    assert.equal(bounds.previousFrom, '2026-12-01'); assert.equal(bounds.to, '2027-02-01');
  });

  await test('Study time counts submitted/timeout windows, excludes review pauses and splits midnight precisely', async () => {
    const start = Date.parse('2026-11-01T23:59:50+07:00');
    const timings = {0: {openedAt: start, deadlineAt: start + 30000},
      1: {openedAt: start + 120000, deadlineAt: start + 150000}};
    const answers = {0: {receivedAt: start + 20000}, 1: {receivedAt: start + 150000}};
    assert.equal(studyDuration({currentIndex: 1}, answers, timings, start + 900000), 50000);
    assert.deepEqual(durationDays({currentIndex: 1}, answers, timings, start + 900000),
      {'2026-11-01': 10000, '2026-11-02': 40000});
    assert.equal(studyDuration({currentIndex: 1}, answers, {}, start + 900000), null);
    assert.equal(studyDuration({currentIndex: 0, status: 'abandoned'}, {}, {0: timings[0]}, start + 5000), 5000);
    assert.equal(studyDuration({status: 'ready'}, {}, {}, start), 0);
  });

  await test('Statistics include more than 100 legacy results, weight questions and report unknown old durations', async () => {
    await fresh();
    const now = Date.parse('2027-01-06T12:00:00+07:00');
    const current = Date.parse('2027-01-05T12:00:00+07:00');
    const previous = Date.parse('2026-12-29T12:00:00+07:00');
    const values = Object.fromEntries(Array.from({length: 125}, (_, i) => [`n_${i}`, legacy(current + i)]));
    values.previous_a = legacy(previous, 2, 20); values.previous_b = legacy(previous, 9, 10);
    await adminDb.ref(`practiceAttempts/${me}`).set(values);
    await clockAt(now, async () => {
      await assert.rejects(call(getStudyStatistics, me, {period: 'week'}), {code: 'unavailable'});
      const {statistics: s} = await checked('getStudyStatistics', getStudyStatistics, me, {period: 'week'});
      assert.equal(s.current.sessions, 125); assert.equal(s.current.answered, 1250); assert.equal(s.current.correct, 875);
      assert.equal(s.current.unknownDurationSessions, 125); assert.equal(s.current.durationMs, 0);
      assert.equal(s.previous.sessions, 2); assert.equal(s.previous.answered, 30); assert.equal(s.previous.correct, 11);
      assert.ok(Math.abs(s.accuracyDelta - (70 - 1100 / 30)) < 1e-8);
      assert.equal(s.days.length, 7); assert.equal(s.streak, 1);
    });
  });

  await test('Daily activity applies each event once under concurrency and allocates minutes across two periods', async () => {
    await fresh();
    const at = Date.parse('2026-11-02T00:00:10+07:00');
    const summary = event('cross-midnight', at, 1, 1, 20000);
    await Promise.all(Array.from({length: 12}, () => projectActivity(me, summary, 1,
      {vocabulary: {answered: 1, correct: 1}}, {'2026-11-01': 10000, '2026-11-02': 10000})));
    assert.equal((await read(`userActivityDaily/${me}/2026-11-01`)).durationMs, 10000);
    assert.equal((await read(`userActivityDaily/${me}/2026-11-01`)).sessions, 0);
    assert.equal((await read(`userActivityDaily/${me}/2026-11-02`)).durationMs, 10000);
    await clockAt(at + 60000, async () => {
      const {statistics: s} = await checked('getStudyStatistics', getStudyStatistics, me, {period: 'week'});
      assert.equal(s.current.durationMs, 10000); assert.equal(s.previous.durationMs, 10000);
      assert.equal(s.current.sessions, 1); assert.equal(s.previous.sessions, 0);
      assert.equal(s.accuracyDelta, null); assert.equal(s.streak, 2);
    });
  });

  await test('Learning finalization returns measured time and interrupted activity projection is recoverable without duplicate rewards', async () => {
    await fresh();
    const {attempt} = await call(startAttempt, me, {mode: 'PRACTICE', topicId: 'vocabulary_daily_life', requestId: randomUUID()});
    const start = Date.now() - 90000;
    const answers = {}, timings = {};
    for (let i = 0; i < 10; i++) {
      const q = attempt.questions[i]; const open = start + i * 6000;
      timings[i] = {openedAt: open, deadlineAt: open + 30000};
      answers[i] = {questionId: q.id, selectedOptionId: seed.questionAnswers[q.id][q.version].correctOptionId,
        isCorrect: true, timedOut: false, ordinal: i, requestId: randomUUID(), receivedAt: open + 5000};
    }
    await adminDb.ref(`practiceAttempts/${me}/${attempt.id}`).update({status: 'waiting', currentIndex: 9,
      answers, questionTimings: timings, answerStateVersion: 1, correctCount: 10, answeredCount: 10, finishedAt: start + 59000});
    const original = adminDb.ref; let injected = false;
    adminDb.ref = function(path) { const ref = original.call(this, path);
      if (path === `userActivityDaily/${me}/${new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Ho_Chi_Minh'}).format(start + 59000)}`) {
        ref.transaction = async () => { injected = true; throw new Error('injected-activity'); };
      } return ref; };
    try { await assert.rejects(call(getAttemptResult, me, {attemptId: attempt.id}), {code: 'internal'}); }
    finally { adminDb.ref = original; }
    assert.ok(injected); assert.notEqual(await read(`practiceAttempts/${me}/${attempt.id}/settlementVersion`), 1);
    const {result} = await checked('getAttemptResult', getAttemptResult, me, {attemptId: attempt.id});
    assert.equal(result.durationMs, 50000);
    await Promise.all(Array.from({length: 6}, () => call(getAttemptResult, me, {attemptId: attempt.id})));
    assert.equal(await read(`wallets/${me}/coinBalance`), 1);
    const {statistics: s} = await checked('getStudyStatistics', getStudyStatistics, me, {period: 'month'});
    assert.equal(s.current.sessions, 1); assert.equal(s.current.correct, 10); assert.equal(s.current.durationMs, 50000);
  });

  await test('Battle question timing excludes waiting for the other player and settlement replays preserve minutes', async () => {
    await fresh(); const questions = await selectQuestions('BATTLE', null); const start = Date.now() - 90000;
    const keys = Object.fromEntries(questions.map(q => [q.id, seed.questionAnswers[q.id][q.version]]));
    const match = {id: `battle_${randomUUID()}`, kind: 'quick', status: 'ready', players: {
      [me]: {name: 'Me', clientSessionId: 'one', lastSeenAt: start},
      [other]: {name: 'Other', clientSessionId: 'two', lastSeenAt: start}},
    questions, keys, currentIndex: 0, createdAt: start, readyDeadlineAt: start + 20000, openedAt: 0, deadlineAt: 0};
    applyBattleAction(match, me, 'one', {type: 'resume'}, start);
    applyBattleAction(match, other, 'two', {type: 'resume'}, start);
    for (let i = 0; i < 10; i++) {
      applyBattleAction(match, me, 'one', {type: 'submit', questionId: questions[i].id,
        optionId: keys[questions[i].id].correctOptionId, requestId: `a${i}`}, start + i * 7000 + 1000);
      applyBattleAction(match, other, 'two', {type: 'submit', questionId: questions[i].id,
        optionId: keys[questions[i].id].correctOptionId, requestId: `b${i}`}, start + i * 7000 + 7000);
    }
    assert.equal(match.status, 'completed'); assert.equal(Object.keys(match.questionTimings).length, 10);
    await adminDb.ref(`battleRooms/${match.id}`).set(match); await settleBattle(match.id);
    assert.equal(await read(`battleReviews/${match.id}/${me}/durationMs`), 10000);
    assert.equal(await read(`battleReviews/${match.id}/${other}/durationMs`), 70000);
    await settleBattle(match.id, true); await backfillReporting(me, 4);
    const {statistics: s} = await checked('getStudyStatistics', getStudyStatistics, me, {period: 'month'});
    assert.equal(s.current.sessions, 1); assert.equal(s.current.durationMs, 10000); assert.equal(s.current.answered, 10);
  });

  await test('History and coin ledger paginate all equal-timestamp numeric keys, skip invalid rows and bind cursors to owner/type', async () => {
    await fresh(); const at = Date.now() - 60000;
    const values = Object.fromEntries(Array.from({length: 83}, (_, i) => [String(i), legacy(at)]));
    values.invalid = {...legacy(at + 1000), status: 'active'};
    await adminDb.ref(`practiceAttempts/${me}`).set(values);
    const ledger = Object.fromEntries(Array.from({length: 83}, (_, i) => [String(i), {label: 'Earned', delta: i % 2 ? -1 : 1, createdAt: at}]));
    ledger.invalid = {label: '', delta: 1, createdAt: at + 1000};
    await adminDb.ref(`coinLedger/${me}`).set(ledger);
    let first = (await checked('getHistory', getHistory, me, {kind: 'learning'})).page;
    assert.equal(first.entries.length, 25);
    await assert.rejects(call(getHistory, other, {kind: 'learning', cursor: first.nextCursor}), {code: 'permission-denied'});
    await assert.rejects(call(getHistory, me, {kind: 'battle', cursor: first.nextCursor}), {code: 'permission-denied'});
    await assert.rejects(call(getCoinLedger, me, {cursor: first.nextCursor}), {code: 'permission-denied'});
    const ids = []; let page = first;
    do { ids.push(...page.entries.map(x => x.attemptId)); page = page.nextCursor ? (await checked('getHistory', getHistory, me, {kind: 'learning', cursor: page.nextCursor})).page : null; } while (page);
    assert.deepEqual(ids, Array.from({length: 83}, (_, i) => String(82 - i))); assert.equal(new Set(ids).size, 83);
    page = (await checked('getCoinLedger', getCoinLedger, me)).page; const ledgerIds = [];
    do { ledgerIds.push(...page.entries.map(x => x.id)); page = page.nextCursor ? (await checked('getCoinLedger', getCoinLedger, me, {cursor: page.nextCursor})).page : null; } while (page);
    assert.deepEqual(ledgerIds, ids);
    const cursor = await read(`communityCursors/${first.nextCursor}`);
    await clockAt(cursor.expiresAt, () => assert.rejects(call(getHistory, me, {kind: 'learning', cursor: first.nextCursor}), {code: 'failed-precondition'}));
  });

  await test('Statistics and history enforce Auth/access and reject client ownership/timing fields', async () => {
    await fresh();
    for (const [fn, data] of [[getStudyStatistics, {period: 'week'}], [getHistory, {kind: 'learning'}], [getCoinLedger, {}]]) {
      await assert.rejects(call(fn, null, data), {code: 'unauthenticated'});
      await assert.rejects(call(fn, me, {...data, uid: other}), {code: 'invalid-argument'});
    }
    await assert.rejects(call(getStudyStatistics, me, {period: 'year'}), {code: 'invalid-argument'});
    await adminDb.ref(`accountAccess/${me}/status`).set('banned');
    await assert.rejects(call(getStudyStatistics, me, {period: 'month'}), {code: 'permission-denied'});
    await assert.rejects(call(getHistory, me, {kind: 'battle'}), {code: 'permission-denied'});
  });

  await test('Streak crosses monthly pages, allows yesterday and breaks on a missing day', async () => {
    await fresh(); const today = '2027-02-10'; const start = Date.parse('2027-02-09T00:00:00Z');
    await adminDb.ref(`studyActiveDays/${me}`).set(Object.fromEntries(Array.from({length: 65}, (_, i) =>
      [new Date(start - i * 86400000).toISOString().slice(0, 10), true])));
    assert.equal(await studyStreak(me, today), 65);
    await adminDb.ref(`studyActiveDays/${me}/2027-02-08`).remove();
    assert.equal(await studyStreak(me, today), 1);
  });

  await test('Versioned rebuild repairs earlier partial aggregates without changing source results or rewards', async () => {
    await fresh(); const at = Date.now() - 60000;
    const day = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Ho_Chi_Minh'}).format(at);
    const entry = event('old-view', at, 8, 10, null);
    await adminDb.ref(`practiceAttempts/${me}/old-view`).set(legacy(at, 8));
    await adminDb.ref(`studyActivities/${me}/learning_old-view`).set({entry, answered: 0, version: 1});
    await adminDb.ref(`userActivityDaily/${me}/${day}`).set({sessions: 1, answered: 0, correct: 0,
      durationMs: 0, unknownDurationSessions: 1, appliedEvents: {'learning_old-view': true}});
    await adminDb.ref(`reportingBackfill/${me}`).set({ready: true});
    let response = await checked('getStudyStatistics', getStudyStatistics, me, {period: 'month'});
    assert.equal(response.statistics.current.sessions, 1); assert.equal(response.statistics.current.answered, 10);
    assert.equal(response.statistics.current.correct, 8); assert.equal(response.statistics.current.unknownDurationSessions, 1);
    assert.equal(await read(`reportingBackfill/${me}/version`), 3);
    assert.equal(await read(`studyActivities/${me}/learning_old-view/version`), 3);
    assert.equal(await read(`wallets/${me}/coinBalance`), 0);
    const saved = await read(`practiceAttempts/${me}/old-view`);
    await Promise.all(Array.from({length: 6}, () => projectLearningActivity(me, 'old-view', saved)));
    response = await checked('getStudyStatistics', getStudyStatistics, me, {period: 'month'});
    assert.equal(response.statistics.current.answered, 10); assert.equal(response.statistics.current.correct, 8);
    assert.equal(await read(`practiceAttempts/${me}/old-view/correctCount`), 8);
  });

  await test('Completed legacy practice with incomplete answer cache keeps its full score and known single-skill totals', async () => {
    await fresh(); const at = Date.now() - 60000;
    const raw = {...legacy(at, 8), answers: {0: {isCorrect: true, receivedAt: at}}};
    await adminDb.ref(`practiceAttempts/${me}/partial-cache`).set(raw);
    await adminDb.ref(`attemptQuestions/${me}/partial-cache`).set(Object.fromEntries(Array.from({length: 10}, (_, i) =>
      [i, {categoryId: 'vocabulary', openedAt: at - 10000, deadlineAt: at + 20000}])));
    const {statistics: s} = await checked('getStudyStatistics', getStudyStatistics, me, {period: 'month'});
    assert.equal(s.current.answered, 10); assert.equal(s.current.correct, 8);
    assert.deepEqual(s.current.skills.vocabulary, {answered: 10, correct: 8});
    assert.equal(s.current.durationMs, 0); assert.equal(s.current.unknownDurationSessions, 1);
  });

  await test('A partial timing array recovers missing windows from question snapshots without counting review pauses', async () => {
    await fresh(); const at = Date.now() - 60000;
    const timings = [{openedAt: at, deadlineAt: at + 30000},
      {openedAt: at + 40000, deadlineAt: at + 70000}];
    const raw = {...legacy(at + 43000, 2, 2), currentIndex: 1,
      answers: [{isCorrect: true, receivedAt: at + 2000}, {isCorrect: true, receivedAt: at + 43000}],
      questionTimings: [null, timings[1]]};
    await adminDb.ref(`practiceAttempts/${me}/timing-gap`).set(raw);
    await adminDb.ref(`attemptQuestions/${me}/timing-gap`).set(timings.map(t => ({...t, categoryId: 'vocabulary'})));
    const {statistics: s} = await checked('getStudyStatistics', getStudyStatistics, me, {period: 'month'});
    assert.equal(s.current.durationMs, 5000); assert.equal(s.current.unknownDurationSessions, 0);
    assert.equal(await read(`practiceAttempts/${me}/timing-gap/durationMs`), 5000);
  });

  await test('Rebuilding a shifted duration retracts the obsolete active day in both streak and dashboard', async () => {
    await fresh(); const at = Date.parse('2027-01-06T00:00:10+07:00');
    const entry = {...event('shifted-day', at, 0, 10, 20000), outcome: 'abandoned', coins: 0};
    await adminDb.ref(`studyActivities/${me}/learning_shifted-day`).set({entry, answered: 0, version: 2,
      durationByDay: {'2027-01-06': 20000}});
    await adminDb.ref(`userActivityDaily/${me}/2027-01-06`).set({sessions: 0, answered: 0, correct: 0,
      durationMs: 20000, unknownDurationSessions: 0, appliedEvents: {'learning_shifted-day': 2}});
    await adminDb.ref(`studyActiveDays/${me}/2027-01-06`).set(true);
    const original = adminDb.ref;
    adminDb.ref = function(path) {
      const ref = original.call(this, path);
      if (path === `studyActiveDays/${me}/2027-01-06`) {
        ref.transaction = async () => { throw new Error('injected-day-flag'); };
      }
      return ref;
    };
    try { await assert.rejects(projectActivity(me, entry, 0, {}, {'2027-01-05': 20000}), /injected-day-flag/); }
    finally { adminDb.ref = original; }
    await projectActivity(me, entry, 0, {}, {'2027-01-05': 20000});
    assert.equal((await read(`userActivityDaily/${me}/2027-01-05`)).durationMs, 20000);
    assert.equal((await read(`studyActiveDays/${me}/2027-01-06`)).active, false);
    assert.equal((await read(`studyActiveDays/${me}/2027-01-05`)).active, true);
    assert.equal(await studyStreak(me, '2027-01-06'), 1);
    await clockAt(at + 3600000, async () => {
      const d = (await checked('getUserDashboard', getUserDashboard, me)).dashboard;
      assert.deepEqual(d.studyDates, ['2027-01-05']); assert.equal(d.studyStreak, 1);
    });
  });

  await test('A delayed inactive-day projection cannot overwrite a newer day with real study activity', async () => {
    await fresh(); const at = Date.now() - 60000;
    const day = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Ho_Chi_Minh'}).format(at);
    let release, arrived, intercepted = false;
    const pause = new Promise(resolve => { release = resolve; });
    const reached = new Promise(resolve => { arrived = resolve; });
    const original = adminDb.ref;
    adminDb.ref = function(path) {
      const ref = original.call(this, path);
      if (path === `studyActiveDays/${me}/${day}`) {
        const transaction = ref.transaction.bind(ref);
        ref.transaction = async (...args) => {
          if (!intercepted) { intercepted = true; arrived(); await pause; }
          return transaction(...args);
        };
      }
      return ref;
    };
    const old = projectActivity(me, {...event('older-empty', at, 0, 10, 0), outcome: 'abandoned'}, 0, {});
    try {
      await reached;
      await projectActivity(me, event('newer-study', at, 1, 1, 1000), 1, {});
    } finally { release(); try { await old; } finally { adminDb.ref = original; } }
    const flag = await read(`studyActiveDays/${me}/${day}`);
    assert.equal(flag.active, true); assert.equal(flag.revision, 2);
    assert.equal(await studyStreak(me, day), 1);
  });

  await test('An interrupted chain of two old view versions is subtracted from its actually applied version and date', async () => {
    await fresh(); const at = Date.parse('2027-01-06T00:00:10+07:00');
    const entry = {...event('version-chain', at, 0, 10, 30000), outcome: 'abandoned', coins: 0};
    const first = {entry: {...entry, durationMs: 20000}, answered: 0, version: 1,
      durationByDay: {'2027-01-04': 20000}};
    await adminDb.ref(`studyActivities/${me}/learning_version-chain`).set({entry, answered: 0,
      version: 2, durationByDay: {'2027-01-05': 30000}, previous: first});
    await adminDb.ref(`userActivityDaily/${me}/2027-01-04`).set({sessions: 0, answered: 0, correct: 0,
      durationMs: 20000, unknownDurationSessions: 0, appliedEvents: {'learning_version-chain': true}});
    await adminDb.ref(`studyActiveDays/${me}/2027-01-04`).set(true);
    await Promise.all(Array.from({length: 6}, () => projectActivity(me, entry, 0, {}, {'2027-01-05': 30000})));
    assert.equal((await read(`userActivityDaily/${me}/2027-01-04`)).durationMs, 0);
    assert.equal((await read(`userActivityDaily/${me}/2027-01-05`)).durationMs, 30000);
    assert.equal((await read(`studyActiveDays/${me}/2027-01-04`)).active, false);
    assert.equal(await studyStreak(me, '2027-01-06'), 1);
  });

  await test('Historical battle duration is reconstructed from trusted room timings when its summary lacks duration', async () => {
    await fresh(); const at = Date.now() - 60000;
    const id = `battle_${randomUUID()}`;
    const questions = await selectQuestions('BATTLE', null);
    await adminDb.ref(`battleHistory/${me}/${id}`).set({...event(id, at + 8000, 1, 10, null),
      mode: 'BATTLE', outcome: 'left', coins: 0, finishedAt: at + 8000});
    await adminDb.ref(`battleRooms/${id}`).set({id, kind: 'quick', status: 'completed', currentIndex: 0,
      openedAt: at, deadlineAt: at + 30000, questionTimings: {0: {openedAt: at, deadlineAt: at + 30000}},
      questions, players: {[me]: {name: 'Me', lastSeenAt: at + 5000, leftAt: at + 5000,
        answers: {0: {isCorrect: true, receivedAt: at + 5000}}}, [other]: {name: 'Other', lastSeenAt: at + 8000}},
      finish: {at: at + 8000, outcomes: {[me]: 'left', [other]: 'win'}}});
    const {statistics: s} = await checked('getStudyStatistics', getStudyStatistics, me, {period: 'month'});
    assert.equal(s.current.durationMs, 5000); assert.equal(s.current.unknownDurationSessions, 0);
    assert.equal(s.current.answered, 1); assert.equal(s.current.correct, 1);
    const {page} = await checked('getHistory', getHistory, me, {kind: 'battle'});
    assert.equal(page.entries[0].durationMs, 5000);
  });

  await test('Independent backends share pagination cursors and maintenance resumes partial backfill', async () => {
    await fresh(); const at = Date.now() - 60000;
    await adminDb.ref(`practiceAttempts/${me}`).set(Object.fromEntries(Array.from({length: 30}, (_, i) => [`p_${i}`, legacy(at)])));
    assert.equal(await backfillReporting(me), false);
    const actors = await Promise.all([startBackend(), startBackend()]);
    try {
      const first = (await actors[0].call('getHistory', {uid: me}, {kind: 'learning'})).page;
      const second = (await actors[1].call('getHistory', {uid: me}, {kind: 'learning', cursor: first.nextCursor})).page;
      assert.equal(new Set([...first.entries, ...second.entries].map(e => e.attemptId)).size, 30);
      for (let i = 0; i < 4 && !(await read(`reportingBackfill/${me}/ready`)); i++) await runReportingMaintenance();
      assert.equal(await read(`reportingBackfill/${me}/ready`), true);
      assert.equal(Object.keys(await read(`studyActivities/${me}`)).length, 30);
    } finally { await Promise.all(actors.map(a => a.close())); }
  });
} finally { await deleteApp(adminDb.app); }
