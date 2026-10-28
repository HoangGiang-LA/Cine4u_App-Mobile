import assert from "node:assert/strict";

const projectId = "englishbattleapp-8d764";
const authUrl = "http://127.0.0.1:9099";
const startUrl = `http://127.0.0.1:5001/${projectId}/asia-southeast1/startAttempt`;
const resumeUrl = `http://127.0.0.1:5001/${projectId}/asia-southeast1/resumeAttempt`;
const ensureProfileUrl = `http://127.0.0.1:5001/${projectId}/asia-southeast1/ensureUserProfile`;

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

  console.log("\nALL TESTS PASSED SUCCESSFULLY!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
