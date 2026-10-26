import assert from "node:assert/strict";
import {createRequire} from "node:module";

const require = createRequire(
  new URL("../../../functions/package.json", import.meta.url)
);

const {initializeApp, deleteApp} =
  require("firebase-admin/app");

const {getAuth} =
  require("firebase-admin/auth");
const projectId = "englishbattleapp-8d764";
const namespace = `${projectId}-default-rtdb`;

const authBase = "http://127.0.0.1:9099";
const dbBase = "http://127.0.0.1:9000";
const functionsBase =
  `http://127.0.0.1:5001/${projectId}/asia-southeast1`;

async function callFunction(name, token) {
  const response = await fetch(`${functionsBase}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({data: {}}),
  });

  return {
    status: response.status,
    body: await response.json(),
  };
}

async function main() {
  // Tao tai khoan rieng cho bai kiem thu bao mat
  const email = `security-${Date.now()}@example.com`;

  const signup = await fetch(
    `${authBase}/identitytoolkit.googleapis.com/v1/` +
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

  assert.equal(signup.status, 200);

  const user = await signup.json();

  // Khoi tao profile ban dau
  const initial = await callFunction(
    "ensureUserProfile",
    user.idToken
  );

  assert.equal(initial.status, 200);
  console.log("PASS: Security test account initialized");

  // Tao tai khoan B de kiem tra cach ly du lieu
  const signupB = await fetch(
    `${authBase}/identitytoolkit.googleapis.com/v1/` +
      "accounts:signUp?key=fake-api-key",
    {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        email: `security-b-${Date.now()}@example.com`,
        password: "TestOnly123!",
        returnSecureToken: true,
      }),
    }
  );

  assert.equal(signupB.status, 200);
  const userB = await signupB.json();

  const initializedB = await callFunction(
    "ensureUserProfile",
    userB.idToken
  );
  assert.equal(initializedB.status, 200);

  // Nap so xu khac nhau cho hai tai khoan test
  for (const [uid, coins] of [
    [user.localId, 17],
    [userB.localId, 93],
  ]) {
    const seed = await fetch(
      `${dbBase}/wallets/${uid}.json?ns=${namespace}`,
      {
        method: "PATCH",
        headers: {
          Authorization: "Bearer owner",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({coinBalance: coins}),
      }
    );
    assert.equal(seed.status, 200);
  }

  // Moi token chi duoc doc Dashboard cua chinh minh
  const dashboardA = await callFunction(
    "getUserDashboard",
    user.idToken
  );
  const dashboardB = await callFunction(
    "getUserDashboard",
    userB.idToken
  );

  assert.equal(dashboardA.status, 200);
  assert.equal(dashboardB.status, 200);
  assert.equal(dashboardA.body.result.dashboard.coins, 17);
  assert.equal(dashboardB.body.result.dashboard.coins, 93);

  // A thu gia mao UID cua B trong request
  const forgedResponse = await fetch(
    `${functionsBase}/getUserDashboard`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${user.idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {uid: userB.localId},
      }),
    }
  );

  const forgedBody = await forgedResponse.json();

  // API hien tai khong nhan uid tu request.
  // Neu request duoc chap nhan, du lieu phai la cua A.
  if (forgedResponse.status === 200) {
    assert.equal(forgedBody.result.dashboard.coins, 17);
  } else {
    assert.ok(
      [400, 403].includes(forgedResponse.status)
    );
  }

  console.log("PASS: Cross-UID access isolated");

  // Chi su dung Firebase Authentication Emulator
  process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

  const adminApp = initializeApp(
    {projectId},
    "be1-security-test"
  );

  try {
    const authAdmin = getAuth(adminApp);

    // Vo hieu hoa tai khoan B trong Auth Emulator
    await authAdmin.updateUser(userB.localId, {
      disabled: true,
    });

    // Su dung token da cap truoc khi disabled
    const disabledResult = await callFunction(
      "getUserDashboard",
      userB.idToken
    );

    assert.equal(disabledResult.status, 403);
    assert.equal(
      disabledResult.body.error.status,
      "PERMISSION_DENIED"
    );

    console.log("PASS: Disabled user rejected (HTTP 403)");

    // Khoi phuc tai khoan thu
    await authAdmin.updateUser(userB.localId, {
      disabled: false,
    });
  } finally {
    await deleteApp(adminApp);
  }



  // Chuyen tai khoan sang banned trong Emulator
  const accessUrl =
    `${dbBase}/accountAccess/${user.localId}.json?ns=${namespace}`;

  const banResponse = await fetch(accessUrl, {
    method: "PATCH",
    headers: {
      Authorization: "Bearer owner",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({status: "banned"}),
  });

  assert.equal(banResponse.status, 200);

  // Goi Dashboard voi tai khoan da bi khoa
  const bannedResult = await callFunction(
    "getUserDashboard",
    user.idToken
  );

  assert.equal(bannedResult.status, 403);
  assert.equal(
    bannedResult.body.error.status,
    "PERMISSION_DENIED"
  );

  console.log("PASS: Banned user rejected (HTTP 403)");

  // Kiem thu deleted
  const deleteResponse = await fetch(accessUrl, {
    method: "PATCH",
    headers: {
      Authorization: "Bearer owner",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({status: "deleted"}),
  });

  assert.equal(deleteResponse.status, 200);

  const deletedResult = await callFunction(
    "getUserDashboard",
    user.idToken
  );

  assert.equal(deletedResult.status, 403);
  assert.equal(
    deletedResult.body.error.status,
    "PERMISSION_DENIED"
  );

  console.log("PASS: Deleted user rejected (HTTP 403)");
  console.log("ALL BE1-02 SECURITY TESTS PASSED");
}

main().catch((error) => {
  console.error("SECURITY TEST FAILED:", error);
  process.exitCode = 1;
});
