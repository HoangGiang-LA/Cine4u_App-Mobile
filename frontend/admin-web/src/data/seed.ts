import content from './content-seed.json'
import type {
  Activity,
  BattleRecord,
  Category,
  DemoState,
  Difficulty,
  Lesson,
  QuestionRecord,
  SkillId,
  Topic,
  UserRecord,
} from '../domain'
import { skillNames, skills } from '../domain'

const day = 86_400_000
const names = [
  'Emma Wilson',
  'James Park',
  'Sofia Martinez',
  'Liam Thompson',
  'Oliver Brown',
  'Isabella Nguyen',
  'Noah Kim',
  'Ava Patel',
  'Lucas Anderson',
  'Mia Johnson',
  'Ethan Lee',
  'Chloe Davis',
  'Minh Anh',
  'Hoang Giang',
  'Amelia Chen',
  'Daniel Garcia',
  'Grace Walker',
  'Henry Scott',
]
export function createSeed(now = Date.now()): DemoState {
  const users: UserRecord[] = Array.from({ length: 54 }, (_, i) => ({
    id: `demo-user-${i + 1}`,
    code: `#${24892 - i}`,
    name:
      names[i % names.length] + (i < names.length ? '' : ` ${Math.floor(i / names.length) + 1}`),
    email: `learner${i + 1}@example.test`,
    status: i % 9 === 4 ? 'banned' : 'active',
    createdAt: now - (i * 3 + 1) * day,
    updatedAt: now - i * day,
    rating: (54 - i) * 5,
    coins: (54 - i) * 3,
  }))
  const categories: Category[] = skills.map((id) => ({
    id,
    name: skillNames[id],
    description: `Manage ${skillNames[id].toLowerCase()} learning content.`,
    status: 'published',
  }))
  const topics: Topic[] = Object.entries(content.topics).map(([id, t]) => ({
    id,
    categoryId: t.categoryId as SkillId,
    title: t.title,
    description: '',
    status: 'published',
  }))
  const lessons: Lesson[] = Object.entries(content.lessons).map(([id, l]) => ({
    id,
    topicId: l.topicId,
    title: l.title,
    description: l.description || '',
    difficulty: l.difficulty as Difficulty,
    status: 'published',
  }))
  const versions = content.questionVersions as Record<
    string,
    Record<
      string,
      {
        prompt: string
        options: Record<string, { text: string; order: number }>
        passage?: string | null
        audioAssetId?: string | null
        ttsText?: string
        audioText?: string
      }
    >
  >
  const answers = content.questionAnswers as Record<
    string,
    Record<string, { correctOptionId: string; explanation: string }>
  >
  const questions: QuestionRecord[] = Object.entries(content.questions).map(([id, q], i) => {
    const v = versions[id][q.currentVersion],
      a = answers[id][q.currentVersion]
    return {
      id,
      code: `#${q.displayCode}`,
      categoryId: q.categoryId as SkillId,
      topicId: q.topicId,
      lessonId: q.lessonId,
      prompt: v.prompt,
      options: Object.entries(v.options)
        .sort((x, y) => x[1].order - y[1].order)
        .map(([id, o]) => ({ id, text: o.text })),
      correctOptionId: a.correctOptionId,
      explanation: a.explanation,
      passage: v.passage || '',
      audioUrl: '',
      audioText:
        v.ttsText ||
        v.audioText ||
        (v.audioAssetId
          ? (content.contentAssets as Record<string, { speechText?: string }>)[v.audioAssetId]
              ?.speechText || ''
          : ''),
      difficulty: q.difficulty as Difficulty,
      status: i % 29 === 0 ? 'draft' : i % 47 === 0 ? 'archived' : 'published',
      version: 1,
      createdAt: now - ((i + 1) * day) / 2,
      updatedAt: now - i * 60000,
    }
  })
  const battles: BattleRecord[] = Array.from({ length: 64 }, (_, i) => {
    const startedAt = now - (i < 3 ? i * 20000 : (i - 2) * day),
      status = i < 3 ? 'ongoing' : i % 13 === 0 ? 'abandoned' : 'completed'
    const score1 = i < 3 ? 8 - i : 6 + (i % 5),
      score2 = i < 3 ? 7 - i : 4 + (i % 7)
    return {
      id: `demo-battle-${i + 1}`,
      code: `#B${18642 - i}`,
      player1: users[i % users.length].id,
      player2: users[(i + 1) % users.length].id,
      player1Name: users[i % users.length].name,
      player2Name: users[(i + 1) % users.length].name,
      score1,
      score2,
      status,
      mode: i % 3 === 0 ? 'quick' : i % 3 === 1 ? 'daily' : 'private',
      categoryId: i % 5 === 0 ? 'mixed' : skills[i % 4],
      startedAt,
      endedAt: status === 'ongoing' ? null : startedAt + 180000,
      logs: [
        {
          id: 'created',
          at: startedAt,
          type: 'room_created',
          message: 'Room created with a fixed set of 10 questions.',
        },
        {
          id: 'joined',
          at: startedAt + 1000,
          type: 'players_ready',
          message: 'Both players joined. Shared question deadline: 30 seconds.',
        },
        {
          id: 'round',
          at: startedAt + 31000,
          type: 'round_closed',
          message: 'Round 1 closed. Answers committed.',
        },
        ...(status === 'ongoing'
          ? []
          : [
              {
                id: 'result',
                at: startedAt + 180000,
                type: status === 'completed' ? 'battle_completed' : 'player_left',
                message:
                  status === 'completed'
                    ? `Final score ${score1}–${score2}. Result settled once.`
                    : 'A player left. Result recorded by the simulated service.',
              },
            ]),
      ],
    }
  })
  const activities: Activity[] = users.map((u) => ({
    id: `join-${u.id}`,
    userId: u.id,
    text: 'Joined English Battle',
    type: 'user',
    at: u.createdAt,
    categoryId: 'mixed',
    answered: 0,
    correct: 0,
    completed: true,
  }))
  for (let i = 0; i < 180; i++) {
    const at = now - (i + 0.3) * day,
      u = users[i % users.length]
    if (at >= u.createdAt)
      activities.push({
        id: `lesson-${i}`,
        userId: u.id,
        text: `Completed ${skillNames[skills[i % 4]]} practice · ${7 + (i % 4)}/10 correct`,
        type: 'lesson',
        at,
        categoryId: skills[i % 4],
        answered: 10,
        correct: 7 + (i % 4),
        completed: i % 11 !== 0,
      })
  }
  for (const b of battles)
    activities.push({
      id: `activity-${b.id}`,
      userId: b.player1,
      text: `${b.status === 'completed' ? 'Completed' : b.status === 'ongoing' ? 'Started' : 'Left'} a ${b.mode} battle · ${b.score1}–${b.score2}`,
      type: 'battle',
      at: b.startedAt,
      categoryId: b.categoryId,
      answered: b.status === 'ongoing' ? 8 : 10,
      correct: b.score1,
      completed: b.status === 'completed',
    })
  return {
    schemaVersion: 1,
    profile: {
      id: 'demo-admin',
      name: 'Alex Chen',
      email: 'admin@example.test',
      role: 'administrator',
    },
    users,
    categories,
    topics,
    lessons,
    questions,
    questionHistory: {},
    battles,
    activities,
    notifications: [
      {
        id: 'n1',
        title: 'Content ready for review',
        body: 'Draft questions are waiting in your question bank.',
        at: now - 240000,
        read: false,
        page: 'content',
      },
      {
        id: 'n2',
        title: 'Recent battle activity',
        body: 'Open the battle log to review simulated match events.',
        at: now - 3600000,
        read: false,
        page: 'battles',
      },
      {
        id: 'n3',
        title: 'Welcome to your demo workspace',
        body: 'Changes are saved in this browser. Firebase is not connected.',
        at: now - day,
        read: true,
        page: 'dashboard',
      },
    ],
    audit: [],
  }
}
