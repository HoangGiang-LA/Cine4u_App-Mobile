import {getApp, getApps, initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getDatabase} from "firebase-admin/database";

const databaseURL =
  "https://englishbattleapp-8d764-default-rtdb.asia-southeast1.firebasedatabase.app";

const app = getApps().length > 0 ?
  getApp() :
  initializeApp({
    databaseURL,
  });

export const adminAuth = getAuth(app);
export const adminDb = getDatabase(app);
