import type { DateRange, DemoState, Overview } from '../domain'
import { skills } from '../domain'
import { dayKey, rangeBounds } from '../lib'

export function calculateOverview(state: DemoState, range: DateRange, categoryId = ''): Overview {
  const { start, end } = rangeBounds(range),
    duration = end - start
  const current = state.activities.filter(
    (a) => a.at >= start && a.at < end && (!categoryId || a.categoryId === categoryId),
  )
  const previous = state.activities.filter(
    (a) => a.at >= start - duration && a.at < start && (!categoryId || a.categoryId === categoryId),
  )
  const active = (events: typeof current) =>
    new Set(events.filter((a) => a.type !== 'user').map((a) => a.userId)).size
  const pct = (n: number, before: number) =>
    before === 0 ? null : Math.round(((n - before) / before) * 1000) / 10
  const registered = (from: number, to: number) =>
    state.users.filter((u) => u.createdAt >= from && u.createdAt < to).length
  const completed = current.filter((a) => a.type === 'battle' && a.completed).length
  const series: Overview['series'] = []
  for (let at = start; at < end; at += 86400000) {
    const events = current.filter((a) => a.at >= at && a.at < at + 86400000)
    series.push({
      date: dayKey(at),
      users: state.users.filter((u) => u.createdAt < at + 86400000 && u.status !== 'deleted')
        .length,
      previous: state.users.filter(
        (u) => u.createdAt < at + 86400000 - duration && u.status !== 'deleted',
      ).length,
      lessons: events.filter((a) => a.type === 'lesson' && a.completed).length,
      battles: events.filter((a) => a.type === 'battle' && a.completed).length,
      active: active(events),
    })
  }
  const categories = skills
    .filter((id) => !categoryId || id === categoryId)
    .map((id) => {
      const events = current.filter((a) => a.categoryId === id && a.type !== 'user')
      return {
        id,
        name: state.categories.find((c) => c.id === id)!.name,
        lessons: events.filter((a) => a.type === 'lesson' && a.completed).length,
        battles: events.filter((a) => a.type === 'battle').length,
        answered: events.reduce((n, a) => n + a.answered, 0),
        correct: events.reduce((n, a) => n + a.correct, 0),
        completed: events.filter((a) => a.completed).length,
        started: events.length,
      }
    })
  const answers = current.reduce((n, a) => n + a.answered, 0),
    started = current.filter((a) => a.type !== 'user').length
  return {
    totalUsers: state.users.filter((u) => u.status !== 'deleted').length,
    newUsers: registered(start, end),
    activeUsers: active(current),
    completedBattles: completed,
    completedLessons: current.filter((a) => a.type === 'lesson' && a.completed).length,
    growth: {
      users: pct(registered(start, end), registered(start - duration, start)),
      active: pct(active(current), active(previous)),
      battles: pct(completed, previous.filter((a) => a.type === 'battle' && a.completed).length),
    },
    series,
    categories,
    accuracy: answers ? (current.reduce((n, a) => n + a.correct, 0) / answers) * 100 : null,
    completion: started
      ? (current.filter((a) => a.type !== 'user' && a.completed).length / started) * 100
      : null,
    recent: current
      .sort((a, b) => b.at - a.at)
      .slice(0, 5)
      .map((a) => ({
        ...a,
        userName: state.users.find((u) => u.id === a.userId)?.name || 'Deleted user',
      })),
    asOf: Date.now(),
  }
}
