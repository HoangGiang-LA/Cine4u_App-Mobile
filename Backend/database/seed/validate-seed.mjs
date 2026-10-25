import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const data = JSON.parse(fs.readFileSync(path.join(dir,'english-battle.seed.json'),'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(dir,'seed-manifest.json'),'utf8'));
const reference = JSON.parse(fs.readFileSync(path.join(dir,'runtime-examples.reference.json'),'utf8'));
let leaves = 0;
function checkJson(value, location = '') {
  assert.notEqual(value, null, `${location}: null would delete data`);
  assert(!Array.isArray(value), `${location}: use stable keyed maps`);
  if (typeof value === 'object') {
    assert(Object.keys(value).length > 0, `${location}: empty node would not persist`);
    for (const [key, child] of Object.entries(value)) {
      assert(!/[.#$\[\]/\u0000-\u001f\u007f]/u.test(key), `${location}: invalid Firebase key ${key}`);
      assert(Buffer.byteLength(key,'utf8') <= 768, `${location}: oversized key`);
      checkJson(child,`${location}/${key}`);
    }
  } else {
    leaves++;
    assert(['string','boolean','number'].includes(typeof value), `${location}: invalid value`);
    if (typeof value === 'number') assert(Number.isFinite(value), `${location}: invalid number`);
    if (typeof value === 'string') assert(!value.includes('AUTH_UID_') && !value.includes('REAL_ADMIN_UID'), `${location}: reference placeholder in live seed`);
  }
}
checkJson(data);
assert.equal(Object.keys(data.categories).length,4);
assert.equal(Object.keys(data.topics).length,25);
assert.equal(Object.keys(data.questions).length,250);
assert.equal(Object.keys(data.contentAssets).length,30);
assert.equal(Object.keys(data.achievements).length,31);
assert.equal(data.topics.vocabulary_idioms.categoryId,'vocabulary');
const expectedSettings = {initialRating:0,ratingFloor:0,initialCoinBalance:0,winRating:5,lossRating:-2,drawRating:0,
  battleWinCoins:5,battleLossCoins:0,drawCoins:0,practiceCompletionCoins:1,testCompletionCoins:2,dailyChallengeCompletionCoins:2,
  battleQuestionCount:10,practiceQuestionCount:10,testQuestionCount:20,dailyChallengeQuestionCount:5,
  questionTimeLimitSeconds:30,reconnectGraceSeconds:30,dailyChallengeMaxAttemptsPerUserPerDay:1,
  dailyChallengeAbandonRestoresAttempt:false,dailyChallengeResumeSameAttempt:true,dailyChallengeResumeResetsDeadline:false,
  battleQuestionSetShared:true,battleSpeedTieBreaker:false,practiceAchievementTarget:20,coinRedemptionEnabled:false};
for (const [key,value] of Object.entries(expectedSettings)) assert.equal(data.appConfig.server[key],value,`wrong rule ${key}`);
const preBackendRules = JSON.parse(fs.readFileSync(path.join(dir,'../../frontend/contracts/business-rules.v1.json'),'utf8'));
for (const key of ['bothDisconnectedAfterGraceOutcome','bothDisconnectedRatingDelta','bothDisconnectedCoins',
  'dailyChallengeExpiresAtNextMidnight','dailyChallengeExpiredWireStatus','dailyChallengeExpiredWireOutcome',
  'dailyChallengeExpiredCoins','leaderboardMetric','leaderboardParticipants','weekMonthUseSameRanking','leaderboardRatingReset']) {
  assert.equal(data.appConfig.server[key],preBackendRules.confirmed[key],`business contract mismatch: ${key}`);
}
assert.equal(data.appConfig.server.dailyChallengeConsumeAttemptOn,'successful_start');
assert.equal(data.appConfig.server.dailyChallengeClaimScope,'uid_dateKey');
for (const root of ['users','userPrivate','adminProfiles','battleRooms','battleResults','analytics','dailyChallenges','userDailyChallenges','leaderboards','wallets','xpLedger','subscriptions','payments']) {
  assert(!(root in data), `${root}: must not seed fictional activity or excluded features`);
}
const allFingerprints = new Set();
const answerPositions = {};
for (const [id,q] of Object.entries(data.questions)) {
  assert(data.categories[q.categoryId],id);
  assert.equal(data.topics[q.topicId].categoryId,q.categoryId,id);
  assert.equal(data.lessons[q.lessonId].topicId,q.topicId,id);
  const version = data.questionVersions[id][q.currentVersion];
  const answer = data.questionAnswers[id][q.currentVersion];
  assert.equal(version.questionTimeLimitSeconds,30,id);
  assert.equal(Object.keys(version.options).length,4,id);
  assert.equal(new Set(Object.values(version.options).map(o=>o.text)).size,4,id);
  assert(version.options[answer.correctOptionId], `${id}: answer must reference an option`);
  assert(answer.explanation.length > 10,id);
  assert(!('correctOptionId' in version) && !('explanation' in version),`${id}: answer leaked into prompt`);
  assert.deepEqual(Object.values(version.options).map(o=>o.order).sort(),[1,2,3,4],id);
  if (q.categoryId === 'reading') assert(version.passage?.length > 30,id);
  if (q.categoryId === 'listening') {
    const asset = data.contentAssets[version.audioAssetId];
    assert.equal(asset.kind,'tts',id);
    assert.equal(asset.locale,'en-US',id);
    assert.equal(asset.speechText,answer.transcript,id);
    assert(!('storagePath' in asset), `${id}: no fabricated audio files`);
  }
  const fingerprint = JSON.stringify([version.prompt,version.passage ?? '',version.audioAssetId ?? '']);
  assert(!allFingerprints.has(fingerprint),`${id}: duplicate question`);
  allFingerprints.add(fingerprint);
  answerPositions[answer.correctOptionId] = (answerPositions[answer.correctOptionId] ?? 0)+1;
  assert.equal(data.lessonQuestions[q.lessonId][id].version,q.currentVersion,id);
  assert.equal(data.lookupIndexes.questionsByDisplayCode[q.displayCode],id,id);
  assert.equal(data.lookupIndexes.questionsByTopic[q.topicId][id].version,q.currentVersion,id);
  assert.equal(data.lookupIndexes.questionsByCategory[q.categoryId][id].topicId,q.topicId,id);
  assert.equal(data.adminViews.questions[id].prompt,version.prompt,id);
}
for (const root of ['questionVersions','questionAnswers']) assert.deepEqual(Object.keys(data[root]),Object.keys(data.questions),root);
for (const [id,topic] of Object.entries(data.topics)) {
  assert.equal(Object.keys(data.lookupIndexes.questionsByTopic[id]).length,10,id);
  const template = data.quizTemplates[topic.defaultQuizTemplateId];
  assert.equal(template.mode,'practice',id);
  assert.equal(template.questionCount,10,id);
  assert.equal(template.questionPool.categoryId,topic.categoryId,id);
  assert.equal(template.questionPool.topicId,id,id);
  const achievement = data.achievements[`practice_20_${id}`];
  assert.equal(achievement.threshold,20,id);
  assert.equal(achievement.targetId,id,id);
  assert.equal(achievement.rewardCoins,0,id);
}
for (const [id,q] of Object.entries(data.quizTemplates)) {
  const pool = Object.entries(data.questions).filter(([,item]) => item.status === 'published'
    && (!q.questionPool.categoryId || item.categoryId === q.questionPool.categoryId)
    && (!q.questionPool.topicId || item.topicId === q.questionPool.topicId));
  assert(pool.length >= q.questionCount,`${id}: insufficient questions`);
  const count = {practice:10,test:20,dailyChallenge:5,battle:10}[q.mode];
  assert.equal(q.questionCount,count,id);
  assert.equal(q.questionTimeLimitSeconds,30,id);
  assert.equal(q.completionCoins,{practice:1,test:2,dailyChallenge:2,battle:0}[q.mode],id);
}
assert.equal(data.quizTemplates.daily_mixed.maxAttemptsPerUserPerDay,1);
assert.equal(reference.documentType,'REFERENCE_ONLY_DO_NOT_IMPORT');
assert.equal(reference.records.userDailyChallenges.path,'userDailyChallenges/{uid}/{dateKey}');
assert.equal(Object.keys(reference.records.battleQuestionSets.example).length,10);
for (const q of Object.values(reference.records.battleQuestionSets.example)) assert(data.questionVersions[q.questionId][q.version]);
assert.equal(manifest.counts.questions,Object.keys(data.questions).length);
assert.equal(manifest.counts.quizTemplates,Object.keys(data.quizTemplates).length);
assert.equal(Object.keys(data.quizTemplates).length,28);
// Every planned root in schema.md must exist either in the seed or as a runtime example.
const schema = fs.readFileSync(path.join(dir,'schema.md'),'utf8');
const sections = schema.split('## BE 1: User & Learning')[1].split('## Security Requirements')[0];
for (const line of sections.split(/\r?\n/).filter(s=>s.startsWith('- '))) {
  const names = line.slice(2).split(' (')[0].split(', ').map(name=>name.split('/')[0]);
  for (const root of names) assert(root in data || root in reference.records,`Missing planned root ${root}`);
}
const summary = {status:'PASS',questions:250,topics:25,skills:4,templates:28,achievements:31,
  ttsAssets:30,runtimeReferenceRoots:Object.keys(reference.records).length,validatedScalarValues:leaves,
  answerPositions,checks:['Firebase JSON shape and keys','all configured game rules','topic/lesson/answer/asset references',
    'sufficient questions for every template','unique question content','no fake accounts or live activity',
    'all planned schema roots covered by seed or reference'],
  limitations:['Static validation only; no Firebase import, Security Rules evaluation or backend execution performed.']};
fs.writeFileSync(path.join(dir,'seed-validation.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
