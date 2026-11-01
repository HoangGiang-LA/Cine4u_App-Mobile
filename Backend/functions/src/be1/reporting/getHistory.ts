import {HttpsError, onCall} from "firebase-functions/v2/https";
import {activeBattleUser} from "../battle/battleAccess";
import {newCursor, PAGE_TTL_MS, readCursor} from "../community/pagination";
import {historyEntry, readFeed} from "./history";

export const getHistory = onCall({region: "asia-southeast1", maxInstances: 10},
  async (request) => {
    const uid = request.auth?.uid;
    await activeBattleUser(uid);
    const {kind, cursor} = request.data || {};
    if (!["learning", "battle"].includes(kind) ||
        Object.keys(request.data || {}).some((key) =>
          !["kind", "cursor"].includes(key))) {
      throw new HttpsError("invalid-argument", "Invalid history query.");
    }
    const token = cursor == null ? null :
      await readCursor(uid!, `history:${kind}`, cursor);
    const path = kind === "battle" ? "battleHistory" : "practiceAttempts";
    const page = await readFeed(`${path}/${uid}`, "finishedAt", 25,
      (id, value) => historyEntry(id, value, kind), token?.data);
    const nextCursor = page.more && page.boundary.key ?
      await newCursor(uid!, `history:${kind}`, page.boundary,
        token?.expiresAt || Date.now() + PAGE_TTL_MS) : null;
    return {serverNow: Date.now(), page: {entries: page.entries, nextCursor}};
  });
