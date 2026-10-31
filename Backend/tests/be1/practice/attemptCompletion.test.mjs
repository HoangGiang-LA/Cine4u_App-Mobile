import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {randomUUID} from "node:crypto";
import {test} from "node:test";

// Separate ports let these tests run while the app uses live Firebase data.
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, "127.0.0.1:9199");
assert.equal(process.env.FIREBASE_DATABASE_EMULATOR_HOST, "127.0.0.1:9100");
assert.equal(process.env.GCLOUD_PROJECT, "demo-englishbattle-finalization");
const require = createRequire(new URL("../../../functions/package.json", import.meta.url));
const {ensureUserProfile} = require("./lib/be1/auth/ensureUserProfile.js");
const {startAttempt} = require("./lib/be1/practice/startAttempt.js");
const {submitAttemptAnswer} = require("./lib/be1/practice/submitAttemptAnswer.js");
const {advanceAttempt} = require("./lib/be1/practice/advanceAttempt.js");
const {getAttemptResult} = require("./lib/be1/practice/getAttemptResult.js");
const {resumeAttempt} = require("./lib/be1/practice/resumeAttempt.js");
const {getUserDashboard} = require("./lib/be1/user/getUserDashboard.js");
const {adminAuth, adminDb} = require("./lib/config/firebaseAdmin.js");
const {deleteApp} = require("firebase-admin/app");

// Fail before any writes if the Admin SDK is not targeting the local database.
assert.match(adminDb.ref().toString(), /^http:\/\/127\.0\.0\.1:9100\//);
const seed = JSON.parse(readFileSync(new URL("../../../database/english-battle.seed.json", import.meta.url), "utf8"));
const invoke = (fn, uid, data = {}) => fn.run({auth: {uid}, data});

try {
  // The app's database namespace differs from the demo Auth project ID.
  // Apply indexes to that namespace on the isolated emulator as well.
  const namespace = new URL(adminDb.app.options.databaseURL).hostname.split(".")[0];
  const rulesResponse = await fetch(`http://127.0.0.1:9100/.settings/rules.json?ns=${namespace}`, {
    method: "PUT", headers: {Authorization: "Bearer owner", "Content-Type": "application/json"},
    body: readFileSync(new URL("../../../../database.rules.json", import.meta.url), "utf8"),
  });
  assert.equal(rulesResponse.status, 200);
  await adminDb.ref().set(seed);
  for (const [mode, reward] of [["PRACTICE", 1], ["TEST", 2], ["DAILY", 2]]) {
    await test(`${mode}: final question, result, saved history and idempotent rewards`, async () => {
      const user = await adminAuth.createUser({email: `completion-${randomUUID()}@example.test`});
      await invoke(ensureUserProfile, user.uid);
      const {attempt: initial} = await invoke(startAttempt, user.uid, {
        mode, ...(mode === "PRACTICE" ? {topicId: "vocabulary_daily_life"} : {}),
        requestId: randomUUID(),
      });
      let waiting;
      for (const question of initial.questions) {
        await invoke(submitAttemptAnswer, user.uid, {
          attemptId: initial.id, questionId: question.id,
          optionId: question.options[0].id, requestId: randomUUID(),
        });
        waiting = (await invoke(advanceAttempt, user.uid, {
          attemptId: initial.id, requestId: randomUUID(),
        })).attempt;
      }
      assert.equal(waiting.status, "waiting");
      assert.equal(waiting.result, null);
      assert.equal((await adminDb.ref(`wallets/${user.uid}/coinBalance`).get()).val(), 0);

      // This follow-up is what the Android adapter must perform at the boundary.
      const {result} = await invoke(getAttemptResult, user.uid, {attemptId: initial.id});
      assert.equal(result.mode, mode);
      assert.equal(result.outcome, "completed");
      assert.equal(result.total, initial.questions.length);
      assert.equal(result.reviews.length, initial.questions.length);
      assert.equal(result.coins, reward);

      const replay = await invoke(getAttemptResult, user.uid, {attemptId: initial.id});
      assert.deepEqual(replay.result, result);
      const resumed = await invoke(resumeAttempt, user.uid, {attemptId: initial.id});
      assert.equal(resumed.attempt.status, "completed");
      assert.deepEqual(resumed.attempt.result, result);

      const saved = (await adminDb.ref(`practiceAttempts/${user.uid}/${initial.id}`).get()).val();
      assert.equal(saved.status, "completed");
      assert.equal(saved.answeredCount, initial.questions.length);
      assert.equal(saved.coinsAwarded, reward);
      assert.equal((await adminDb.ref(`wallets/${user.uid}/coinBalance`).get()).val(), reward);
      assert.equal((await adminDb.ref(`coinLedger/${user.uid}`).get()).numChildren(), 1);
      const {dashboard} = await invoke(getUserDashboard, user.uid);
      assert.equal(dashboard.coins, reward);
      assert.equal(dashboard.history.find(item => item.attemptId === initial.id)?.outcome, "completed");
      if (mode === "DAILY") {
        const slots = (await adminDb.ref(`userDailyChallenges/${user.uid}`).get()).val();
        assert.equal(Object.values(slots)[0].status, "completed");
      }
    });
  }
} finally {
  await deleteApp(adminDb.app);
}
