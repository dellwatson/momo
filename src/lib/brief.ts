import type { Alert } from '@shared/watch.ts'
import type { DayLog, ShelfItem } from '@shared/types.ts'
import { nextQuestion, onboarded } from './checkin'
import { itemStats, shortName, todayKey, type MomoState } from './memory'

// The home screen greeting. Like a banking app that says "you spent less this
// week" before it shows any statement, momo leads with what it noticed.
// Everything is computed on the device from memory, with no API call.

export interface Brief {
  hello: string
  /** What momo says first, out loud when the user taps it. */
  line: string
  checkedIn: boolean
  week: { date: string; score?: 1 | 2 | 3 }[]
  goodDays: number
  lastLook?: { date: string; summary: string; change: string; photoId: string }
  watching?: { count: number; top: Alert }
  working?: { item: ShelfItem; goodDays: number; daysUsed: number }
}

const good = (d?: DayLog) => !!d?.score && d.score >= 2

function lastDays(n: number, from = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(from)
    d.setDate(d.getDate() - (n - 1 - i))
    return todayKey(d)
  })
}

export function brief(s: MomoState, alerts: Alert[]): Brief {
  const h = new Date().getHours()
  const name = s.profile.name
  const hello = `${h < 12 ? 'Good morning' : h < 18 ? 'Hi' : 'Good evening'}${name ? `, ${name}` : ''}.`
  const today = todayKey()
  const started = !!s.days[today]?.score
  const checkedIn = started && !nextQuestion(s)

  const week = lastDays(7).map((date) => ({ date, score: s.days[date]?.score }))
  const goodDays = week.filter((d) => good(s.days[d.date])).length
  const earlier = new Date()
  earlier.setDate(earlier.getDate() - 7)
  const goodBefore = lastDays(7, earlier).filter((d) => good(s.days[d])).length
  const logged = week.filter((d) => d.score).length

  const looks = Object.values(s.days)
    .filter((d) => d.look)
    .sort((a, b) => b.date.localeCompare(a.date))
  const ll = looks[0]
  const lastLook = ll?.look && { date: ll.date, summary: ll.look.summary, change: ll.look.change, photoId: ll.look.photoId }

  const real = alerts.filter((a) => a.level !== 'tip')
  const watching = real.length ? { count: real.length, top: real[0] } : undefined

  const days = Object.values(s.days)
  const working = s.shelf
    .map((item) => ({ item, ...itemStats(item, days) }))
    .filter((x) => x.daysUsed >= 3 && x.goodDays / x.daysUsed >= 0.8)
    .sort((a, b) => b.goodDays - a.goodDays)[0]

  const parts: string[] = []
  if (!onboarded(s)) parts.push(name ? "Let's finish getting to know your skin. It takes a minute." : "I'm momo. I follow your skin with you, day by day, and I watch your products. Shall we start?")
  else {
    if (logged >= 3) {
      const diff = goodDays - goodBefore
      parts.push(`Your skin had ${goodDays} good day${goodDays === 1 ? '' : 's'} this week${goodBefore && diff ? `, ${Math.abs(diff)} ${diff > 0 ? 'more' : 'fewer'} than last week` : ''}.`)
    }
    if (lastLook?.change === 'better') parts.push('Your last skin check looked better than the one before.')
    if (lastLook?.change === 'worse') parts.push('Your last skin check showed a little more going on. Let us keep an eye on it.')
    if (watching) parts.push(watching.count === 1 ? 'One thing on your shelf needs a look.' : `${watching.count} things on your shelf need a look.`)
    else if (s.shelf.length) parts.push(`All ${s.shelf.length} of your products get along.`)
    if (working) parts.push(`${shortName(working.item)} is working well for you.`)
    parts.push(checkedIn ? "Today's diary is saved." : started ? "Let's finish today's check-in." : 'Ready for a quick check-in?')
  }

  return { hello, line: parts.slice(0, 3).join(' ') + (parts.length > 3 ? ` ${parts.at(-1)}` : ''), checkedIn, week, goodDays, lastLook, watching, working: working && { item: working.item, goodDays: working.goodDays, daysUsed: working.daysUsed } }
}
