import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {mobileContract} from
  "../../../../frontend/contracts/mobile.v1.mjs";

const require = createRequire(
  new URL("../../../functions/package.json", import.meta.url)
);

const Ajv = require("ajv");

const projectId = "englishbattleapp-8d764";
const namespace = `${projectId}-default-rtdb`;

const authUrl = "http://127.0.0.1:9099";
const dbUrl = "http://127.0.0.1:9000";

const functionBase =
  `http://127.0.0.1:5001/${projectId}/asia-southeast1`;

const ownerHeaders = {
  Authorization: "Bearer owner",
  "Content-Type": "application/json",
};

async function callFunction(name, token) {
  const response = await fetch(`${functionBase}/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({data: {}}),
  });

  const data = await response.json();

  assert.equal(
    response.status,
    200,
    `${name} failed: ${JSON.stringify(data)}`
  );

  return data.result;
}

async function main() {
  // Tao tai khoan thu nghiem moi
  const email = `dashboard-${Date.now()}@example.com`;

  const signupResponse = await fetch(
    `${authUrl}/identitytoolkit.googleapis.com/v1/` +
      "accounts:signUp?key=fake-api-key",
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

  assert.equal(signupResponse.status, 200);

  const user = await signupResponse.json();
  const uid = user.localId;

  console.log("PASS: Test account created");

  // Khoi tao profile
  await callFunction("ensureUserProfile", user.idToken);

  console.log("PASS: Profile initialized");

  // Cap nhat du lieu gia lap trong RTDB Emulator
  const updates = [
    ["userStats", {
      rating: 125,
      wins: 8,
      losses: 3,
      draws: 2,
      winStreak: 4,
    }],
    ["wallets", {
      coinBalance: 50,
    }],
  ];

  for (const [path, data] of updates) {
    const response = await fetch(
      `${dbUrl}/${path}/${uid}.json?ns=${namespace}`,
      {
        method: "PATCH",
        headers: ownerHeaders,
        body: JSON.stringify(data),
      }
    );

    assert.equal(response.status, 200);
  }

  // Tao du lieu tien do hoc tap trong Emulator
  const progressResponse = await fetch(
    `${dbUrl}/learningProgress/${uid}.json?ns=${namespace}`,
    {
      method: "PUT",
      headers: ownerHeaders,
      body: JSON.stringify({
        grammar: {
          completedAttempts: 7,
          completionTarget: 20,
        },
        vocabulary: {
          completedAttempts: 12,
          completionTarget: 20,
        },
        listening: {
          completedAttempts: 3,
          completionTarget: 20,
        },
      }),
    }
  );

  assert.equal(
    progressResponse.status,
    200,
    "Failed to seed learning progress"
  );

  // Tao ngay hien tai theo gio Viet Nam
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const dateValue = (type) =>
    dateParts.find((part) => part.type === type)?.value;

  const dateKey =
    `${dateValue("year")}-${dateValue("month")}-${dateValue("day")}`;

  // Tao Daily Challenge gia lap
  const dailyResponse = await fetch(
    `${dbUrl}/userDailyChallenges/${uid}/${dateKey}.json?ns=${namespace}`,
    {
      method: "PUT",
      headers: ownerHeaders,
      body: JSON.stringify({
        status: "active",
        attemptId: "daily-test-001",
        challengeId: "challenge-test-001",
        startedAt: Date.now(),
      }),
    }
  );

  assert.equal(
    dailyResponse.status,
    200,
    "Failed to seed daily challenge"
  );

  // Tao du lieu thong ke ky nang trong Firebase Emulator
  const skillsResponse = await fetch(
    `${dbUrl}/userSkillStats/${uid}.json?ns=${namespace}`,
    {
      method: "PUT",
      headers: ownerHeaders,
      body: JSON.stringify({
        grammar: {
          answeredCount: 25,
          correctCount: 20,
        },
        vocabulary: {
          answeredCount: 40,
          correctCount: 32,
        },
        listening: {
          answeredCount: 15,
          correctCount: 12,
        },
        reading: {
          answeredCount: 30,
          correctCount: 24,
        },
      }),
    }
  );

  assert.equal(
    skillsResponse.status,
    200,
    "Failed to seed skill statistics"
  );

  // Tao hai thanh tich rieng cho tai khoan test
  const achievementIds = [
    `test-grammar-${uid}`,
    `test-vocabulary-${uid}`,
  ];

  const definitions = [
    {
      title: "Grammar Master",
      description: "Complete 20 Grammar sessions",
      status: "published",
    },
    {
      title: "Vocabulary Master",
      description: "Complete 20 Vocabulary sessions",
      status: "published",
    },
  ];

  for (let i = 0; i < achievementIds.length; i++) {
    const response = await fetch(
      `${dbUrl}/achievements/${achievementIds[i]}.json?ns=${namespace}`,
      {
        method: "PUT",
        headers: ownerHeaders,
        body: JSON.stringify(definitions[i]),
      }
    );

    assert.equal(response.status, 200);
  }

  // Chi mo khoa thanh tich Grammar
  const unlockResponse = await fetch(
    `${dbUrl}/userAchievements/${uid}/${achievementIds[0]}.json?ns=${namespace}`,
    {
      method: "PUT",
      headers: ownerHeaders,
      body: JSON.stringify({
        unlockedAt: Date.now(),
      }),
    }
  );

  assert.equal(unlockResponse.status, 200);

  // Tao hai thong bao thu nghiem
  const testNow = Date.now();

  const testNotifications = {
    "test-notification-001": {
      title: "Grammar Master unlocked",
      body: "You unlocked Grammar Master",
      targetType: "Achievements",
      createdAt: testNow - 10000,
      readAt: null,
    },
    "test-notification-002": {
      title: "Daily Challenge completed",
      body: "You completed today's challenge",
      targetType: "Challenge",
      createdAt: testNow,
      readAt: testNow + 1000,
    },
  };

  const notificationResponse = await fetch(
    `${dbUrl}/notifications/${uid}.json?ns=${namespace}`,
    {
      method: "PUT",
      headers: ownerHeaders,
      body: JSON.stringify(testNotifications),
    }
  );

  assert.equal(
    notificationResponse.status,
    200,
    "Failed to seed notifications"
  );

  // Tao ba giao dich xu trong Firebase Emulator
  const ledgerNow = Date.now();

  const testLedger = {
    "ledger-001": {
      label: "Hoan thanh luyen tap",
      delta: 1,
      createdAt: ledgerNow - 20000,
    },
    "ledger-002": {
      label: "Hoan thanh thu thach ngay",
      delta: 2,
      createdAt: ledgerNow - 10000,
    },
    "ledger-003": {
      label: "Dieu chinh xu thu nghiem",
      delta: -1,
      createdAt: ledgerNow,
    },
  };

  const ledgerResponse = await fetch(
    `${dbUrl}/coinLedger/${uid}.json?ns=${namespace}`,
    {
      method: "PUT",
      headers: ownerHeaders,
      body: JSON.stringify(testLedger),
    }
  );

  assert.equal(
    ledgerResponse.status,
    200,
    "Failed to seed Coin Ledger"
  );

  // Du lieu History gia lap trong Firebase Emulator
  const historyNow = Date.now();

  const testAttempts = {
    "practice-test-001": {
      mode: "practice",
      status: "completed",
      questionCount: 10,
      correctCount: 8,
      answeredCount: 10,
      coinsAwarded: 1,
      finishedAt: historyNow - 30000,
    },
    "exam-test-001": {
      mode: "test",
      status: "completed",
      questionCount: 20,
      correctCount: 15,
      answeredCount: 20,
      coinsAwarded: 2,
      finishedAt: historyNow - 20000,
    },
    "daily-test-001": {
      mode: "dailyChallenge",
      status: "abandoned",
      questionCount: 5,
      correctCount: 2,
      answeredCount: 2,
      coinsAwarded: 0,
      finishedAt: historyNow - 10000,
    },
    "active-test-001": {
      mode: "practice",
      status: "active",
      questionCount: 10,
      correctCount: 0,
      answeredCount: 0,
      coinsAwarded: 0,
      startedAt: historyNow,
    },
  };

  const historyResponse = await fetch(
    `${dbUrl}/practiceAttempts/${uid}.json?ns=${namespace}`,
    {
      method: "PUT",
      headers: ownerHeaders,
      body: JSON.stringify(testAttempts),
    }
  );

  assert.equal(
    historyResponse.status,
    200,
    "Failed to seed History"
  );

  console.log("PASS: Test data seeded");

  // Luu du lieu truoc khi doc Dashboard
  const readProtectedData = async () => {
    const paths = [
      "userStats",
      "wallets",
      "learningProgress",
      "coinLedger",
      "accountAccess",
    ];

    const snapshots = {};

    for (const path of paths) {
      const response = await fetch(
        `${dbUrl}/${path}/${uid}.json?ns=${namespace}`,
        {headers: ownerHeaders}
      );

      assert.equal(response.status, 200);
      snapshots[path] = await response.json();
    }

    return snapshots;
  };

  const beforeDashboard = await readProtectedData();

  // Goi Dashboard
  const result = await callFunction(
    "getUserDashboard",
    user.idToken
  );
// Dam bao Dashboard khong thay doi du lieu
  const afterDashboard = await readProtectedData();

  assert.deepEqual(
    afterDashboard,
    beforeDashboard,
    "Dashboard must not modify protected user data"
  );

  console.log("PASS: Dashboard is read-only");

  const dashboard = result.dashboard;

  assert.equal(dashboard.rating, 125);
  assert.equal(dashboard.coins, 50);
  assert.equal(dashboard.wins, 8);
  assert.equal(dashboard.losses, 3);
  assert.equal(dashboard.draws, 2);
  assert.equal(dashboard.streak, 4);


  assert.equal(dashboard.daily.status, "active");
  assert.equal(
    dashboard.daily.attemptId,
    "daily-test-001"
  );

  console.log("PASS: Daily Challenge loaded correctly");


    assert.deepEqual(dashboard.progress, {
      grammar: 7,
      vocabulary: 12,
      listening: 3,
    });

    console.log("PASS: Learning progress loaded correctly");

  const expectedSkills = [
    {id: "grammar", name: "Grammar", answered: 25, correct: 20},
    {id: "vocabulary", name: "Vocabulary", answered: 40, correct: 32},
    {id: "listening", name: "Listening", answered: 15, correct: 12},
    {id: "reading", name: "Reading", answered: 30, correct: 24},
  ];

  assert.deepEqual(
    [...dashboard.skills].sort((a, b) => a.id.localeCompare(b.id)),
    [...expectedSkills].sort((a, b) => a.id.localeCompare(b.id))
  );

  console.log("PASS: Skill statistics loaded correctly");

  const grammarAchievement = dashboard.achievements.find(
    (item) => item.id === achievementIds[0]
  );

  const vocabularyAchievement = dashboard.achievements.find(
    (item) => item.id === achievementIds[1]
  );

  assert.ok(grammarAchievement);
  assert.ok(vocabularyAchievement);

  assert.equal(grammarAchievement.title, "Grammar Master");
  assert.equal(grammarAchievement.unlocked, true);

  assert.equal(
    vocabularyAchievement.title,
    "Vocabulary Master"
  );
  assert.equal(vocabularyAchievement.unlocked, false);

  console.log("PASS: Achievements loaded correctly");

  // Kiem tra so luong va thu tu thong bao
  assert.equal(dashboard.notifications.length, 2);

  const [newest, older] = dashboard.notifications;

  assert.equal(newest.id, "test-notification-002");
  assert.equal(newest.destination, "Challenge");
  assert.equal(newest.read, true);

  assert.equal(older.id, "test-notification-001");
  assert.equal(older.destination, "Achievements");
  assert.equal(older.read, false);

  assert.equal(
    newest.title,
    "Daily Challenge completed"
  );

  assert.ok(newest.createdAt > older.createdAt);

  console.log("PASS: Notifications loaded correctly");

  // Kiem tra du ba giao dich
  assert.equal(dashboard.ledger.length, 3);

  // Kiem tra thu tu moi nhat truoc
  assert.deepEqual(
    dashboard.ledger.map((entry) => entry.id),
    ["ledger-003", "ledger-002", "ledger-001"]
  );

  // Kiem tra gia tri xu
  assert.deepEqual(
    dashboard.ledger.map((entry) => entry.delta),
    [-1, 2, 1]
  );

  // Kiem tra noi dung giao dich
  assert.equal(
    dashboard.ledger[0].label,
    "Dieu chinh xu thu nghiem"
  );

  // Coin Ledger chi doc, khong tu thay doi vi
  assert.equal(dashboard.coins, 50);

  console.log("PASS: Coin Ledger loaded correctly");

  // Kiem tra chi co ba phien da ket thuc
  assert.equal(dashboard.history.length, 3);

  // Kiem tra thu tu moi nhat truoc
  assert.deepEqual(
    dashboard.history.map((item) => item.attemptId),
    [
      "daily-test-001",
      "exam-test-001",
      "practice-test-001",
    ]
  );

  // PRACTICE
  const practice = dashboard.history.find(
    (item) => item.attemptId === "practice-test-001"
  );

  assert.ok(practice);
  assert.equal(practice.mode, "PRACTICE");
  assert.equal(practice.correct, 8);
  assert.equal(practice.total, 10);
  assert.equal(practice.coins, 1);
  assert.equal(practice.outcome, "completed");

  // TEST
  const exam = dashboard.history.find(
    (item) => item.attemptId === "exam-test-001"
  );

  assert.ok(exam);
  assert.equal(exam.mode, "TEST");
  assert.equal(exam.correct, 15);
  assert.equal(exam.total, 20);
  assert.equal(exam.coins, 2);

  // DAILY
  const dailyHistory = dashboard.history.find(
    (item) => item.attemptId === "daily-test-001"
  );

  assert.ok(dailyHistory);
  assert.equal(dailyHistory.mode, "DAILY");
  assert.equal(dailyHistory.outcome, "abandoned");
  assert.equal(dailyHistory.coins, 0);

  // Khong tra ve phien dang lam
  assert.equal(
    dashboard.history.some(
      (item) => item.attemptId === "active-test-001"
    ),
    false
  );

  console.log("PASS: Practice/Test/Daily History loaded correctly");

  const ajv = new Ajv({
    allErrors: true,
    strict: false,
  });

  const schema =
    mobileContract.methods.getUserDashboard.response;

  const validate = ajv.compile(schema);
  const contractValid = validate(result);

  if (!contractValid) {
    console.error(
      "Dashboard contract validation errors:",
      JSON.stringify(validate.errors, null, 2)
    );
  }

  assert.equal(
    contractValid,
    true,
    "Dashboard response does not match FE contract"
  );

  console.log("PASS: Dashboard matches mobile.v1.mjs contract");

  console.log("PASS: Dashboard reads actual database values");

  // BE1-02: Kiem thu gioi han 50 ban ghi
  const limitNow = Date.now();

  const manyNotifications = {};
  const manyLedger = {};

  // Tao 60 ban ghi voi thoi gian tang dan
  for (let i = 0; i < 60; i++) {
    const id = String(i).padStart(3, "0");

    manyNotifications[`notification-${id}`] = {
      title: `Notification ${id}`,
      body: `Test notification ${id}`,
      targetType: "Achievements",
      readAt: null,
      createdAt: limitNow + i,
    };

    manyLedger[`ledger-${id}`] = {
      label: `Test transaction ${id}`,
      delta: i % 2 === 0 ? 1 : -1,
      createdAt: limitNow + i,
    };
  }

  // Ghi du lieu vao Emulator
  const testGroups = [
    ["notifications", manyNotifications],
    ["coinLedger", manyLedger],
  ];

  for (const [path, data] of testGroups) {
    const seedResponse = await fetch(
      `${dbUrl}/${path}/${uid}.json?ns=${namespace}`,
      {
        method: "PUT",
        headers: ownerHeaders,
        body: JSON.stringify(data),
      }
    );

    assert.equal(
      seedResponse.status,
      200,
      `Failed to seed ${path}`
    );
  }

  console.log("PASS: 60 records seeded for each group");

  // Goi Dashboard lan thu hai
  const limitedResult = await callFunction(
    "getUserDashboard",
    user.idToken
  );

  const limitedDashboard = limitedResult.dashboard;

  // Kiem tra gioi han
  assert.equal(limitedDashboard.notifications.length, 50);
  assert.equal(limitedDashboard.ledger.length, 50);

  // Kiem tra ban ghi moi nhat
  assert.equal(
    limitedDashboard.notifications[0].id,
    "notification-059"
  );

  assert.equal(
    limitedDashboard.ledger[0].id,
    "ledger-059"
  );

  // Ban ghi cu nhat trong 50 ket qua
  assert.equal(
    limitedDashboard.notifications[49].id,
    "notification-010"
  );

  assert.equal(
    limitedDashboard.ledger[49].id,
    "ledger-010"
  );

  // Doc Dashboard khong lam thay doi so du vi
  assert.equal(limitedDashboard.coins, 50);

  console.log("PASS: Notifications limited to latest 50");
  console.log("PASS: Coin Ledger limited to latest 50");

  // BE1-02: Kiem thu 60 completed + 20 active
  const historyLimitNow = Date.now();
  const manyAttempts = {};

  for (let i = 0; i < 60; i++) {
    const id = String(i).padStart(3, "0");

    manyAttempts[`completed-${id}`] = {
      mode: "practice",
      status: "completed",
      questionCount: 10,
      correctCount: 8,
      coinsAwarded: 1,
      finishedAt: historyLimitNow + 1000 + i,
    };
  }

  for (let i = 0; i < 20; i++) {
    const id = String(i).padStart(3, "0");

    manyAttempts[`active-${id}`] = {
      mode: "practice",
      status: "active",
      questionCount: 10,
      correctCount: 0,
      coinsAwarded: 0,
      startedAt: historyLimitNow + i,
    };
  }

  const seedHistory = await fetch(
    `${dbUrl}/practiceAttempts/${uid}.json?ns=${namespace}`,
    {
      method: "PUT",
      headers: ownerHeaders,
      body: JSON.stringify(manyAttempts),
    }
  );

  assert.equal(seedHistory.status, 200);

  const historyLimitResult = await callFunction(
    "getUserDashboard",
    user.idToken
  );

  const limitedHistory = historyLimitResult.dashboard.history;

  assert.equal(limitedHistory.length, 50);

  assert.equal(
    limitedHistory[0].attemptId,
    "completed-059"
  );

  assert.equal(
    limitedHistory[49].attemptId,
    "completed-010"
  );

  assert.ok(
    limitedHistory.every(
      (item) => item.outcome === "completed"
    )
  );

  console.log("PASS: History limited to latest 50 completed");
  console.log("PASS: Active attempts excluded from History");

  console.log("ALL BE1-02 INITIAL TESTS PASSED");
}

main().catch((error) => {
  console.error("TEST FAILED:", error);
  process.exitCode = 1;
});
