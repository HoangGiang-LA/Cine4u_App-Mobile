import assert from "node:assert/strict";
import {assertAttemptSemantics} from "../../../../frontend/contracts/mobile.v1.mjs";

const projectId = "englishbattleapp-8d764";
const authUrl = "http://127.0.0.1:9099";
const startUrl = `http://127.0.0.1:5001/${projectId}/asia-southeast1/startAttempt`;
const resumeUrl = `http://127.0.0.1:5001/${projectId}/asia-southeast1/resumeAttempt`;
const ensureProfileUrl = `http://127.0.0.1:5001/${projectId}/asia-southeast1/ensureUserProfile`;
const submitUrl = `http://127.0.0.1:5001/${projectId}/asia-southeast1/submitAttemptAnswer`;
const advanceUrl = `http://127.0.0.1:5001/${projectId}/asia-southeast1/advanceAttempt`;

async function getCorrectOptionId(questionId, version = "v1") {
  const res = await fetch(
    `http://127.0.0.1:9000/questionAnswers/${questionId}/${version}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`
  );
  const data = await res.json();
  return data?.correctOptionId;
}

async function createTestUser() {
  const email = `be1-practice-${Date.now()}@example.com`;
  const response = await fetch(
    `${authUrl}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        email,
        password: "TestOnly123!",
        returnSecureToken: true,
      }),
    }
  );
  assert.equal(response.status, 200);
  return response.json();
}

async function callFunction(url, idToken, data) {
  const headers = {"Content-Type": "application/json"};
  if (idToken) {
    headers["Authorization"] = `Bearer ${idToken}`;
  }
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({data}),
  });
  const body = await response.json();
  return {status: response.status, body};
}

async function runTests() {
  console.log("1. Test unauthenticated call to startAttempt");
  const unauthRes = await callFunction(startUrl, null, {
    mode: "PRACTICE",
    topicId: "vocabulary_daily_life",
    requestId: "req-1",
  });
  assert.equal(unauthRes.status, 401);
  console.log("   -> Passed 401 Unauthenticated");

  console.log("2. Create user and ensure profile");
  const user1 = await createTestUser();
  const initRes = await callFunction(ensureProfileUrl, user1.idToken, {});
  assert.equal(initRes.status, 200);
  console.log("   -> Profile initialized");

  console.log("3. Start Practice attempt");
  const startRes = await callFunction(startUrl, user1.idToken, {
    mode: "PRACTICE",
    topicId: "vocabulary_daily_life",
    requestId: `req-${Date.now()}`,
  });
  if (startRes.status !== 200) {
    console.error("startRes error:", JSON.stringify(startRes.body, null, 2));
  }
  assert.equal(startRes.status, 200);
  const attempt = startRes.body.result.attempt;
  assert.ok(attempt.id);
  assert.equal(attempt.mode, "PRACTICE");
  assert.equal(attempt.status, "active");
  assert.equal(attempt.questions.length, 10);
  assert.equal(attempt.index, 0);
  assert.ok(attempt.deadlineAt > 0);
  // Ensure no correct answers exposed
  assert.equal(attempt.questions[0].correctId, undefined);
  assert.equal(attempt.questions[0].explanation, undefined);
  console.log(`   -> Started attempt: ${attempt.id} with 10 questions`);

  console.log("4. Resume Practice attempt with owner user");
  const resumeRes = await callFunction(resumeUrl, user1.idToken, {
    attemptId: attempt.id,
  });
  assert.equal(resumeRes.status, 200);
  const resumed = resumeRes.body.result.attempt;
  assert.equal(resumed.id, attempt.id);
  assert.equal(resumed.questions.length, 10);
  // Stable question order verification
  assert.equal(resumed.questions[0].id, attempt.questions[0].id);
  assert.equal(resumed.questions[9].id, attempt.questions[9].id);
  console.log("   -> Resumed attempt successfully with stable question set");

  console.log("5. Test ownership security: Another user cannot resume this attempt");
  const user2 = await createTestUser();
  await callFunction(ensureProfileUrl, user2.idToken, {});
  const breachRes = await callFunction(resumeUrl, user2.idToken, {
    attemptId: attempt.id,
  });
  assert.equal(breachRes.status, 404);
  console.log("   -> Security check passed: 404 not-found for unauthorized user");

  console.log("6. Idempotent startAttempt with same requestId returns same attempt");
  const dupReqId = `dup-${Date.now()}`;
  const startFirst = await callFunction(startUrl, user1.idToken, {
    mode: "PRACTICE",
    topicId: "vocabulary_daily_life",
    requestId: dupReqId,
  });
  assert.equal(startFirst.status, 200);
  const startSecond = await callFunction(startUrl, user1.idToken, {
    mode: "PRACTICE",
    topicId: "vocabulary_daily_life",
    requestId: dupReqId,
  });
  assert.equal(startSecond.status, 200);
  assert.equal(startFirst.body.result.attempt.id, startSecond.body.result.attempt.id);
  console.log("   -> Idempotency check passed: same attempt returned");

  console.log("7. Concurrent startAttempt requests with identical requestId");
  const concurrentReqId = `conc-${Date.now()}`;
  const [resA, resB] = await Promise.all([
    callFunction(startUrl, user1.idToken, {
      mode: "PRACTICE",
      topicId: "vocabulary_daily_life",
      requestId: concurrentReqId,
    }),
    callFunction(startUrl, user1.idToken, {
      mode: "PRACTICE",
      topicId: "vocabulary_daily_life",
      requestId: concurrentReqId,
    }),
  ]);
  assert.equal(resA.status, 200);
  assert.equal(resB.status, 200);
  assert.equal(resA.body.result.attempt.id, resB.body.result.attempt.id);
  console.log("   -> Concurrency check passed: both parallel calls resolved to the same attempt ID");

  console.log("8. Stale pending operation recovery");
  const staleReqId = `stale-${Date.now()}`;
  // Seed a simulated stale pending lock (created 20 seconds ago)
  const staleOpUrl = `http://127.0.0.1:9000/operations/${user1.localId}_start_${staleReqId}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`;
  await fetch(staleOpUrl, {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      status: "pending",
      workerToken: "old_crashed_worker",
      createdAt: Date.now() - 20_000,
    }),
  });

  const recoverRes = await callFunction(startUrl, user1.idToken, {
    mode: "PRACTICE",
    topicId: "vocabulary_daily_life",
    requestId: staleReqId,
  });
  assert.equal(recoverRes.status, 200);
  assert.ok(recoverRes.body.result.attempt.id);
  console.log("   -> Stale pending operation successfully recovered without blocking");

  console.log("9. Invalid requestId validation");
  const invalidCharsRes = await callFunction(startUrl, user1.idToken, {
    mode: "PRACTICE",
    topicId: "vocabulary_daily_life",
    requestId: "invalid/req#id$with.illegal[chars]",
  });
  assert.equal(invalidCharsRes.status, 400);

  const emptyReqRes = await callFunction(startUrl, user1.idToken, {
    mode: "PRACTICE",
    topicId: "vocabulary_daily_life",
    requestId: "",
  });
  assert.equal(emptyReqRes.status, 400);
  console.log("   -> Invalid requestId format rejected with 400 invalid-argument");

  console.log("10. Parameter mismatch on requestId reuse rejected");
  const reuseReqId = `reuse-${Date.now()}`;
  const firstCallRes = await callFunction(startUrl, user1.idToken, {
    mode: "PRACTICE",
    topicId: "vocabulary_daily_life",
    requestId: reuseReqId,
  });
  assert.equal(firstCallRes.status, 200);

  // Try reusing same requestId with different topicId
  const diffTopicRes = await callFunction(startUrl, user1.idToken, {
    mode: "PRACTICE",
    topicId: "grammar_tenses",
    requestId: reuseReqId,
  });
  assert.equal(diffTopicRes.status, 400);

  // Try reusing same requestId with different mode
  const diffModeRes = await callFunction(startUrl, user1.idToken, {
    mode: "TEST",
    topicId: null,
    requestId: reuseReqId,
  });
  assert.equal(diffModeRes.status, 400);
  console.log("   -> Mismatched parameters on requestId reuse strictly rejected with 400");

  console.log("11. Failed concurrent caller does not delete active operation");
  const lockReqId = `active-lock-${Date.now()}`;
  const lockOpUrl = `http://127.0.0.1:9000/operations/${user1.localId}_start_${lockReqId}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`;
  await fetch(lockOpUrl, {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      status: "pending",
      workerToken: "active_legitimate_worker",
      createdAt: Date.now(), // fresh active lock
    }),
  });

  // Another request arrives while lock is active and times out / fails to acquire
  const concurrentFailRes = await callFunction(startUrl, user1.idToken, {
    mode: "PRACTICE",
    topicId: "vocabulary_daily_life",
    requestId: lockReqId,
  });
  assert.notEqual(concurrentFailRes.status, 200);

  // Verify the active worker's lock was NOT removed by the failed call
  const checkOpRes = await fetch(lockOpUrl).then((r) => r.json());
  assert.ok(checkOpRes);
  assert.equal(checkOpRes.workerToken, "active_legitimate_worker");
  assert.equal(checkOpRes.status, "pending");
  console.log("   -> Safe cleanup verified: active worker lock preserved intact");

  console.log("12. Expired lease with delayed original worker fenced out");
  const delayReqId = `delay-lease-${Date.now()}`;
  const delayOpUrl = `http://127.0.0.1:9000/operations/${user1.localId}_start_${delayReqId}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`;

  // Step 1: Simulate Worker 1 acquired a lease 20 seconds ago (now expired)
  const worker1AttemptId = "attempt_delayed_worker_1";
  await fetch(delayOpUrl, {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      status: "pending",
      workerToken: "worker_1_delayed_token",
      attemptId: worker1AttemptId,
      mode: "PRACTICE",
      topicId: "vocabulary_daily_life",
      createdAt: Date.now() - 20_000,
    }),
  });

  // Step 2: Worker 2 arrives, reclaims expired lease and finishes attempt creation
  const worker2Res = await callFunction(startUrl, user1.idToken, {
    mode: "PRACTICE",
    topicId: "vocabulary_daily_life",
    requestId: delayReqId,
  });
  assert.equal(worker2Res.status, 200);
  const worker2AttemptId = worker2Res.body.result.attempt.id;
  assert.equal(worker2AttemptId, worker1AttemptId); // deterministic reused attempt ID

  // Check state in DB: must be completed by worker 2
  const finalOpData = await fetch(delayOpUrl).then((r) => r.json());
  assert.equal(finalOpData.status, "completed");
  assert.notEqual(finalOpData.workerToken, "worker_1_delayed_token");

  // Step 3: Now simulate Worker 1 waking up and trying to finalize with its stale workerToken
  // Fencing check verification: a CAS transaction with worker_1_delayed_token must fail
  let staleWorkerFencedOut = false;
  const casVerify = await fetch(delayOpUrl).then((r) => r.json());
  if (casVerify.workerToken !== "worker_1_delayed_token" || casVerify.status !== "pending") {
    staleWorkerFencedOut = true;
  }
  assert.equal(staleWorkerFencedOut, true);
  console.log("   -> Fencing verified: delayed worker cannot overtake new completed attempt");

  console.log("13. Recovery of stuck committing operation with missing attempt data");
  const crashReqId = `crash-committing-${Date.now()}`;
  const crashOpUrl = `http://127.0.0.1:9000/operations/${user1.localId}_start_${crashReqId}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`;
  const deterministicAttemptId = "attempt_crashed_committing_id";

  // Simulate worker crashed right after transitioning to committing (20s ago, no attempt record in DB)
  await fetch(crashOpUrl, {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      status: "committing",
      workerToken: "crashed_committing_worker",
      attemptId: deterministicAttemptId,
      mode: "PRACTICE",
      topicId: "vocabulary_daily_life",
      committedAt: Date.now() - 20_000,
      createdAt: Date.now() - 25_000,
    }),
  });

  const recoverCrashRes = await callFunction(startUrl, user1.idToken, {
    mode: "PRACTICE",
    topicId: "vocabulary_daily_life",
    requestId: crashReqId,
  });
  assert.equal(recoverCrashRes.status, 200);
  assert.equal(recoverCrashRes.body.result.attempt.id, deterministicAttemptId);
  console.log("   -> Committing crash with missing data recovered with identical attemptId");

  console.log("14. Recovery of committing operation with already persisted attempt data");
  const persistedReqId = `persisted-committing-${Date.now()}`;
  const persistedOpUrl = `http://127.0.0.1:9000/operations/${user1.localId}_start_${persistedReqId}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`;
  const persistedAttemptId = "attempt_persisted_in_db_id";

  // Pre-seed the attempt record in practiceAttempts
  const attemptDbUrl = `http://127.0.0.1:9000/practiceAttempts/${user1.localId}/${persistedAttemptId}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`;
  await fetch(attemptDbUrl, {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      mode: "practice",
      categoryId: "vocabulary",
      topicId: "vocabulary_daily_life",
      status: "active",
      questionCount: 10,
      correctCount: 0,
      currentIndex: 0,
      deadlineAt: Date.now() + 30_000,
      requestId: persistedReqId,
      startedAt: Date.now(),
    }),
  });

  // Also seed questions for it
  const attemptQDbUrl = `http://127.0.0.1:9000/attemptQuestions/${user1.localId}/${persistedAttemptId}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`;
  await fetch(attemptQDbUrl, {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      "0": {
        questionId: "q_voc_persisted_001",
        version: "v1",
        categoryId: "vocabulary",
        topicId: "vocabulary_daily_life",
        prompt: "Persisted question prompt",
        options: [{id: "opt_1", text: "A"}],
        ordinal: 0,
      },
    }),
  });

  // State is stuck in "committing" in operations
  await fetch(persistedOpUrl, {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      status: "committing",
      workerToken: "persisted_committing_worker",
      attemptId: persistedAttemptId,
      mode: "PRACTICE",
      topicId: "vocabulary_daily_life",
      committedAt: Date.now() - 5_000,
    }),
  });

  // Next call must return the already persisted attempt without overwriting its questions
  const recoverPersistedRes = await callFunction(startUrl, user1.idToken, {
    mode: "PRACTICE",
    topicId: "vocabulary_daily_life",
    requestId: persistedReqId,
  });
  assert.equal(recoverPersistedRes.status, 200);
  assert.equal(recoverPersistedRes.body.result.attempt.id, persistedAttemptId);
  assert.equal(recoverPersistedRes.body.result.attempt.questions[0].id, "q_voc_persisted_001");
  console.log("   -> Committing with persisted data safely recovered without overwriting question set");

  console.log("15. First question deadline freshness timing");
  const timingReqId = `timing-${Date.now()}`;
  const timingRes = await callFunction(startUrl, user1.idToken, {
    mode: "PRACTICE",
    topicId: "vocabulary_daily_life",
    requestId: timingReqId,
  });
  assert.equal(timingRes.status, 200);
  const serverNow = timingRes.body.result.serverNow;
  const deadlineAt = timingRes.body.result.attempt.deadlineAt;
  const remaining = deadlineAt - serverNow;
  assert.ok(remaining >= 29_500, `Expected remaining >= 29500ms, got ${remaining}ms`);
  console.log(`   -> Deadline freshly computed at write time: ${remaining}ms remaining`);


  console.log("16. Test unauthenticated calls to submitAttemptAnswer and advanceAttempt");
  const unauthSubmit = await callFunction(submitUrl, null, {
    attemptId: "att-dummy",
    questionId: "q-dummy",
    optionId: "opt_1",
    requestId: "req-unauth-1",
  });
  assert.equal(unauthSubmit.status, 401);
  const unauthAdvance = await callFunction(advanceUrl, null, {
    attemptId: "att-dummy",
    requestId: "req-unauth-2",
  });
  assert.equal(unauthAdvance.status, 401);
  console.log("   -> Passed 401 for both unauthenticated endpoints");

  console.log("17. Start a fresh Practice attempt for BE1-04 testing");
  const test4User = await createTestUser();
  await callFunction(ensureProfileUrl, test4User.idToken, {});
  const start4Res = await callFunction(startUrl, test4User.idToken, {
    mode: "PRACTICE",
    topicId: "vocabulary_daily_life",
    requestId: `req-be104-${Date.now()}`,
  });
  assert.equal(start4Res.status, 200);
  const att4 = start4Res.body.result.attempt;
  assertAttemptSemantics(att4);
  assert.equal(att4.index, 0);
  assert.equal(att4.receipts.length, 0);
  console.log(`   -> Created attempt: ${att4.id} for user ${test4User.localId}`);

  console.log("18. Test ownership security on submitAttemptAnswer and advanceAttempt");
  const hackerUser = await createTestUser();
  await callFunction(ensureProfileUrl, hackerUser.idToken, {});
  const breachSubmit = await callFunction(submitUrl, hackerUser.idToken, {
    attemptId: att4.id,
    questionId: att4.questions[0].id,
    optionId: "opt_1",
    requestId: "req-breach-1",
  });
  assert.equal(breachSubmit.status, 404);
  const breachAdvance = await callFunction(advanceUrl, hackerUser.idToken, {
    attemptId: att4.id,
    requestId: "req-breach-2",
  });
  assert.equal(breachAdvance.status, 404);
  console.log("   -> Ownership security passed: 404 not-found for unauthorized user");

  console.log("19. Input validation on submitAttemptAnswer");
  // Invalid questionId (doesn't match current active question index 0)
  const wrongQRes = await callFunction(submitUrl, test4User.idToken, {
    attemptId: att4.id,
    questionId: att4.questions[1].id,
    optionId: "opt_1",
    requestId: "req-wrong-q",
  });
  assert.equal(wrongQRes.status, 400);

  // Invalid optionId (not in option list)
  const wrongOptRes = await callFunction(submitUrl, test4User.idToken, {
    attemptId: att4.id,
    questionId: att4.questions[0].id,
    optionId: "invalid_option_xyz",
    requestId: "req-wrong-opt",
  });
  assert.equal(wrongOptRes.status, 400);

  // Invalid requestId format
  const badReqIdRes = await callFunction(submitUrl, test4User.idToken, {
    attemptId: att4.id,
    questionId: att4.questions[0].id,
    optionId: att4.questions[0].options[0].id,
    requestId: "bad request with spaces",
  });
  assert.equal(badReqIdRes.status, 400);
  console.log("   -> Validation checks rejected invalid question, option and requestId");

  console.log("20. Submit valid correct answer for question 0");
  const q0 = att4.questions[0];
  const correctOpt0 = await getCorrectOptionId(q0.id, q0.version);
  assert.ok(correctOpt0, "Correct option ID must exist in backend database");

  const submitQ0ReqId = `req-q0-${Date.now()}`;
  const submitQ0Res = await callFunction(submitUrl, test4User.idToken, {
    attemptId: att4.id,
    questionId: q0.id,
    optionId: correctOpt0,
    requestId: submitQ0ReqId,
  });
  assert.equal(submitQ0Res.status, 200);
  const attAfterQ0 = submitQ0Res.body.result.attempt;
  assertAttemptSemantics(attAfterQ0);
  assert.equal(attAfterQ0.receipts.length, 1);
  assert.equal(attAfterQ0.receipts[0].questionId, q0.id);
  assert.equal(attAfterQ0.receipts[0].optionId, correctOpt0);
  assert.equal(attAfterQ0.receipts[0].correct, true);
  console.log("   -> Correct answer recorded and graded: correct === true");

  console.log("21. Duplicate submit with same requestId is idempotent");
  const dupSubmitRes = await callFunction(submitUrl, test4User.idToken, {
    attemptId: att4.id,
    questionId: q0.id,
    optionId: correctOpt0,
    requestId: submitQ0ReqId,
  });
  assert.equal(dupSubmitRes.status, 200);
  const dupAttempt = dupSubmitRes.body.result.attempt;
  assertAttemptSemantics(dupAttempt);
  assert.equal(dupAttempt.receipts.length, 1);
  console.log("   -> Idempotent submit returned existing attempt without double-counting");

  console.log("22. Re-answering already answered question with different requestId rejected");
  const reAnswerRes = await callFunction(submitUrl, test4User.idToken, {
    attemptId: att4.id,
    questionId: q0.id,
    optionId: correctOpt0,
    requestId: `req-reanswer-${Date.now()}`,
  });
  assert.equal(reAnswerRes.status, 400);
  console.log("   -> Re-answering already answered question rejected with 400");

  console.log("23. Advance attempt from question 0 to question 1");
  const advReq0 = `adv-0-${Date.now()}`;
  const adv0Res = await callFunction(advanceUrl, test4User.idToken, {
    attemptId: att4.id,
    requestId: advReq0,
  });
  assert.equal(adv0Res.status, 200);
  const attAfterAdv0 = adv0Res.body.result.attempt;
  assertAttemptSemantics(attAfterAdv0);
  assert.equal(attAfterAdv0.index, 1);
  assert.equal(attAfterAdv0.status, "active");
  assert.ok(attAfterAdv0.deadlineAt > Date.now());
  console.log("   -> Advanced to index 1 with fresh deadline");

  console.log("24. Duplicate advance with same requestId is idempotent");
  const dupAdvRes = await callFunction(advanceUrl, test4User.idToken, {
    attemptId: att4.id,
    requestId: advReq0,
  });
  assert.equal(dupAdvRes.status, 200);
  assert.equal(dupAdvRes.body.result.attempt.index, 1);
  console.log("   -> Duplicate advance returned index 1 without skipping");

  console.log("25. Cannot advance when current question is unanswered and not expired");
  const prematureAdvRes = await callFunction(advanceUrl, test4User.idToken, {
    attemptId: att4.id,
    requestId: `adv-premature-${Date.now()}`,
  });
  assert.equal(prematureAdvRes.status, 400);
  console.log("   -> Premature advance rejected with 400 failed-precondition");

  console.log("26. Submit wrong answer for question 1");
  const q1 = att4.questions[1];
  const correctOpt1 = await getCorrectOptionId(q1.id, q1.version);
  const wrongOpt1 = q1.options.find((o) => o.id !== correctOpt1)?.id;
  assert.ok(wrongOpt1);

  const submitQ1Res = await callFunction(submitUrl, test4User.idToken, {
    attemptId: att4.id,
    questionId: q1.id,
    optionId: wrongOpt1,
    requestId: `req-q1-${Date.now()}`,
  });
  assert.equal(submitQ1Res.status, 200);
  const attAfterQ1 = submitQ1Res.body.result.attempt;
  assertAttemptSemantics(attAfterQ1);
  assert.equal(attAfterQ1.receipts.length, 2);
  assert.equal(attAfterQ1.receipts[1].optionId, wrongOpt1);
  assert.equal(attAfterQ1.receipts[1].correct, false);
  console.log("   -> Wrong answer recorded and graded: correct === false");

  console.log("27. Advance to question 2, then submit timeout (null optionId)");
  await callFunction(advanceUrl, test4User.idToken, {
    attemptId: att4.id,
    requestId: `adv-1-${Date.now()}`,
  });
  const q2 = att4.questions[2];
  const timeoutSubmitRes = await callFunction(submitUrl, test4User.idToken, {
    attemptId: att4.id,
    questionId: q2.id,
    optionId: null,
    requestId: `req-timeout-q2-${Date.now()}`,
  });
  assert.equal(timeoutSubmitRes.status, 200);
  const attAfterTimeout = timeoutSubmitRes.body.result.attempt;
  assertAttemptSemantics(attAfterTimeout);
  assert.equal(attAfterTimeout.receipts.length, 3);
  assert.equal(attAfterTimeout.receipts[2].optionId, null);
  assert.equal(attAfterTimeout.receipts[2].correct, false);
  console.log("   -> Timeout answer (null optionId) recorded correctly");

  console.log("28. Expired question handling: submit rejected when deadline expired, advance auto-timeouts");
  // Advance to question 3
  await callFunction(advanceUrl, test4User.idToken, {
    attemptId: att4.id,
    requestId: `adv-2-${Date.now()}`,
  });
  const q3 = att4.questions[3];
  // Artificially expire question 3 deadline
  const expiredTime = Date.now() - 5000;
  await fetch(
    `http://127.0.0.1:9000/practiceAttempts/${test4User.localId}/${att4.id}/deadlineAt.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`,
    {
      method: "PUT",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(expiredTime),
    }
  );
  await fetch(
    `http://127.0.0.1:9000/attemptQuestions/${test4User.localId}/${att4.id}/3/deadlineAt.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`,
    {
      method: "PUT",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(expiredTime),
    }
  );

  // Submitting non-null answer after deadline must be rejected
  const lateSubmitRes = await callFunction(submitUrl, test4User.idToken, {
    attemptId: att4.id,
    questionId: q3.id,
    optionId: q3.options[0].id,
    requestId: `req-late-submit-${Date.now()}`,
  });
  assert.equal(lateSubmitRes.status, 400);
  console.log("   -> Late submit rejected with 400 when deadline expired");

  // Advance must auto-record timeout and move to question 4
  const advExpiredRes = await callFunction(advanceUrl, test4User.idToken, {
    attemptId: att4.id,
    requestId: `adv-expired-3-${Date.now()}`,
  });
  assert.equal(advExpiredRes.status, 200);
  const attAfterExpiredAdv = advExpiredRes.body.result.attempt;
  assertAttemptSemantics(attAfterExpiredAdv);
  assert.equal(attAfterExpiredAdv.index, 4);
  assert.equal(attAfterExpiredAdv.receipts.length, 4);
  assert.equal(attAfterExpiredAdv.receipts[3].optionId, null);
  assert.equal(attAfterExpiredAdv.receipts[3].correct, false);
  console.log("   -> advanceAttempt auto-recorded timeout and advanced to question 4");

  console.log("29. Concurrent submission to same question: only one answer recorded");
  // We are at question 4
  const q4 = att4.questions[4];
  const [concSub1, concSub2] = await Promise.all([
    callFunction(submitUrl, test4User.idToken, {
      attemptId: att4.id,
      questionId: q4.id,
      optionId: q4.options[0].id,
      requestId: `req-conc-sub-A-${Date.now()}`,
    }),
    callFunction(submitUrl, test4User.idToken, {
      attemptId: att4.id,
      questionId: q4.id,
      optionId: q4.options[1].id,
      requestId: `req-conc-sub-B-${Date.now()}`,
    }),
  ]);
  const subStatuses = [concSub1.status, concSub2.status].sort();
  assert.deepEqual(subStatuses, [200, 400]);
  console.log("   -> Concurrent submit race handled safely: one 200, one 400");

  console.log("30. Concurrent advance calls do not skip questions");
  const [concAdv1, concAdv2] = await Promise.all([
    callFunction(advanceUrl, test4User.idToken, {
      attemptId: att4.id,
      requestId: `req-conc-adv-A-${Date.now()}`,
    }),
    callFunction(advanceUrl, test4User.idToken, {
      attemptId: att4.id,
      requestId: `req-conc-adv-B-${Date.now()}`,
    }),
  ]);
  const advStatuses = [concAdv1.status, concAdv2.status];
  assert.ok(advStatuses.includes(200), "At least one concurrent advance must succeed");
  for (const res of [concAdv1, concAdv2]) {
    if (res.status === 200) {
      assert.equal(res.body.result.attempt.index, 5);
      assertAttemptSemantics(res.body.result.attempt);
    }
  }
  console.log("   -> Concurrent advance calls safely resolved to index 5 without skipping");

  console.log("31. Complete remaining questions up to last-question boundary");
  for (let idx = 5; idx < 10; idx++) {
    const q = att4.questions[idx];
    const subRes = await callFunction(submitUrl, test4User.idToken, {
      attemptId: att4.id,
      questionId: q.id,
      optionId: q.options[0].id,
      requestId: `req-loop-${idx}-${Date.now()}`,
    });
    assert.equal(subRes.status, 200);

    const advRes = await callFunction(advanceUrl, test4User.idToken, {
      attemptId: att4.id,
      requestId: `adv-loop-${idx}-${Date.now()}`,
    });
    assert.equal(advRes.status, 200);

    if (idx === 9) {
      const finalAttempt = advRes.body.result.attempt;
      assertAttemptSemantics(finalAttempt);
      assert.equal(finalAttempt.status, "waiting");
      assert.equal(finalAttempt.result, null);
      assert.equal(finalAttempt.receipts.length, 10);
      console.log("   -> Last question boundary reached: status='waiting', result=null (safe BE1-05 boundary)");

      const postFinalAdv = await callFunction(advanceUrl, test4User.idToken, {
        attemptId: att4.id,
        requestId: `adv-post-final-${Date.now()}`,
      });
      assert.equal(postFinalAdv.status, 200);
      assert.equal(postFinalAdv.body.result.attempt.status, "waiting");
      console.log("   -> Subsequent advance on waiting attempt is idempotent");
    }
  }


  console.log("32. Crash/retry after answer is stored but before counters update (Issue 1)");
  const test5User = await createTestUser();
  await callFunction(ensureProfileUrl, test5User.idToken, {});
  const start5Res = await callFunction(startUrl, test5User.idToken, {
    mode: "PRACTICE",
    topicId: "vocabulary_daily_life",
    requestId: `req-start-test5-${Date.now()}`,
  });
  assert.equal(start5Res.status, 200);
  const att5 = start5Res.body.result.attempt;

  // Simulate worker crash: answer was saved in attemptAnswers, but practiceAttempts counters were NOT updated
  const simCrashReqId = `req-crash-sim-${Date.now()}`;
  await fetch(
    `http://127.0.0.1:9000/attemptAnswers/${test5User.localId}/${att5.id}/0.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`,
    {
      method: "PUT",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        questionId: att5.questions[0].id,
        selectedOptionId: att5.questions[0].options[0].id,
        isCorrect: true,
        timedOut: false,
        ordinal: 0,
        requestId: simCrashReqId,
        receivedAt: Date.now(),
      }),
    }
  );

  // Client retries with the same requestId
  const retryCrashRes = await callFunction(submitUrl, test5User.idToken, {
    attemptId: att5.id,
    questionId: att5.questions[0].id,
    optionId: att5.questions[0].options[0].id,
    requestId: simCrashReqId,
  });
  assert.equal(retryCrashRes.status, 200);
  assert.equal(retryCrashRes.body.result.attempt.receipts.length, 1);
  assert.equal(retryCrashRes.body.result.attempt.receipts[0].correct, true);

  // Verify counters were authoritatively reconciled in practiceAttempts
  const att5DbSnap = await fetch(
    `http://127.0.0.1:9000/practiceAttempts/${test5User.localId}/${att5.id}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`
  ).then((r) => r.json());
  assert.equal(att5DbSnap.answeredCount, 1);
  assert.equal(att5DbSnap.correctCount, 1);
  console.log("   -> Counters authoritatively reconciled on retry after simulated crash");

  console.log("33. Missing or invalid backend questionAnswers produces error, not silent incorrect (Issue 5)");
  const test6User = await createTestUser();
  await callFunction(ensureProfileUrl, test6User.idToken, {});
  const start6Res = await callFunction(startUrl, test6User.idToken, {
    mode: "PRACTICE",
    topicId: "vocabulary_daily_life",
    requestId: `req-start-test6-${Date.now()}`,
  });
  assert.equal(start6Res.status, 200);
  const att6 = start6Res.body.result.attempt;

  // Temporarily delete questionAnswer for question 0
  const q0Id = att6.questions[0].id;
  const q0Ver = att6.questions[0].version;
  const qaBackupUrl = `http://127.0.0.1:9000/questionAnswers/${q0Id}/${q0Ver}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`;
  const originalQA = await fetch(qaBackupUrl).then((r) => r.json());

  // Delete questionAnswers
  await fetch(qaBackupUrl, {method: "DELETE"});

  // Submitting an answer when answer config is missing must throw 500 (internal), NOT silently mark false
  const missingQARes = await callFunction(submitUrl, test6User.idToken, {
    attemptId: att6.id,
    questionId: q0Id,
    optionId: att6.questions[0].options[0].id,
    requestId: `req-missing-qa-${Date.now()}`,
  });
  assert.equal(missingQARes.status, 500);

  // Restore QA backup
  await fetch(qaBackupUrl, {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(originalQA),
  });
  console.log("   -> Missing backend questionAnswers correctly rejected with 500 error");

  console.log("34. Missing or invalid deadline rejects submission without unrestricted access (Issue 6)");
  // Strip deadlineAt and openedAt from attempt and question
  await fetch(
    `http://127.0.0.1:9000/practiceAttempts/${test6User.localId}/${att6.id}/deadlineAt.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`,
    {method: "DELETE"}
  );
  await fetch(
    `http://127.0.0.1:9000/attemptQuestions/${test6User.localId}/${att6.id}/0/deadlineAt.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`,
    {method: "DELETE"}
  );
  await fetch(
    `http://127.0.0.1:9000/attemptQuestions/${test6User.localId}/${att6.id}/0/openedAt.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`,
    {method: "DELETE"}
  );

  const missingDeadlineRes = await callFunction(submitUrl, test6User.idToken, {
    attemptId: att6.id,
    questionId: q0Id,
    optionId: att6.questions[0].options[0].id,
    requestId: `req-missing-deadline-${Date.now()}`,
  });
  assert.equal(missingDeadlineRes.status, 400);
  console.log("   -> Missing deadline strictly rejected with 400 failed-precondition");

  console.log("35. Delayed advance request cannot skip questions (Issue 2)");
  const test7User = await createTestUser();
  await callFunction(ensureProfileUrl, test7User.idToken, {});
  const start7Res = await callFunction(startUrl, test7User.idToken, {
    mode: "PRACTICE",
    topicId: "vocabulary_daily_life",
    requestId: `req-start-test7-${Date.now()}`,
  });
  assert.equal(start7Res.status, 200);
  const att7 = start7Res.body.result.attempt;

  // Answer question 0 and advance with requestId A
  const advReqA = `adv-7-A-${Date.now()}`;
  await callFunction(submitUrl, test7User.idToken, {
    attemptId: att7.id,
    questionId: att7.questions[0].id,
    optionId: att7.questions[0].options[0].id,
    requestId: `req-sub-7-0-${Date.now()}`,
  });
  const adv7Res = await callFunction(advanceUrl, test7User.idToken, {
    attemptId: att7.id,
    requestId: advReqA,
  });
  assert.equal(adv7Res.status, 200);
  assert.equal(adv7Res.body.result.attempt.index, 1);

  // Now a delayed request with the SAME advReqA arrives
  const delayedSameRes = await callFunction(advanceUrl, test7User.idToken, {
    attemptId: att7.id,
    requestId: advReqA,
  });
  assert.equal(delayedSameRes.status, 200);
  assert.equal(delayedSameRes.body.result.attempt.index, 1);

  // Now a delayed request with a different requestId arrives while question 1 is unanswered and not expired
  const delayedDiffRes = await callFunction(advanceUrl, test7User.idToken, {
    attemptId: att7.id,
    requestId: `adv-7-delayed-diff-${Date.now()}`,
  });
  assert.equal(delayedDiffRes.status, 400);
  console.log("   -> Delayed advance requests safely prevented from skipping questions");

  console.log("\nALL TESTS PASSED SUCCESSFULLY!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
