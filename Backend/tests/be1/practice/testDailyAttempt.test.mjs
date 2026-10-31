import assert from "node:assert/strict";
import {test} from "node:test";
import {randomUUID} from "node:crypto";
import {createRequire} from "node:module";
import {mobileContract, assertAttemptSemantics} from "../../../../frontend/contracts/mobile.v1.mjs";

// Every read/write in this suite is confined to the local Emulator Suite.
process.env.FIREBASE_DATABASE_EMULATOR_HOST = "127.0.0.1:9000";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.GCLOUD_PROJECT = "englishbattleapp-8d764";
const require = createRequire(new URL("../../../functions/package.json", import.meta.url));
const Ajv = require("ajv");
const ajv = new Ajv({strict: false});
const validators = Object.fromEntries(Object.entries(mobileContract.methods)
  .map(([name, method]) => [name, ajv.compile(method.response)]));
const {getDateKey, dailyEndsAt, isDailyExpired, ensureQuestionDeadline} =
  require("./lib/be1/practice/attemptHelper.js");
const {expireDailyAttemptsLogic} = require("./lib/be1/practice/expireDailyAttempts.js");
const {getApp, deleteApp} = require("firebase-admin/app");
const fnBase = "http://127.0.0.1:5001/englishbattleapp-8d764/asia-southeast1";
const dbBase = "http://127.0.0.1:9000";
const dbQuery = "?ns=englishbattleapp-8d764-default-rtdb&access_token=owner";

async function db(path, value, method = "PUT") {
  const response = await fetch(`${dbBase}/${path}.json${dbQuery}`, value === undefined ? {} : {
    method, headers: {"Content-Type": "application/json"}, body: JSON.stringify(value),
  });
  assert.ok(response.ok, `Emulator database ${path}: ${response.status}`);
  return response.json();
}

async function call(name, user, data = {}) {
  const response = await fetch(`${fnBase}/${name}`, {
    method: "POST", headers: {"Content-Type": "application/json",
      ...(user ? {Authorization: `Bearer ${user.idToken}`} : {})},
    body: JSON.stringify({data}),
  });
  const body = await response.json();
  if (response.ok) {
    assert.ok(validators[name](body.result), `${name}: ${JSON.stringify(validators[name].errors)}`);
    if (body.result.attempt) assertAttemptSemantics(body.result.attempt);
  }
  return {status: response.status, body: body.result, error: body.error};
}

async function ok(name, user, data = {}) {
  const response = await call(name, user, data);
  assert.equal(response.status, 200, `${name}: ${JSON.stringify(response.error)}`);
  return response.body;
}

async function user() {
  const response = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key", {
    method: "POST", headers: {"Content-Type": "application/json"},
    body: JSON.stringify({email: `be1-07-${randomUUID()}@example.com`,
      password: "TestOnly123!", returnSecureToken: true}),
  });
  assert.equal(response.status, 200);
  const value = await response.json();
  await ok("ensureUserProfile", value);
  return value;
}

async function start(u, mode, requestId = randomUUID()) {
  return (await ok("startAttempt", u, {mode, requestId})).attempt;
}

async function finish(u, attempt) {
  const expected = {};
  for (let i = 0; i < attempt.questions.length; i++) {
    const q = attempt.questions[i];
    const answer = await db(`questionAnswers/${q.id}/${q.version}`);
    const picked = i % 3 === 0 ? q.options.find(o => o.id !== answer.correctOptionId).id : answer.correctOptionId;
    const counts = expected[q.categoryId] ||= {answered: 0, correct: 0};
    counts.answered++;
    if (picked === answer.correctOptionId) counts.correct++;
    await ok("submitAttemptAnswer", u, {attemptId: attempt.id, questionId: q.id,
      optionId: picked, requestId: randomUUID()});
    const advanced = await ok("advanceAttempt", u, {attemptId: attempt.id, requestId: randomUUID()});
    if (i === attempt.questions.length - 1) {
      assert.equal(advanced.attempt.status, "waiting");
      assert.equal(advanced.attempt.result, null);
    }
  }
  assert.equal(await db(`attemptReviews/${u.localId}/${attempt.id}`), null);
  return expected;
}

async function expireFixture(u, attempt, waiting = false) {
  const yesterday = Date.now() - 86400000;
  const oldKey = getDateKey(yesterday);
  const todayKey = getDateKey();
  const slot = await db(`userDailyChallenges/${u.localId}/${todayKey}`);
  const originalId = attempt.id;
  const oldId = `daily_${oldKey}`;
  const record = await db(`practiceAttempts/${u.localId}/${originalId}`);
  const questions = await db(`attemptQuestions/${u.localId}/${originalId}`);
  const answers = await db(`attemptAnswers/${u.localId}/${originalId}`);
  await db(`userDailyChallenges/${u.localId}/${todayKey}`, null);
  await db(`userDailyChallenges/${u.localId}/${oldKey}`, {...slot, attemptId: oldId, startedAt: yesterday});
  await db(`practiceAttempts/${u.localId}/${oldId}`, {...record,
    startedAt: yesterday, createdAt: yesterday, ...(waiting ? {status: "waiting"} : {}),
  });
  await db(`attemptQuestions/${u.localId}/${oldId}`, questions);
  if (answers) await db(`attemptAnswers/${u.localId}/${oldId}`, answers);
  await db(`operations/${u.localId}_start_${record.requestId}`, {attemptId: oldId}, "PATCH");
  await db(`practiceAttempts/${u.localId}/${originalId}`, null);
  await db(`attemptQuestions/${u.localId}/${originalId}`, null);
  await db(`attemptAnswers/${u.localId}/${originalId}`, null);
  attempt.id = oldId;
  return oldKey;
}

await test("TEST: 20 stable questions, auth/ownership, immutable reviews, mixed skills and exactly-once rewards", async () => {
  assert.equal((await call("startAttempt", null, {mode: "TEST", requestId: randomUUID()})).status, 401);
  const u = await user();
  const req = randomUUID();
  const a = await start(u, "TEST", req);
  const concurrentReq = randomUUID();
  const concurrentStarts = await Promise.all([start(u, "TEST", concurrentReq), start(u, "TEST", concurrentReq)]);
  assert.equal(concurrentStarts[0].id, concurrentStarts[1].id);
  assert.equal(a.questions.length, 20);
  assert.equal(new Set(a.questions.map(q => q.id)).size, 20);
  assert.equal(a.mode, "TEST");
  assert.equal(a.result, null);
  assert.ok(a.questions.every(q => q.correctId === undefined && q.explanation === undefined));
  const resumed = (await ok("resumeAttempt", u, {attemptId: a.id})).attempt;
  assert.deepEqual(resumed.questions, a.questions);
  assert.equal(resumed.deadlineAt, a.deadlineAt);
  assert.equal((await start(u, "TEST", req)).id, a.id);
  const other = await user();
  assert.equal((await call("resumeAttempt", other, {attemptId: a.id})).status, 404);
  assert.equal((await call("getAttemptResult", u, {attemptId: a.id})).status, 400);
  const expected = await finish(u, a);
  const results = await Promise.all(Array.from({length: 3}, () => ok("getAttemptResult", u, {attemptId: a.id})));
  const result = results[0].result;
  assert.equal(result.mode, "TEST");
  assert.equal(result.total, 20);
  assert.equal(result.correct, Object.values(expected).reduce((n, s) => n + s.correct, 0));
  assert.equal(result.coins, 2);
  assert.equal(result.reviews.length, 20);
  assert.deepEqual(results[1].result, result);
  const skills = await db(`userSkillStats/${u.localId}`);
  for (const [id, counts] of Object.entries(expected)) {
    assert.equal(skills[id].answeredCount, counts.answered);
    assert.equal(skills[id].correctCount, counts.correct);
  }
  assert.equal((await db(`wallets/${u.localId}`)).coinBalance, 2);
  assert.equal(Object.keys(await db(`coinLedger/${u.localId}`)).length, 1);
  assert.equal(await db(`learningProgress/${u.localId}`), null);
  const dashboard = (await ok("getUserDashboard", u)).dashboard;
  assert.equal(dashboard.history.find(h => h.attemptId === a.id).mode, "TEST");
});

await test("TEST: early timeout rejected, expired receipt has pickedId null, abandonment pays zero", async () => {
  const u = await user();
  const a = await start(u, "TEST");
  const data = {attemptId: a.id, questionId: a.questions[0].id, optionId: null, requestId: randomUUID()};
  assert.equal((await call("submitAttemptAnswer", u, data)).status, 400);
  await db(`attemptQuestions/${u.localId}/${a.id}/0/deadlineAt`, Date.now() - 1000);
  await ok("submitAttemptAnswer", u, data);
  const result = (await ok("leaveAttempt", u, {attemptId: a.id, requestId: randomUUID()})).attempt.result;
  assert.equal(result.outcome, "abandoned");
  assert.equal(result.coins, 0);
  assert.equal(result.reviews[0].pickedId, null);
  assert.equal((await db(`wallets/${u.localId}`)).coinBalance, 0);
});

await test("DAILY: concurrent request IDs converge, five questions persist, terminal slot cannot restart", async () => {
  const u = await user();
  const requests = Array.from({length: 5}, () => randomUUID());
  const attempts = await Promise.all(requests.map(id => start(u, "DAILY", id)));
  const a = attempts[0];
  assert.equal(new Set(attempts.map(attempt => attempt.id)).size, 1);
  assert.equal(a.questions.length, 5);
  for (const attempt of attempts) {
    assert.deepEqual(attempt.questions, a.questions);
    assert.equal(attempt.deadlineAt, a.deadlineAt);
  }
  assert.equal(Object.keys(await db(`practiceAttempts/${u.localId}`)).length, 1);
  const expected = await finish(u, a);
  // An old duplicate attempt that lost the UID/day slot cannot earn another reward.
  const duplicateId = `${a.id}_duplicate`;
  await db(`practiceAttempts/${u.localId}/${duplicateId}`, await db(`practiceAttempts/${u.localId}/${a.id}`));
  await db(`attemptQuestions/${u.localId}/${duplicateId}`, await db(`attemptQuestions/${u.localId}/${a.id}`));
  await db(`attemptAnswers/${u.localId}/${duplicateId}`, await db(`attemptAnswers/${u.localId}/${a.id}`));
  const duplicate = (await ok("getAttemptResult", u, {attemptId: duplicateId})).result;
  assert.equal(duplicate.outcome, "abandoned");
  assert.equal(duplicate.coins, 0);
  const result = (await ok("getAttemptResult", u, {attemptId: a.id})).result;
  assert.equal(result.mode, "DAILY");
  assert.equal(result.coins, 2);
  assert.equal(result.reviews.length, 5);
  assert.equal(result.correct, Object.values(expected).reduce((n, counts) => n + counts.correct, 0));
  const replay = await start(u, "DAILY", requests[0]);
  assert.deepEqual(replay.result, result);
  assert.equal((await call("startAttempt", u, {mode: "DAILY", requestId: randomUUID()})).status, 409);
  const slot = await db(`userDailyChallenges/${u.localId}/${getDateKey()}`);
  assert.equal(slot.status, "completed");
  assert.equal(slot.rewardGrantId, `grant_${a.id}`);
  assert.ok(slot.rewardClaimedAt > 0);
  assert.equal(slot.completedQuestionCount, 5);
  assert.equal((await db(`wallets/${u.localId}`)).coinBalance, 2);
  assert.equal(await db(`learningProgress/${u.localId}`), null);
  const history = (await ok("getUserDashboard", u)).dashboard.history;
  assert.equal(history.find(h => h.attemptId === a.id).mode, "DAILY");
});

await test("DAILY: abandon consumes today's slot without rewards", async () => {
  const u = await user();
  const a = await start(u, "DAILY");
  const left = await ok("leaveAttempt", u, {attemptId: a.id, requestId: randomUUID()});
  assert.equal(left.attempt.result.coins, 0);
  assert.equal((await db(`userDailyChallenges/${u.localId}/${getDateKey()}`)).status, "abandoned");
  assert.equal((await call("startAttempt", u, {mode: "DAILY", requestId: randomUUID()})).status, 409);
});

await test("TEST/DAILY: insufficient valid content fails clearly and does not consume a daily slot", async () => {
  for (const [mode, template] of [["TEST", "test_mixed"], ["DAILY", "daily_mixed"]]) {
    const u = await user();
    const req = randomUUID();
    const original = await db(`quizTemplates/${template}/questionPool`);
    try {
      await db(`quizTemplates/${template}/questionPool`, {scope: "all_categories", topicId: "missing-topic"});
      const response = await call("startAttempt", u, {mode, requestId: req});
      assert.equal(response.status, 400);
      assert.equal(response.error.status, "FAILED_PRECONDITION");
      assert.equal(await db(`userDailyChallenges/${u.localId}`), null);
      assert.equal(await db(`practiceAttempts/${u.localId}`), null);
    } finally {
      await db(`quizTemplates/${template}/questionPool`, original);
    }
    assert.equal((await start(u, mode, req)).mode, mode);
  }
});

await test("DAILY: interrupted start recovers the same slot, snapshot and deadline", async () => {
  const u = await user();
  const a = await start(u, "DAILY");
  await db(`practiceAttempts/${u.localId}/${a.id}`, null);
  const recovered = await start(u, "DAILY");
  assert.equal(recovered.id, a.id);
  assert.deepEqual(recovered.questions, a.questions);
  assert.equal(recovered.deadlineAt, a.deadlineAt);
});

await test("DAILY: question deadline is capped at midnight and exact midnight is expired", async () => {
  const u = await user();
  const a = await start(u, "DAILY");
  const record = await db(`practiceAttempts/${u.localId}/${a.id}`);
  const end = dailyEndsAt(record);
  assert.equal(isDailyExpired(record, end - 1), false);
  assert.equal(isDailyExpired(record, end), true);
  const q = {...await db(`attemptQuestions/${u.localId}/${a.id}/0`),
    openedAt: end - 5000, deadlineAt: end + 25000};
  await db(`attemptQuestions/${u.localId}/${a.id}/0`, q);
  assert.equal(await ensureQuestionDeadline(u.localId, a.id, 0, q, record), end);
  assert.equal((await db(`attemptQuestions/${u.localId}/${a.id}/0`)).deadlineAt, end);
});

await test("DAILY: every attempt endpoint expires yesterday's attempt; old retries leave today's slot free", async () => {
  for (const name of ["resumeAttempt", "submitAttemptAnswer", "advanceAttempt", "getAttemptResult", "leaveAttempt", "startAttempt"]) {
    const u = await user();
    const req = randomUUID();
    const a = await start(u, "DAILY", req);
    const oldKey = await expireFixture(u, a);
    const data = name === "startAttempt" ? {mode: "DAILY", requestId: req} :
      {attemptId: a.id, requestId: randomUUID(), questionId: a.questions[0].id, optionId: a.questions[0].options[0].id};
    const body = await ok(name, u, data);
    const result = body.result || body.attempt.result;
    assert.equal(result.outcome, "abandoned", name);
    assert.equal(result.coins, 0, name);
    assert.equal((await db(`userDailyChallenges/${u.localId}/${oldKey}`)).status, "abandoned");
    assert.equal(await db(`userDailyChallenges/${u.localId}/${getDateKey()}`), null);
    assert.equal(await db(`attemptAnswers/${u.localId}/${a.id}`), null);
    const next = await start(u, "DAILY");
    assert.equal(next.status, "active");
    assert.notEqual(next.id, a.id);
  }
});

await test("TEST/DAILY: banned accounts cannot start, resume, submit, advance, leave or read results", async () => {
  for (const mode of ["TEST", "DAILY"]) {
    const u = await user();
    const a = await start(u, mode);
    const other = await user();
    assert.equal((await call("getAttemptResult", other, {attemptId: a.id})).status, 404);
    await db(`accountAccess/${u.localId}/status`, "banned");
    for (const name of ["startAttempt", "resumeAttempt", "submitAttemptAnswer", "advanceAttempt", "getAttemptResult", "leaveAttempt"]) {
      const response = await call(name, u, {mode, attemptId: a.id, requestId: randomUUID(),
        questionId: a.questions[0].id, optionId: a.questions[0].options[0].id});
      assert.equal(response.status, 403, `${mode}/${name}`);
    }
  }
});

await test("DAILY: published questions without matching trusted answers cannot consume the daily slot", async () => {
  const u = await user();
  const pool = await db("quizTemplates/daily_mixed/questionPool");
  const questions = await db("questions");
  const candidates = Object.entries(questions).filter(([, q]) => q.topicId === "vocabulary_daily_life").slice(0, 6);
  const backups = [];
  try {
    await db("quizTemplates/daily_mixed/questionPool", {categoryId: "vocabulary", topicId: "vocabulary_daily_life"});
    for (const [id, q] of candidates) {
      const path = `questionAnswers/${id}/${q.currentVersion}`;
      backups.push([path, await db(path)]);
      await db(`${path}/correctOptionId`, "not-an-option");
    }
    assert.equal((await call("startAttempt", u, {mode: "DAILY", requestId: randomUUID()})).status, 400);
    assert.equal(await db(`userDailyChallenges/${u.localId}`), null);
  } finally {
    for (const [path, answer] of backups) await db(path, answer);
    await db("quizTemplates/daily_mixed/questionPool", pool);
  }
});

await test("DAILY: expired waiting result loses completion/leave race; scheduled cleanup needs no client", async () => {
  const u = await user();
  const a = await start(u, "DAILY");
  await finish(u, a);
  const oldKey = await expireFixture(u, a, true);
  await Promise.all([
    ok("getAttemptResult", u, {attemptId: a.id}),
    ok("leaveAttempt", u, {attemptId: a.id, requestId: randomUUID()}),
  ]);
  assert.equal((await db(`wallets/${u.localId}`)).coinBalance, 0);
  assert.equal((await db(`userDailyChallenges/${u.localId}/${oldKey}`)).status, "abandoned");
  const scheduledUser = await user();
  const scheduledAttempt = await start(scheduledUser, "DAILY");
  await expireFixture(scheduledUser, scheduledAttempt);
  await expireDailyAttemptsLogic();
  const expired = await db(`practiceAttempts/${scheduledUser.localId}/${scheduledAttempt.id}`);
  assert.equal(expired.status, "abandoned");
  assert.equal(expired.coinsAwarded, 0);
});

await test("DAILY: settlement projections recover after a crash and completed results stay immutable after midnight", async () => {
  const u = await user();
  const a = await start(u, "DAILY");
  await finish(u, a);
  const record = await db(`practiceAttempts/${u.localId}/${a.id}`);
  const grantId = `grant_${a.id}`;
  await db(`practiceAttempts/${u.localId}/${a.id}`, {status: "completed", coinsAwarded: 0}, "PATCH");
  await db(`userSettlements/${u.localId}`, {
    coinBalance: 2, grants: {[grantId]: {attemptId: a.id, outcome: "completed", coinDelta: 2,
      correctCount: record.correctCount, answeredCount: 5, settledAt: record.finishedAt}},
  });
  const result = (await ok("getAttemptResult", u, {attemptId: a.id})).result;
  assert.equal(result.coins, 2);
  assert.equal((await db(`wallets/${u.localId}`)).coinBalance, 2);
  await db(`practiceAttempts/${u.localId}/${a.id}`, {startedAt: Date.now() - 86400000}, "PATCH");
  const replay = (await ok("getAttemptResult", u, {attemptId: a.id})).result;
  assert.deepEqual(replay, result);
  assert.equal((await db(`wallets/${u.localId}`)).coinBalance, 2);
  assert.equal(Object.keys(await db(`coinLedger/${u.localId}`)).length, 1);
});

await deleteApp(getApp());
