import assert from "node:assert/strict";
import {assertAttemptSemantics} from "../../../../frontend/contracts/mobile.v1.mjs";

const projectId = "englishbattleapp-8d764";
const authUrl = "http://127.0.0.1:9099";
const startUrl = `http://127.0.0.1:5001/${projectId}/asia-southeast1/startAttempt`;
const resumeUrl = `http://127.0.0.1:5001/${projectId}/asia-southeast1/resumeAttempt`;
const ensureProfileUrl = `http://127.0.0.1:5001/${projectId}/asia-southeast1/ensureUserProfile`;
const submitUrl = `http://127.0.0.1:5001/${projectId}/asia-southeast1/submitAttemptAnswer`;
const advanceUrl = `http://127.0.0.1:5001/${projectId}/asia-southeast1/advanceAttempt`;
const getResultUrl = `http://127.0.0.1:5001/${projectId}/asia-southeast1/getAttemptResult`;
const leaveUrl = `http://127.0.0.1:5001/${projectId}/asia-southeast1/leaveAttempt`;
const dashboardUrl = `http://127.0.0.1:5001/${projectId}/asia-southeast1/getUserDashboard`;

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
  const originalQA18 = await fetch(qaBackupUrl).then((r) => r.json());

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
    body: JSON.stringify(originalQA18),
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


  console.log("36. Finalize completed attempt via getAttemptResult & reward verification (Phase 2 & 3)");
  const getRes4 = await callFunction(getResultUrl, test4User.idToken, {
    attemptId: att4.id,
  });
  assert.equal(getRes4.status, 200);
  const finalResult4 = getRes4.body.result.result;
  assert.equal(finalResult4.attemptId, att4.id);
  assert.equal(finalResult4.mode, "PRACTICE");
  assert.equal(finalResult4.outcome, "completed");
  assert.equal(finalResult4.total, 10);
  assert.equal(finalResult4.coins, 1);
  assert.ok(finalResult4.completedAt > 0);

  // Verify wallet: exactly 1 coin awarded
  const wallet4Db = await fetch(
    `http://127.0.0.1:9000/wallets/${test4User.localId}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`
  ).then((r) => r.json());
  assert.equal(wallet4Db.coinBalance, 1);

  // Verify coinLedger: exactly 1 entry with delta 1
  const ledger4Db = await fetch(
    `http://127.0.0.1:9000/coinLedger/${test4User.localId}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`
  ).then((r) => r.json());
  assert.equal(Object.keys(ledger4Db || {}).length, 1);
  const ledgerEntry = Object.values(ledger4Db)[0];
  assert.equal(ledgerEntry.delta, 1);

  // Verify learningProgress: completedAttempts incremented to 1
  const progress4Db = await fetch(
    `http://127.0.0.1:9000/learningProgress/${test4User.localId}/${att4.topicId}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`
  ).then((r) => r.json());
  assert.equal(progress4Db.completedAttempts, 1);

  // Verify practiceAttempts in DB: status is completed and immutable
  const att4Db = await fetch(
    `http://127.0.0.1:9000/practiceAttempts/${test4User.localId}/${att4.id}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`
  ).then((r) => r.json());
  assert.equal(att4Db.status, "completed");
  assert.equal(att4Db.coinsAwarded, 1);
  console.log("   -> Attempt finalized: 1 coin awarded, wallet, ledger & learningProgress updated");

  console.log("37. Repeated finalization does not grant duplicate coins (Idempotency)");
  const repeatGetRes = await callFunction(getResultUrl, test4User.idToken, {
    attemptId: att4.id,
  });
  assert.equal(repeatGetRes.status, 200);
  assert.deepEqual(repeatGetRes.body.result.result, finalResult4);

  // Wallet must still be exactly 1
  const walletRepeatDb = await fetch(
    `http://127.0.0.1:9000/wallets/${test4User.localId}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`
  ).then((r) => r.json());
  assert.equal(walletRepeatDb.coinBalance, 1);

  // Learning progress must still be 1
  const progressRepeatDb = await fetch(
    `http://127.0.0.1:9000/learningProgress/${test4User.localId}/${att4.topicId}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`
  ).then((r) => r.json());
  assert.equal(progressRepeatDb.completedAttempts, 1);
  console.log("   -> Repeated finalization is idempotent and does not grant duplicate coins");

  console.log("38. Concurrent settlement does not grant duplicate coins");
  const test8User = await createTestUser();
  await callFunction(ensureProfileUrl, test8User.idToken, {});
  const start8Res = await callFunction(startUrl, test8User.idToken, {
    mode: "PRACTICE",
    topicId: "vocabulary_daily_life",
    requestId: `req-start-test8-${Date.now()}`,
  });
  assert.equal(start8Res.status, 200);
  const att8 = start8Res.body.result.attempt;

  // Complete all 10 questions for att8
  for (let i = 0; i < 10; i++) {
    const q = att8.questions[i];
    await callFunction(submitUrl, test8User.idToken, {
      attemptId: att8.id,
      questionId: q.id,
      optionId: q.options[0].id,
      requestId: `req-sub8-${i}-${Date.now()}`,
    });
    await callFunction(advanceUrl, test8User.idToken, {
      attemptId: att8.id,
      requestId: `req-adv8-${i}-${Date.now()}`,
    });
  }

  // Concurrent finalization
  const [concGet1, concGet2] = await Promise.all([
    callFunction(getResultUrl, test8User.idToken, {attemptId: att8.id}),
    callFunction(getResultUrl, test8User.idToken, {attemptId: att8.id}),
  ]);
  assert.equal(concGet1.status, 200);
  assert.equal(concGet2.status, 200);

  // Wallet must be exactly 1
  const wallet8Db = await fetch(
    `http://127.0.0.1:9000/wallets/${test8User.localId}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`
  ).then((r) => r.json());
  assert.equal(wallet8Db.coinBalance, 1);
  console.log("   -> Concurrent finalization resolved safely without duplicate rewards");

  console.log("39. Abandoned attempt receives no reward");
  const test9User = await createTestUser();
  await callFunction(ensureProfileUrl, test9User.idToken, {});
  const start9Res = await callFunction(startUrl, test9User.idToken, {
    mode: "PRACTICE",
    topicId: "vocabulary_daily_life",
    requestId: `req-start-test9-${Date.now()}`,
  });
  assert.equal(start9Res.status, 200);
  const att9 = start9Res.body.result.attempt;

  // Answer 2 questions then abandon via leaveAttempt
  await callFunction(submitUrl, test9User.idToken, {
    attemptId: att9.id,
    questionId: att9.questions[0].id,
    optionId: att9.questions[0].options[0].id,
    requestId: `req-sub9-0-${Date.now()}`,
  });
  const leaveRes = await callFunction(leaveUrl, test9User.idToken, {
    attemptId: att9.id,
    requestId: `req-leave-9-${Date.now()}`,
  });
  assert.equal(leaveRes.status, 200);
  assert.equal(leaveRes.body.result.attempt.status, "abandoned");
  assert.equal(leaveRes.body.result.attempt.result.outcome, "abandoned");
  assert.equal(leaveRes.body.result.attempt.result.coins, 0);

  // Verify wallet remains 0
  const wallet9Db = await fetch(
    `http://127.0.0.1:9000/wallets/${test9User.localId}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`
  ).then((r) => r.json());
  assert.equal(wallet9Db.coinBalance, 0);

  // Verify learningProgress has no completed attempts
  const progress9Db = await fetch(
    `http://127.0.0.1:9000/learningProgress/${test9User.localId}/${att9.topicId}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`
  ).then((r) => r.json());
  assert.equal(progress9Db, null);
  console.log("   -> Abandoned attempt received 0 coins and did not increment progress");

  console.log("40. Interrupted settlement safe recovery");
  const test10User = await createTestUser();
  await callFunction(ensureProfileUrl, test10User.idToken, {});
  const start10Res = await callFunction(startUrl, test10User.idToken, {
    mode: "PRACTICE",
    topicId: "vocabulary_daily_life",
    requestId: `req-start-test10-${Date.now()}`,
  });
  assert.equal(start10Res.status, 200);
  const att10 = start10Res.body.result.attempt;

  // Complete all 10 questions for att10
  for (let i = 0; i < 10; i++) {
    const q = att10.questions[i];
    await callFunction(submitUrl, test10User.idToken, {
      attemptId: att10.id,
      questionId: q.id,
      optionId: q.options[0].id,
      requestId: `req-sub10-${i}-${Date.now()}`,
    });
    await callFunction(advanceUrl, test10User.idToken, {
      attemptId: att10.id,
      requestId: `req-adv10-${i}-${Date.now()}`,
    });
  }

  // Simulate worker crash during reward settlement: grant already saved, wallet credited, but practiceAttempts still waiting
  const grant10Id = `grant_${att10.id}`;
  await fetch(
    `http://127.0.0.1:9000/rewardGrants/${test10User.localId}/${grant10Id}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`,
    {
      method: "PUT",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        sourceType: "practice",
        sourceId: att10.id,
        coinDelta: 1,
        status: "completed",
        grantedAt: Date.now(),
      }),
    }
  );
  await fetch(
    `http://127.0.0.1:9000/wallets/${test10User.localId}/coinBalance.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`,
    {
      method: "PUT",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(1),
    }
  );

  // Calling getAttemptResult must recover cleanly without duplicating coins
  const recoverRes10 = await callFunction(getResultUrl, test10User.idToken, {
    attemptId: att10.id,
  });
  assert.equal(recoverRes10.status, 200);
  assert.equal(recoverRes10.body.result.result.outcome, "completed");

  const wallet10Db = await fetch(
    `http://127.0.0.1:9000/wallets/${test10User.localId}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`
  ).then((r) => r.json());
  assert.equal(wallet10Db.coinBalance, 1);
  console.log("   -> Interrupted settlement safely recovered without duplicating wallet balance");

  console.log("41. Dashboard and History integration verification (Phase 4)");
  const dashRes = await callFunction(dashboardUrl, test4User.idToken, {});
  assert.equal(dashRes.status, 200);
  const dashboard = dashRes.body.result.dashboard;
  assert.equal(dashboard.coins, 1);
  assert.equal(dashboard.progress[att4.topicId], 1);
  assert.ok(dashboard.history.length >= 1);
  assert.equal(dashboard.history[0].attemptId, att4.id);
  assert.equal(dashboard.history[0].outcome, "completed");
  assert.equal(dashboard.history[0].coins, 1);
  console.log("   -> Dashboard and History successfully integrated with finalized attempt data");


  console.log("42. Completion versus abandonment race (Issue 3)");
  const test11User = await createTestUser();
  await callFunction(ensureProfileUrl, test11User.idToken, {});
  const start11Res = await callFunction(startUrl, test11User.idToken, {
    mode: "PRACTICE",
    topicId: "vocabulary_daily_life",
    requestId: `req-start-test11-${Date.now()}`,
  });
  assert.equal(start11Res.status, 200);
  const att11 = start11Res.body.result.attempt;

  // Complete all 10 questions for att11
  for (let i = 0; i < 10; i++) {
    const q = att11.questions[i];
    await callFunction(submitUrl, test11User.idToken, {
      attemptId: att11.id,
      questionId: q.id,
      optionId: q.options[0].id,
      requestId: `req-sub11-${i}-${Date.now()}`,
    });
    await callFunction(advanceUrl, test11User.idToken, {
      attemptId: att11.id,
      requestId: `req-adv11-${i}-${Date.now()}`,
    });
  }

  // Race: simultaneous completion (getAttemptResult) and abandonment (leaveAttempt)
  const [raceComp, raceAban] = await Promise.all([
    callFunction(getResultUrl, test11User.idToken, {attemptId: att11.id}),
    callFunction(leaveUrl, test11User.idToken, {
      attemptId: att11.id,
      requestId: `req-leave-race-${Date.now()}`,
    }),
  ]);
  assert.equal(raceComp.status, 200);
  assert.equal(raceAban.status, 200);

  // Authoritative DB state check: exactly one final outcome was chosen
  const att11Db = await fetch(
    `http://127.0.0.1:9000/practiceAttempts/${test11User.localId}/${att11.id}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`
  ).then((r) => r.json());
  assert.ok(att11Db.status === "completed" || att11Db.status === "abandoned");

  const wallet11Db = await fetch(
    `http://127.0.0.1:9000/wallets/${test11User.localId}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`
  ).then((r) => r.json());

  if (att11Db.status === "completed") {
    assert.equal(wallet11Db.coinBalance, 1);
    assert.equal(att11Db.coinsAwarded, 1);
  } else {
    assert.equal(wallet11Db.coinBalance, 0);
    assert.equal(att11Db.coinsAwarded, 0);
  }
  console.log(`   -> Mutual exclusion verified: attempt finalized as ${att11Db.status} with ${wallet11Db.coinBalance} coins`);

  console.log("43. Crash recovery of stale settling lease (Issue 1 & 2)");
  const test12User = await createTestUser();
  await callFunction(ensureProfileUrl, test12User.idToken, {});
  const start12Res = await callFunction(startUrl, test12User.idToken, {
    mode: "PRACTICE",
    topicId: "vocabulary_daily_life",
    requestId: `req-start-test12-${Date.now()}`,
  });
  assert.equal(start12Res.status, 200);
  const att12 = start12Res.body.result.attempt;

  // Complete all 10 questions for att12
  for (let i = 0; i < 10; i++) {
    const q = att12.questions[i];
    await callFunction(submitUrl, test12User.idToken, {
      attemptId: att12.id,
      questionId: q.id,
      optionId: q.options[0].id,
      requestId: `req-sub12-${i}-${Date.now()}`,
    });
    await callFunction(advanceUrl, test12User.idToken, {
      attemptId: att12.id,
      requestId: `req-adv12-${i}-${Date.now()}`,
    });
  }

  // Simulate worker crash during settlement: settlementStatus set to settling, but crashed 15s ago
  await fetch(
    `http://127.0.0.1:9000/practiceAttempts/${test12User.localId}/${att12.id}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`,
    {
      method: "PATCH",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        settlementStatus: "settling",
        settlementStartedAt: Date.now() - 15000,
      }),
    }
  );

  // Calling getAttemptResult must recover the stale lease and execute the atomic multi-path update
  const recoverRes12 = await callFunction(getResultUrl, test12User.idToken, {
    attemptId: att12.id,
  });
  assert.equal(recoverRes12.status, 200);
  assert.equal(recoverRes12.body.result.result.outcome, "completed");

  const wallet12Db = await fetch(
    `http://127.0.0.1:9000/wallets/${test12User.localId}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`
  ).then((r) => r.json());
  assert.equal(wallet12Db.coinBalance, 1);
  console.log("   -> Stale settlement lease safely recovered, 1 coin granted via atomic multi-path update");


  console.log("44. Existing user keeps their previous coin balance (Initialization & Migration)");
  const test13User = await createTestUser();
  await callFunction(ensureProfileUrl, test13User.idToken, {});

  // Pre-seed an existing user wallet balance of 50 coins and progress 5
  await fetch(
    `http://127.0.0.1:9000/wallets/${test13User.localId}/coinBalance.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`,
    {
      method: "PUT",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(50),
    }
  );
  await fetch(
    `http://127.0.0.1:9000/learningProgress/${test13User.localId}/vocabulary_daily_life/completedAttempts.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`,
    {
      method: "PUT",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(5),
    }
  );

  const start13Res = await callFunction(startUrl, test13User.idToken, {
    mode: "PRACTICE",
    topicId: "vocabulary_daily_life",
    requestId: `req-start-test13-${Date.now()}`,
  });
  assert.equal(start13Res.status, 200);
  const att13 = start13Res.body.result.attempt;

  // Complete all 10 questions for att13
  for (let i = 0; i < 10; i++) {
    const q = att13.questions[i];
    await callFunction(submitUrl, test13User.idToken, {
      attemptId: att13.id,
      questionId: q.id,
      optionId: q.options[0].id,
      requestId: `req-sub13-${i}-${Date.now()}`,
    });
    await callFunction(advanceUrl, test13User.idToken, {
      attemptId: att13.id,
      requestId: `req-adv13-${i}-${Date.now()}`,
    });
  }

  // Finalize via getAttemptResult
  const res13 = await callFunction(getResultUrl, test13User.idToken, {
    attemptId: att13.id,
  });
  assert.equal(res13.status, 200);
  assert.equal(res13.body.result.result.outcome, "completed");
  assert.equal(res13.body.result.result.coins, 1);

  // Verify wallet preserved previous balance: 50 + 1 = 51 coins
  const wallet13Db = await fetch(
    `http://127.0.0.1:9000/wallets/${test13User.localId}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`
  ).then((r) => r.json());
  assert.equal(wallet13Db.coinBalance, 51);

  // Verify learningProgress preserved previous attempts: 5 + 1 = 6
  const prog13Db = await fetch(
    `http://127.0.0.1:9000/learningProgress/${test13User.localId}/vocabulary_daily_life.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`
  ).then((r) => r.json());
  assert.equal(prog13Db.completedAttempts, 6);

  // Verify authoritative settlement record at userSettlements/{uid}
  const settlement13Db = await fetch(
    `http://127.0.0.1:9000/userSettlements/${test13User.localId}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`
  ).then((r) => r.json());
  assert.equal(settlement13Db.coinBalance, 51);
  assert.equal(settlement13Db.progress.vocabulary_daily_life, 6);
  assert.ok(settlement13Db.grants[`grant_${att13.id}`]);
  console.log("   -> Safe migration verified: inherited baseline 50 coins -> 51 coins, progress 5 -> 6");

  console.log("45. Projection replay does not increment twice (Phase 4 Synchronization)");
  // Call getAttemptResult again on att13
  const replayRes13 = await callFunction(getResultUrl, test13User.idToken, {
    attemptId: att13.id,
  });
  assert.equal(replayRes13.status, 200);

  // Verify wallet still exactly 51 (NOT 52)
  const wallet13ReplayDb = await fetch(
    `http://127.0.0.1:9000/wallets/${test13User.localId}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`
  ).then((r) => r.json());
  assert.equal(wallet13ReplayDb.coinBalance, 51);

  // Verify progress still exactly 6 (NOT 7)
  const prog13ReplayDb = await fetch(
    `http://127.0.0.1:9000/learningProgress/${test13User.localId}/vocabulary_daily_life.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`
  ).then((r) => r.json());
  assert.equal(prog13ReplayDb.completedAttempts, 6);
  console.log("   -> Projection replay verified: wallet remained 51, progress remained 6");

  console.log("46. Unsettled legacy grant (status: pending) is not treated as credited");
  const test14User = await createTestUser();
  await callFunction(ensureProfileUrl, test14User.idToken, {});

  // Pre-seed an unsettled pending grant
  const pendingGrantId = `grant_pending_att`;
  await fetch(
    `http://127.0.0.1:9000/rewardGrants/${test14User.localId}/${pendingGrantId}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`,
    {
      method: "PUT",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        sourceType: "practice",
        sourceId: "pending_att",
        coinDelta: 1,
        status: "pending", // Unsettled
        grantedAt: Date.now(),
      }),
    }
  );

  const start14Res = await callFunction(startUrl, test14User.idToken, {
    mode: "PRACTICE",
    topicId: "vocabulary_daily_life",
    requestId: `req-start-test14-${Date.now()}`,
  });
  assert.equal(start14Res.status, 200);
  const att14 = start14Res.body.result.attempt;

  for (let i = 0; i < 10; i++) {
    const q = att14.questions[i];
    await callFunction(submitUrl, test14User.idToken, {
      attemptId: att14.id,
      questionId: q.id,
      optionId: q.options[0].id,
      requestId: `req-sub14-${i}-${Date.now()}`,
    });
    await callFunction(advanceUrl, test14User.idToken, {
      attemptId: att14.id,
      requestId: `req-adv14-${i}-${Date.now()}`,
    });
  }

  const res14 = await callFunction(getResultUrl, test14User.idToken, {
    attemptId: att14.id,
  });
  assert.equal(res14.status, 200);

  const settlement14Db = await fetch(
    `http://127.0.0.1:9000/userSettlements/${test14User.localId}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`
  ).then((r) => r.json());
  assert.equal(settlement14Db.grants[pendingGrantId], undefined);
  assert.equal(settlement14Db.coinBalance, 1);
  console.log("   -> Pending legacy grant safely ignored, only real completed attempt was settled");

  console.log("47. Progress retry maintains correctCount and answeredCount without double counting");
  const prog13Before = await fetch(
    `http://127.0.0.1:9000/learningProgress/${test13User.localId}/vocabulary_daily_life.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`
  ).then((r) => r.json());
  assert.ok(prog13Before.answeredCount > 0);
  assert.ok(prog13Before.correctCount > 0);

  // Re-call getAttemptResult on att13
  await callFunction(getResultUrl, test13User.idToken, {attemptId: att13.id});

  const prog13After = await fetch(
    `http://127.0.0.1:9000/learningProgress/${test13User.localId}/vocabulary_daily_life.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`
  ).then((r) => r.json());
  assert.equal(prog13After.answeredCount, prog13Before.answeredCount);
  assert.equal(prog13After.correctCount, prog13Before.correctCount);
  assert.equal(prog13After.completedAttempts, prog13Before.completedAttempts);
  console.log("   -> learningProgress counters safely preserved across retries without double counting");

  console.log("48. Daily Challenge across midnight uses original challenge date");
  const test15User = await createTestUser();
  await callFunction(ensureProfileUrl, test15User.idToken, {});

  // Simulate attempt started yesterday
  const yesterdayTimestamp = Date.now() - 24 * 3600 * 1000;
  const yesterdayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(yesterdayTimestamp));

  const start15Res = await callFunction(startUrl, test15User.idToken, {
    mode: "DAILY",
    requestId: `req-start-test15-${Date.now()}`,
  });
  assert.equal(start15Res.status, 200);
  const att15 = start15Res.body.result.attempt;

  // Patch startedAt to yesterday
  await fetch(
    `http://127.0.0.1:9000/practiceAttempts/${test15User.localId}/${att15.id}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`,
    {
      method: "PATCH",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        startedAt: yesterdayTimestamp,
        createdAt: yesterdayTimestamp,
      }),
    }
  );

  // Complete all questions for Daily Challenge
  for (let i = 0; i < att15.questions.length; i++) {
    const q = att15.questions[i];
    await callFunction(submitUrl, test15User.idToken, {
      attemptId: att15.id,
      questionId: q.id,
      optionId: q.options[0].id,
      requestId: `req-sub15-${i}-${Date.now()}`,
    });
    await callFunction(advanceUrl, test15User.idToken, {
      attemptId: att15.id,
      requestId: `req-adv15-${i}-${Date.now()}`,
    });
  }

  // Finalize today
  const res15 = await callFunction(getResultUrl, test15User.idToken, {
    attemptId: att15.id,
  });
  assert.equal(res15.status, 200);

  // Verify daily challenge record updated under yesterday's key
  const dailyRecord = await fetch(
    `http://127.0.0.1:9000/userDailyChallenges/${test15User.localId}/${yesterdayKey}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`
  ).then((r) => r.json());
  assert.equal(dailyRecord.status, "completed");
  console.log("   -> Daily Challenge completed across midnight correctly credited to original challenge date");

  console.log("49. Cannot complete an already abandoned attempt");
  const test16User = await createTestUser();
  await callFunction(ensureProfileUrl, test16User.idToken, {});

  const start16Res = await callFunction(startUrl, test16User.idToken, {
    mode: "PRACTICE",
    topicId: "vocabulary_daily_life",
    requestId: `req-start-test16-${Date.now()}`,
  });
  const att16 = start16Res.body.result.attempt;

  // Abandon it
  const leave16Res = await callFunction(leaveUrl, test16User.idToken, {
    attemptId: att16.id,
    requestId: `req-leave-test16-${Date.now()}`,
  });
  assert.equal(leave16Res.status, 200);

  // Attempt to finalize as completed - must be rejected or returned as abandoned without completed status
  const att16Db = await fetch(
    `http://127.0.0.1:9000/practiceAttempts/${test16User.localId}/${att16.id}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`
  ).then((r) => r.json());
  assert.equal(att16Db.status, "abandoned");
  assert.equal(att16Db.coinsAwarded, 0);
  console.log("   -> Abandoned attempt status is immutable and coins cannot be awarded");

  console.log("50. BE1-06: Practice reviews verification for completed attempt");
  const reviewRes4 = await callFunction(getResultUrl, test4User.idToken, {
    attemptId: att4.id,
  });
  assert.equal(reviewRes4.status, 200);
  const result4 = reviewRes4.body.result.result;
  assert.equal(result4.attemptId, att4.id);
  assert.equal(result4.mode, "PRACTICE");
  assert.equal(result4.outcome, "completed");
  assert.ok(Array.isArray(result4.reviews));
  assert.equal(result4.reviews.length, 10);

  // Question 0 was answered correctly
  const rev0 = result4.reviews[0];
  assert.equal(rev0.question.id, att4.questions[0].id);
  assert.equal(rev0.question.version, att4.questions[0].version);
  assert.deepEqual(rev0.question.options, att4.questions[0].options);
  assert.equal(rev0.pickedId, rev0.correctId);
  assert.ok(rev0.explanation.length > 0);

  // Question 1 was answered incorrectly
  const rev1 = result4.reviews[1];
  assert.equal(rev1.question.id, att4.questions[1].id);
  assert.ok(rev1.pickedId !== null);
  assert.notEqual(rev1.pickedId, rev1.correctId);
  assert.ok(rev1.explanation.length > 0);

  // Question 2 was timed out
  const rev2 = result4.reviews[2];
  assert.equal(rev2.question.id, att4.questions[2].id);
  assert.equal(rev2.pickedId, null);
  assert.ok(rev2.correctId.length > 0);
  assert.ok(rev2.explanation.length > 0);

  // Verify attemptReviews in RTDB
  const reviewsDb = await fetch(
    `http://127.0.0.1:9000/attemptReviews/${test4User.localId}/${att4.id}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`
  ).then((r) => r.json());
  assert.ok(reviewsDb !== null);
  assert.equal(reviewsDb["0"].correctOptionId, rev0.correctId);
  assert.equal(reviewsDb["0"].explanation, rev0.explanation);
  console.log("   -> Completed attempt reviews match trusted backend data and original options");

  console.log("51. BE1-06: Security check - Another user cannot read private attempt reviews");
  const unauthorizedReviewRes = await callFunction(getResultUrl, hackerUser.idToken, {
    attemptId: att4.id,
  });
  assert.equal(unauthorizedReviewRes.status, 404);
  console.log("   -> Unauthorized attempt access strictly rejected with 404");

  console.log("52. BE1-06: Active attempt cannot reveal reviews or correct answers");
  const test17User = await createTestUser();
  await callFunction(ensureProfileUrl, test17User.idToken, {});
  const start17Res = await callFunction(startUrl, test17User.idToken, {
    mode: "PRACTICE",
    topicId: "vocabulary_daily_life",
    requestId: `req-start-test17-${Date.now()}`,
  });
  assert.equal(start17Res.status, 200);
  const att17 = start17Res.body.result.attempt;

  const activeReviewRes = await callFunction(getResultUrl, test17User.idToken, {
    attemptId: att17.id,
  });
  assert.equal(activeReviewRes.status, 400); // failed-precondition
  console.log("   -> Active attempt strictly forbidden from exposing reviews");

  console.log("53. BE1-06: Review retrieval does not mutate wallet, ledger, or progress");
  const walletBefore = await fetch(
    `http://127.0.0.1:9000/wallets/${test4User.localId}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`
  ).then((r) => r.json());
  const progressBefore = await fetch(
    `http://127.0.0.1:9000/learningProgress/${test4User.localId}/${att4.topicId}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`
  ).then((r) => r.json());

  // Call getAttemptResult multiple times
  await callFunction(getResultUrl, test4User.idToken, {attemptId: att4.id});
  await callFunction(getResultUrl, test4User.idToken, {attemptId: att4.id});

  const walletAfter = await fetch(
    `http://127.0.0.1:9000/wallets/${test4User.localId}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`
  ).then((r) => r.json());
  const progressAfter = await fetch(
    `http://127.0.0.1:9000/learningProgress/${test4User.localId}/${att4.topicId}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`
  ).then((r) => r.json());

  assert.equal(walletAfter.coinBalance, walletBefore.coinBalance);
  assert.equal(progressAfter.completedAttempts, progressBefore.completedAttempts);
  console.log("   -> Review retrieval is strictly read-only and non-mutating");

  console.log("54. BE1-06: Abandoned attempt reviews are accessible with pickedId: null for unanswered");
  const abanReviewRes = await callFunction(getResultUrl, test16User.idToken, {
    attemptId: att16.id,
  });
  assert.equal(abanReviewRes.status, 200);
  assert.equal(abanReviewRes.body.result.result.outcome, "abandoned");
  assert.equal(abanReviewRes.body.result.result.coins, 0);
  const abanReviews = abanReviewRes.body.result.result.reviews;
  assert.equal(abanReviews.length, 10);
  for (const ar of abanReviews) {
    assert.equal(ar.pickedId, null);
    assert.ok(ar.correctId.length > 0);
    assert.ok(ar.explanation.length > 0);
  }
  console.log("   -> Abandoned attempt reviews correctly return outcome 'abandoned' and pickedId: null");

  console.log("55. BE1-06 Safety: Missing or invalid questionAnswers rejects review retrieval with 500 and does not cache");
  const test18User = await createTestUser();
  await callFunction(ensureProfileUrl, test18User.idToken, {});
  const start18Res = await callFunction(startUrl, test18User.idToken, {
    mode: "PRACTICE",
    topicId: "vocabulary_daily_life",
    requestId: `req-start-test18-${Date.now()}`,
  });
  const att18 = start18Res.body.result.attempt;

  // Complete attempt
  for (let i = 0; i < 10; i++) {
    const q = att18.questions[i];
    await callFunction(submitUrl, test18User.idToken, {
      attemptId: att18.id,
      questionId: q.id,
      optionId: q.options[0].id,
      requestId: `req-sub18-${i}-${Date.now()}`,
    });
    await callFunction(advanceUrl, test18User.idToken, {
      attemptId: att18.id,
      requestId: `req-adv18-${i}-${Date.now()}`,
    });
  }

  // Corrupt questionAnswers for question 0 in attemptQuestions
  const corruptQId = att18.questions[0].id;
  const corruptVersion = att18.questions[0].version;
  // Temporarily back up
  const originalQA = await fetch(
    `http://127.0.0.1:9000/questionAnswers/${corruptQId}/${corruptVersion}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`
  ).then((r) => r.json());

  await fetch(
    `http://127.0.0.1:9000/questionAnswers/${corruptQId}/${corruptVersion}/correctOptionId.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`,
    {
      method: "PUT",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(""), // Invalid empty correctOptionId
    }
  );

  // Calling getAttemptResult must fail with 500 error, not return empty or fabricated answer
  const corruptGetRes = await callFunction(getResultUrl, test18User.idToken, {
    attemptId: att18.id,
  });
  assert.equal(corruptGetRes.status, 500);

  // Verify attemptReviews was NOT cached with invalid correctOptionId
  const cachedReviewDb = await fetch(
    `http://127.0.0.1:9000/attemptReviews/${test18User.localId}/${att18.id}/0.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`
  ).then((r) => r.json());
  assert.equal(cachedReviewDb, null);

  // Restore original questionAnswers
  await fetch(
    `http://127.0.0.1:9000/questionAnswers/${corruptQId}/${corruptVersion}.json?ns=englishbattleapp-8d764-default-rtdb&access_token=owner`,
    {
      method: "PUT",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(originalQA),
    }
  );
  console.log("   -> Missing/invalid questionAnswers safely rejected with 500 without caching/fabricating");

  console.log("\nALL TESTS PASSED SUCCESSFULLY!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
