import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {questions as authored} from './question-bank.mjs';
import './reading-bank.mjs';
import './listening-bank.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const output = path.dirname(dir);
// Fixed content-release time, not a fake user activity timestamp.
const releasedAt = Date.parse('2026-10-24T00:00:00+07:00');
const categories = {
  vocabulary: {name: 'Từ vựng', englishName: 'Vocabulary', slug: 'vocabulary', icon: 'spellcheck', sortOrder: 1, status: 'published'},
  grammar: {name: 'Ngữ pháp', englishName: 'Grammar', slug: 'grammar', icon: 'extension', sortOrder: 2, status: 'published'},
  listening: {name: 'Nghe', englishName: 'Listening', slug: 'listening', icon: 'headphones', sortOrder: 3, status: 'published'},
  reading: {name: 'Đọc hiểu', englishName: 'Reading', slug: 'reading', icon: 'menu_book', sortOrder: 4, status: 'published'},
};
const topicDefinitions = {
  vocabulary: [['daily_life','Đời sống hằng ngày'],['travel','Du lịch'],['work','Công việc'],['food','Ăn uống'],['study','Học tập'],['health','Sức khỏe'],['idioms','Idioms & Phrases']],
  grammar: [['tenses','Thì (Tenses)'],['prepositions','Giới từ (Prepositions)'],['articles','Mạo từ (Articles)'],['nouns','Danh từ (Nouns)'],['verbs','Động từ (Verbs)'],['adjectives','Tính từ (Adjectives)']],
  listening: [['daily_life','Hội thoại hằng ngày'],['travel','Du lịch'],['work','Công việc'],['education','Giáo dục'],['food','Ăn uống'],['health','Sức khỏe']],
  reading: [['daily_life','Đời sống hằng ngày'],['travel','Du lịch'],['science','Khoa học & Công nghệ'],['education','Giáo dục'],['culture','Văn hóa & Xã hội'],['health','Sức khỏe']],
};
const quiz = (mode, questionCount, completionCoins, questionPool) => ({
  mode, questionCount, questionTimeLimitSeconds: 30, selectionMode: 'random_without_replacement',
  questionPool, completionCoins, completionPolicy: 'all_questions_resolved',
  timeoutCountsAsIncorrect: true, scoringVersion: 'v1', status: 'published',
});
const seed = {
  appConfig: {
    public: {appName: 'English Battle', schemaVersion: 1, contentVersion: '2026-10-24-v1',
      language: 'vi', contentLanguage: 'en', timeZone: 'Asia/Ho_Chi_Minh',
      questionTimeLimitSeconds: 30, practiceAchievementTarget: 20, coinRedemptionEnabled: false},
    server: {
      rulesVersion: 'v1', timeZone: 'Asia/Ho_Chi_Minh', weekStartsOn: 'monday',
      initialRating: 0, ratingFloor: 0, initialCoinBalance: 0,
      winRating: 5, lossRating: -2, drawRating: 0,
      battleWinCoins: 5, battleLossCoins: 0, drawCoins: 0,
      practiceCompletionCoins: 1, testCompletionCoins: 2, dailyChallengeCompletionCoins: 2,
      battleQuestionCount: 10, practiceQuestionCount: 10, testQuestionCount: 20, dailyChallengeQuestionCount: 5,
      questionTimeLimitSeconds: 30, reconnectGraceSeconds: 30,
      dailyChallengeMaxAttemptsPerUserPerDay: 1, dailyChallengeConsumeAttemptOn: 'successful_start',
      dailyChallengeAbandonRestoresAttempt: false, dailyChallengeResumeSameAttempt: true,
      dailyChallengeResumeResetsDeadline: false, dailyChallengeClaimScope: 'uid_dateKey',
      battleQuestionSetShared: true, battleWinnerMetric: 'correct_count', battleSpeedTieBreaker: false,
      battleExplicitLeaveOutcome: 'loss', battleDisconnectTimeoutOutcome: 'loss',
      bothDisconnectedAfterGraceOutcome: 'draw', bothDisconnectedRatingDelta: 0, bothDisconnectedCoins: 0,
      dailyChallengeExpiresAtNextMidnight: true, dailyChallengeExpiredWireStatus: 'abandoned',
      dailyChallengeExpiredWireOutcome: 'abandoned', dailyChallengeExpiredCoins: 0,
      leaderboardMetric: 'current_cumulative_rating', leaderboardParticipants: 'all_users',
      weekMonthUseSameRanking: true, leaderboardRatingReset: false,
      practiceAchievementTarget: 20, practiceProgressMetric: 'completed_attempts',
      practiceRepeatCompletedAttemptCounts: true, duplicateRequestCounts: false,
      practiceAchievementCoinBonus: 0, coinRedemptionEnabled: false,
      defaultTestTemplateId: 'test_mixed', defaultDailyChallengeTemplateId: 'daily_mixed',
      defaultBattleTemplateId: 'battle_mixed',
    },
  },
  categories, topics: {}, lessons: {}, lessonQuestions: {},
  questions: {}, questionVersions: {}, questionAnswers: {}, contentAssets: {}, quizTemplates: {},
  achievements: {},
  lookupIndexes: {topicsByCategory: {}, lessonsByTopic: {}, questionsByCategory: {}, questionsByTopic: {}, questionsByDisplayCode: {}},
  adminViews: {questions: {}},
};

for (const [categoryId, entries] of Object.entries(topicDefinitions)) {
  seed.lookupIndexes.topicsByCategory[categoryId] = {};
  seed.lookupIndexes.questionsByCategory[categoryId] = {};
  entries.forEach(([slug, title], i) => {
    const topicId = `${categoryId}_${slug}`;
    const lessonId = `lesson_${topicId}`;
    const templateId = `practice_${topicId}`;
    seed.topics[topicId] = {categoryId, title, slug, sortOrder: i + 1, status: 'published',
      defaultLessonId: lessonId, defaultQuizTemplateId: templateId, completionTarget: 20};
    seed.lessons[lessonId] = {topicId, categoryId, title: `Luyện tập: ${title}`, difficulty: 'easy',
      status: 'published', version: 'v1', quizTemplateId: templateId,
      description: 'Hoàn thành 10 câu ngẫu nhiên. Mỗi câu có 30 giây; hoàn thành bài nhận 1 xu.'};
    seed.lessonQuestions[lessonId] = {};
    seed.quizTemplates[templateId] = {...quiz('practice', 10, 1, {categoryId, topicId, status: 'published'}),
      title: `Luyện tập ${title}`, progressTopicId: topicId, lessonId};
    seed.achievements[`practice_20_${topicId}`] = {title: `Chăm chỉ: ${title}`, description: `Hoàn thành luyện tập mục ${title} 20 lần.`,
      icon: 'school', conditionType: 'practice_completion_count', targetId: topicId, threshold: 20,
      rewardCoins: 0, ruleVersion: 'v1', status: 'published', sortOrder: Object.keys(seed.achievements).length + 1};
    seed.lookupIndexes.topicsByCategory[categoryId][topicId] = {sortOrder: i + 1};
    seed.lookupIndexes.lessonsByTopic[topicId] = {[lessonId]: {sortOrder: 1}};
    seed.lookupIndexes.questionsByTopic[topicId] = {};
  });
}

// Mixed-skill pools are explicit starter defaults, documented in HUONG-DAN-NHAP.md.
seed.quizTemplates.test_mixed = {...quiz('test',20,2,{scope:'all_categories',status:'published'}), title:'Bài kiểm tra tổng hợp'};
seed.quizTemplates.daily_mixed = {...quiz('dailyChallenge',5,2,{scope:'all_categories',status:'published'}), title:'Thử thách hằng ngày', maxAttemptsPerUserPerDay:1};
seed.quizTemplates.battle_mixed = {...quiz('battle',10,0,{scope:'all_categories',status:'published'}), title:'Thi đấu 1v1',
  sharedQuestionSet:true, winCoins:5, lossCoins:0, drawCoins:0, winRating:5, lossRating:-2, drawRating:0, ratingFloor:0};

const counters = {};
const assetIds = new Map();
authored.forEach((q, i) => {
  if (!seed.topics[q.topicId] || seed.topics[q.topicId].categoryId !== q.categoryId) throw new Error(`Unknown topic ${q.topicId}`);
  const n = counters[q.topicId] = (counters[q.topicId] ?? 0) + 1;
  const id = `q_${q.topicId}_${String(n).padStart(3,'0')}`;
  const displayCode = `Q${String(i+1).padStart(5,'0')}`;
  const values = [q.correct, ...q.distractors];
  if (values.length !== 4 || values.some(v => !v) || new Set(values).size !== 4 || !q.explanation) throw new Error(`Bad content ${id}`);
  // Stable positions for the authored bank; backend can shuffle while retaining option IDs.
  const shift = i % 4;
  const rotated = values.map((_, j) => values[(j + shift) % 4]);
  const options = Object.fromEntries(rotated.map((text, j) => [`opt_${j+1}`, {text, order:j+1}]));
  const correctOptionId = `opt_${rotated.indexOf(q.correct)+1}`;
  const metadata = {displayCode, categoryId:q.categoryId, topicId:q.topicId, lessonId:`lesson_${q.topicId}`,
    difficulty:q.difficulty, type:q.categoryId === 'listening' ? 'listening_single_choice' : q.categoryId === 'reading' ? 'reading_single_choice' : 'single_choice',
    currentVersion:'v1', status:'published', createdAt:releasedAt, updatedAt:releasedAt, source:'original_starter_content'};
  const version = {prompt:q.prompt, options, version:'v1', language:'en', questionTimeLimitSeconds:30};
  const answer = {correctOptionId, explanation:q.explanation, explanationLanguage:'vi', scoringType:'correct_count', correctPoints:1, incorrectPoints:0};
  if (q.passage) version.passage = q.passage;
  if (q.speechText) {
    if (!assetIds.has(q.speechText)) {
      const assetId = `tts_${String(assetIds.size+1).padStart(3,'0')}`;
      assetIds.set(q.speechText, assetId);
      seed.contentAssets[assetId] = {kind:'tts', locale:'en-US', speechText:q.speechText, status:'published', version:'v1', createdAt:releasedAt};
    }
    version.audioAssetId = assetIds.get(q.speechText);
    answer.transcript = q.speechText;
  }
  seed.questions[id] = metadata;
  seed.questionVersions[id] = {v1:version};
  seed.questionAnswers[id] = {v1:answer};
  seed.lessonQuestions[metadata.lessonId][id] = {order:n, version:'v1'};
  seed.lookupIndexes.questionsByCategory[q.categoryId][id] = {version:'v1', topicId:q.topicId};
  seed.lookupIndexes.questionsByTopic[q.topicId][id] = {version:'v1'};
  seed.lookupIndexes.questionsByDisplayCode[displayCode] = id;
  seed.adminViews.questions[id] = {...metadata, prompt:q.prompt, searchText:q.prompt.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase()};
});

const battleBadges = [
  ['first_win','Chiến thắng đầu tiên','battle_wins',1],
  ['three_win_streak','Chuỗi bất bại','battle_win_streak',3],
  ['ten_wins','Ngôi sao đang lên','battle_wins',10],
  ['twenty_battles','Không ngừng thử sức','settled_battle_count',20],
  ['fifty_wins','Bậc thầy chiến thắng','battle_wins',50],
  ['seven_daily_challenges','Thử thách gia','completed_daily_challenge_count',7],
];
for (const [id,title,conditionType,threshold] of battleBadges) seed.achievements[id] = {
  title, conditionType, threshold, rewardCoins:0, ruleVersion:'v1', status:'published', icon:'emoji_events',
  sortOrder:Object.keys(seed.achievements).length+1,
};

const write = (name, value) => fs.writeFileSync(path.join(output,name), JSON.stringify(value,null,2)+'\n','utf8');
write('english-battle.seed.json',seed);
write('seed-manifest.json', {
  schemaVersion:1, generatedFrom:'seed/build-seed.mjs', contentRelease:'2026-10-24',
  counts:{categories:Object.keys(categories).length,topics:Object.keys(seed.topics).length,lessons:Object.keys(seed.lessons).length,
    questions:Object.keys(seed.questions).length,ttsAssets:Object.keys(seed.contentAssets).length,quizTemplates:Object.keys(seed.quizTemplates).length,
    achievements:Object.keys(seed.achievements).length},
  questionsPerCategory:Object.fromEntries(Object.keys(categories).map(k=>[k,Object.keys(seed.lookupIndexes.questionsByCategory[k]).length])),
  questionsPerTopic:counters,
  starterDefaults:{mixedPoolsFor:['test','dailyChallenge','battle'],practicePool:'selected_category_and_topic',
    timeZone:'Asia/Ho_Chi_Minh',selection:'random_without_replacement',audio:'Android Text-to-Speech; no uploaded audio files',
    achievements:'25 confirmed topic milestones plus 6 starter badge definitions based on existing UI'},
  importFile:'english-battle.seed.json', examplesFile:'runtime-examples.reference.json',
  warning:'Import only importFile into an empty RTDB. Runtime examples are documentation, not real accounts or activity.',
});
console.log(`Created seed: ${Object.keys(seed.questions).length} questions, ${Object.keys(seed.topics).length} topics.`);
