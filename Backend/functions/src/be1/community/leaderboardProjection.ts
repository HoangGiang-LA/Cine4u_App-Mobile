import {adminDb} from "../../config/firebaseAdmin";
import {integer} from "./notifications";
import {transactionWithRetry} from "../databaseTransaction";

export const syncLeaderboardPlayer = async (
  uid: string,
): Promise<void> => {
  const [profile, stats, access] = await Promise.all([
    adminDb.ref(`users/${uid}`).get(),
    adminDb.ref(`userStats/${uid}`).get(),
    adminDb.ref(`accountAccess/${uid}/status`).get(),
  ]);
  const p = profile.val();
  const s = stats.val();
  if (!p || !s || !["active", "banned"].includes(access.val())) {
    await adminDb.ref(`leaderboardPlayers/${uid}`).remove();
    return;
  }
  await transactionWithRetry(
    adminDb.ref(`leaderboardPlayers/${uid}`),
    (old) => {
      const seq = integer(s.battleStatsSequence);
      const statsAt = integer(s.updatedAt);
      const profileAt = integer(p.updatedAt);
      const newerRating =
        seq > integer(old?.sequence) ||
        (seq === integer(old?.sequence) &&
          statsAt >= integer(old?.statsAt));
      const newerName = profileAt >= integer(old?.profileAt);
      return {
        uid,
        name: newerName ?
          String(p.displayName || "Người học").slice(0, 100) :
          old.name,
        rating: newerRating ? integer(s.rating) : old.rating,
        sequence: newerRating ? seq : old.sequence,
        statsAt: newerRating ? statsAt : old.statsAt,
        profileAt: newerName ? profileAt : old.profileAt,
      };
    },
  );
};
