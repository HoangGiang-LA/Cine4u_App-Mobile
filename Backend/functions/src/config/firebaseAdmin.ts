import {getApp, getApps, initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getDatabase} from "firebase-admin/database";

const projectId = process.env.GCLOUD_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT;
// Demo Emulator projects use a local namespace. Production is unchanged.
const demoEmulator = !!process.env.FIREBASE_DATABASE_EMULATOR_HOST &&
  projectId?.startsWith("demo-");
const databaseURL = demoEmulator ?
  `https://${projectId}-default-rtdb.firebaseio.com` :
  "https://englishbattleapp-8d764-default-rtdb.asia-southeast1.firebasedatabase.app";

const app = getApps().length > 0 ?
  getApp() :
  initializeApp({
    databaseURL,
  });

export const adminAuth = getAuth(app);
export const adminDb = getDatabase(app);
