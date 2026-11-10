/* The analytics page — the app's Analytics view, ported: three subjects
   (Done / Created / Missed), a range (Week / Month / Last 7 / Last 30 / All
   / Custom from–to, Month default and Month is ONE state with the calendar's
   month pager), the axis scope filters (Projects / Priority / Delegation,
   OR within an axis AND across), and the card dashboard:

   - the hero, fully scoped, with each subject's section split (Done → daily
     / today done; Created → daily / today / backlog created; Missed → the
     two verdicts);
   - the Activity card — the month heatmap (six fixed week rows, no legend)
     whose ‹ › pager drives the whole dashboard under Month, opening a day
     into the SAME card (the hidden calendar is the sizer: the frame never
     resizes, a long day scrolls inside it);
   - the split cards, the filter's own surface: entries are picks wired to
     the toolbar's selections, and their counts are FACET counts — each card
     drops its own axis from its split, so selecting a project never zeroes
     its peers while every other number stays fully scoped;
   - the Tasks card — the window's rows flattened (✓ + ↓ ○), ten a page.

   The derivations fold per render from the action log — the same rules the
   app's dashboard.rs runs: the effective completion set (last event per
   item per day wins), the daily-miss replay reconstructed from the log
   (paused days fold, deleted habits still count for the days they existed,
   the live today has no verdict), write-time snapshots everywhere, and
   tracked time split at the 6am boundary (day detail only — time never
   follows the scope). */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  dayISO, fmtDuration, fmtReminder, projectColor, todayISO,
  type ActionRow, type Item, type Priority, type Project, type Section, type SessionRow,
} from './model'
import { PriorityBars } from './DemoList'
import type { Features } from './DemoSettings'

type Subject = 'done' | 'created' | 'missed'
type Range = 'week' | 'month' | 'd7' | 'd30' | 'all' | 'custom'
type ViewMonth = { y: number; m: number }

/** The range presets — Custom is reached through the from–to fields, never
 *  offered as a menu row. */
const RANGES: { id: Range; label: string }[] = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'd7', label: 'Last 7 days' },
  { id: 'd30', label: 'Last 30 days' },
  { id: 'all', label: 'All' },
]

const SUBJECTS: Subject[] = ['done', 'created', 'missed']

/* ---- the scope filter -----------------------------------------------------
   OR within an axis, AND across axes; null = unfiltered. "" in the project
   selection is the "no project" bucket, 0 in the tier selection the
   unmarked tier. The facet views (Scope::without_* in dashboard.rs) drop
   one axis so a split card never restates its own filter. */

interface Scope {
  projects: Set<string> | null
  tiers: Set<number> | null
  agent: boolean | null
}

function allowsRow(s: Scope, project: string | null, priority: Priority, agent: boolean): boolean {
  if (s.projects && !s.projects.has(project ?? '')) return false
  if (s.tiers && !s.tiers.has(priority ?? 0)) return false
  if (s.agent != null && s.agent !== agent) return false
  return true
}

function without(s: Scope, axis: 'projects' | 'tiers' | 'agent'): Scope {
  const next = { ...s }
  next[axis] = null
  return next
}

/* ---- the calendar (calendar.ts port) -------------------------------------- */

const level = (n: number): number => (n <= 0 ? 0 : n >= 7 ? 4 : n >= 4 ? 3 : n >= 2 ? 2 : 1)

// Monday-first month grid, padded to six week rows so every month renders
// the same height (the tallest month's shape).
interface CalCell { date: string; day: number; n: number; future: boolean; isToday: boolean }
function monthCalendar(counts: Map<string, number>, view: ViewMonth): Array<CalCell | null> {
  const today = todayISO()
  const lead = (new Date(view.y, view.m, 1).getDay() + 6) % 7
  const days = new Date(view.y, view.m + 1, 0).getDate()
  const cells: Array<CalCell | null> = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let d = 1; d <= days; d++) {
    const date = localISO(new Date(view.y, view.m, d))
    cells.push({ date, day: d, n: counts.get(date) ?? 0, future: date > today, isToday: date === today })
  }
  while (cells.length < 42) cells.push(null)
  return cells
}

const currentMonth = (): ViewMonth => {
  const t = new Date(todayISO() + 'T00:00:00')
  return { y: t.getFullYear(), m: t.getMonth() }
}

const shiftMonth = (v: ViewMonth, delta: number): ViewMonth => {
  const d = new Date(v.y, v.m + delta, 1)
  return { y: d.getFullYear(), m: d.getMonth() }
}

const monthOfDate = (date: string): ViewMonth => {
  const d = new Date(date + 'T00:00:00')
  return { y: d.getFullYear(), m: d.getMonth() }
}

function localISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/* ---- the one chevron, rotated open (Chevron.tsx port) --------------------- */

function Chevron({ className = '' }: { className?: string }) {
  return (
    <svg className={`dd-chev ${className}`} viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
      <path d="M4.5 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ---- the derivations (dashboard.rs port) ---------------------------------- */

interface Effective {
  done: boolean
  section: Section | null
  project: string | null
  priority: Priority
  agent: boolean
}

interface MissedHabit {
  itemId: string
  text: string
  project: string | null
  priority: Priority
  agent: boolean
}

interface FellRow {
  day: string
  time: string
  text: string
  project: string | null
  priority: Priority
  agent: boolean
}

interface RangeTask {
  date: string
  time: string
  text: string
  project: string | null
  priority: Priority
  agent: boolean
  kind: 'done' | 'created' | 'fell' | 'missed'
}

const KIND_MARK: Record<RangeTask['kind'], string> = { done: '✓', created: '+', fell: '↓', missed: '○' }

const dayAfter = (d: string): string => localISO(new Date(new Date(d + 'T00:00:00').getTime() + 86400e3))
const dayStart6 = (dayKey: string): number => {
  const [y, m, dd] = dayKey.split('-').map(Number)
  return new Date(y, m - 1, dd, 6, 0, 0, 0).getTime()
}
const hhmm = (ts: number): string => {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// The effective completion set: per item per day, the day's LAST completed/
// uncompleted event decides (a complete→uncheck→never-again arc isn't done;
// a re-completed misclick counts once). UNSCOPED — every consumer applies
// its scope at read (the facet rule).
function foldDone(ordered: ActionRow[]): Map<string, Map<string, Effective>> {
  const byDay = new Map<string, Map<string, Effective>>()
  for (const a of ordered) {
    if (a.verb !== 'completed' && a.verb !== 'uncompleted') continue
    const slot = byDay.get(a.day) ?? new Map<string, Effective>()
    const eff: Effective = {
      done: a.verb === 'completed',
      section: a.section,
      project: a.project,
      priority: a.priority,
      agent: a.agent,
    }
    slot.set(String(a.itemId), eff)
    byDay.set(a.day, slot)
  }
  return byDay
}

// The daily-miss replay (replay_daily_misses port): section membership and
// pauses fold from the log itself, so habits deleted long ago still count
// for the days they existed; a pause window's days are never missed. The
// done-check reads the UNscoped daily completions — a reassigned habit
// never reads as a phantom miss. The live today gets no verdict.
function replayMisses(
  ordered: ActionRow[], items: Item[], projects: Project[],
  startDay: string, endDay: string,
): Map<string, MissedHabit[]> {
  const life = ordered.filter((a) =>
    a.itemId != null && ['created', 'moved', 'fell to backlog', 'paused', 'unpaused', 'deleted'].includes(a.verb))

  interface Live { alive: boolean; section: Section | null; paused: boolean; text: string; project: string | null; priority: Priority }
  const live = new Map<string, Live>()
  const apply = (a: ActionRow) => {
    const id = String(a.itemId)
    const slot = live.get(id) ?? { alive: false, section: null, paused: false, text: '', project: null, priority: null }
    if (a.verb === 'created' || a.verb === 'moved' || a.verb === 'fell to backlog') {
      slot.alive = true
      slot.section = a.section
      slot.text = a.text
      slot.project = a.project
      slot.priority = a.priority
    } else if (a.verb === 'paused') slot.paused = true
    else if (a.verb === 'unpaused') slot.paused = false
    else if (a.verb === 'deleted') slot.alive = false
    live.set(id, slot)
  }

  // The habits' CURRENT axes (the population is who the habit is now);
  // deleted habits fall back to their folded life-event snapshots.
  const axes = new Map<string, { project: string | null; priority: Priority; agent: boolean }>()
  for (const it of items) {
    axes.set(String(it.id), {
      project: it.projectId != null ? projects.find((p) => p.id === it.projectId)?.name ?? null : null,
      priority: it.priority,
      agent: it.agent,
    })
  }

  // The unscoped done-as-daily fold (daily_done_by_day port).
  const doneDaily = new Map<string, Set<string>>()
  for (const a of ordered) {
    if (a.verb !== 'completed' && a.verb !== 'uncompleted') continue
    const set = doneDaily.get(a.day) ?? new Set<string>()
    if (a.verb === 'completed' && a.section === 'daily') set.add(String(a.itemId))
    else set.delete(String(a.itemId))
    doneDaily.set(a.day, set)
  }

  const out = new Map<string, MissedHabit[]>()
  let idx = 0
  let d = startDay
  while (d <= endDay) {
    const dayEnd = dayStart6(dayAfter(d))
    while (idx < life.length && life[idx].ts < dayEnd) apply(life[idx++])
    const missed: MissedHabit[] = []
    if (d !== todayISO()) {
      for (const [id, it] of live) {
        if (!it.alive || it.section !== 'daily' || it.paused) continue
        if (doneDaily.get(d)?.has(id)) continue
        const ax = axes.get(id)
        missed.push({
          itemId: id,
          text: it.text,
          project: ax?.project ?? it.project,
          priority: ax?.priority ?? it.priority,
          agent: ax?.agent ?? false,
        })
      }
    }
    out.set(d, missed)
    d = dayAfter(d)
  }
  return out
}

// Tracked time split at the 6am boundary — per day total and per item.
function foldTime(sessions: SessionRow[]) {
  const byDay = new Map<string, number>()
  const byItem = new Map<string, Map<string, number>>()
  for (const s of sessions) {
    if (s.endedAt === null) continue
    let cur = s.startedAt
    const end = s.startedAt + (s.secs ?? 0) * 1000
    while (cur < end) {
      const dt = new Date(cur - 6 * 3600e3)
      const dayKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
      const next = dayStart6(dayKey) + 86400e3
      const chunk = Math.min(end, next) - cur
      byDay.set(dayKey, (byDay.get(dayKey) ?? 0) + chunk / 1000)
      const per = byItem.get(dayKey) ?? new Map<string, number>()
      per.set(s.itemText, (per.get(s.itemText) ?? 0) + chunk / 1000)
      byItem.set(dayKey, per)
      cur = next
    }
  }
  return { byDay, byItem }
}

const pickState = <T,>(selected: Set<T>, key: T): 'on' | 'off' | '' =>
  selected.has(key) ? 'on' : selected.size > 0 ? 'off' : ''

/* ---- the shell ------------------------------------------------------------ */

export default function DemoAnalytics({ items, actions, sessions, projects, features }: {
  items: Item[]
  actions: ActionRow[]
  sessions: SessionRow[]
  projects: Project[]
  features: Features
}) {
  const [subject, setSubject] = useState<Subject>('done')
  const [range, setRange] = useState<Range>('month')
  const [viewMonth, setViewMonth] = useState<ViewMonth>(currentMonth)
  const [custom, setCustom] = useState({ from: '', to: '' })
  const [pickedDay, setPickedDay] = useState<string | null>(null)

  // The axis scope selections (the FilterBar's menus and the split cards'
  // picks share them — two surfaces, one state).
  const [selProjects, setSelProjects] = useState<Set<string>>(new Set())
  const [selTiers, setSelTiers] = useState<Set<number>>(new Set())
  const [selAgent, setSelAgent] = useState<Set<'agent' | 'mine'>>(new Set())
  const toggleProject = (name: string) => setSelProjects((s) => flip(s, name))
  const toggleTier = (tier: number) => setSelTiers((s) => flip(s, tier))
  const toggleAgent = (side: 'agent' | 'mine') => setSelAgent((s) => flip(s, side))
  const clearAxes = () => { setSelProjects(new Set()); setSelTiers(new Set()); setSelAgent(new Set()) }

  const pickRange = (r: Range) => {
    setRange(r)
    if (r === 'month') setViewMonth(currentMonth()) // the preset snaps the calendar back
  }
  const enterCustom = (from: string, to: string) => {
    setCustom({ from, to })
    setRange('custom')
  }
  const shiftViewMonth = (delta: number) => setViewMonth((v) => shiftMonth(v, delta))

  // The half-open [since, until) window over the app's logical days. Month
  // and the calendar are ONE state: its bounds derive from viewMonth, so
  // paging the heatmap moves the whole dashboard.
  const bounds = useMemo<{ since?: string; until?: string }>(() => {
    switch (range) {
      case 'month': {
        const first = new Date(viewMonth.y, viewMonth.m, 1)
        const next = new Date(viewMonth.y, viewMonth.m + 1, 1)
        return { since: localISO(first), until: localISO(next) }
      }
      case 'week': {
        const t = new Date(todayISO() + 'T00:00:00')
        const monday = new Date(t)
        monday.setDate(t.getDate() - ((t.getDay() + 6) % 7))
        const end = new Date(monday)
        end.setDate(monday.getDate() + 7)
        return { since: localISO(monday), until: localISO(end) }
      }
      case 'd7': return { since: dayISO(6), until: dayISO(-1) }
      case 'd30': return { since: dayISO(29), until: dayISO(-1) }
      case 'all': return {}
      case 'custom': {
        let { from, to } = custom
        if (from && to && from > to) [from, to] = [to, from]
        return { since: from || undefined, until: to ? dayAfter(to) : undefined }
      }
    }
  }, [range, viewMonth, custom])

  const dispFrom = bounds.since ?? ''
  const dispTo = bounds.until ? dayBefore(bounds.until) : ''
  const scope: Scope = { projects: selProjects.size ? selProjects : null, tiers: selTiers.size ? selTiers : null, agent: selAgent.size === 1 ? selAgent.has('agent') : null }
  const filtered = scope.projects != null || scope.tiers != null || scope.agent != null

  const d = useMemo(() => {
    const { since, until } = bounds
    const ordered = [...actions].filter((a) => a.itemId != null).sort((a, b) => a.ts - b.ts || a.id - b.id)

    // The unscoped folds — every consumer applies its own scope at read.
    const doneByDay = foldDone(ordered)
    const fellAll: FellRow[] = ordered.filter((a) => a.verb === 'fell to backlog').map((a) => ({
      day: a.day, time: hhmm(a.ts), text: a.text, project: a.project, priority: a.priority, agent: a.agent,
    }))

    // The range's day span: honor `since` exactly; unbounded starts at the
    // log's first item action; `until` is exclusive (a custom `to` can't be
    // future — the popover disables those days), so the span ends at
    // until − 1 = today at the latest.
    const firstDay = ordered.length > 0 ? ordered[0].day : todayISO()
    const start = since ?? firstDay
    const end = until ? dayBefore(until) : todayISO()
    const days: string[] = []
    for (let k = start; k <= end; k = dayAfter(k)) days.push(k)

    // The replay spans the heatmap's whole window (the calendar's misses
    // must exist outside the range too).
    const missedByDay = replayMisses(ordered, items, projects, start < firstDay ? start : firstDay, todayISO())
    const time = foldTime(sessions)

    return { ordered, doneByDay, fellAll, days, start, end, missedByDay, time }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, items, sessions, projects, bounds.since, bounds.until])

  // ---- the dashboard, fully scoped (hero + heatmap + tasks) ---------------
  const dash = useMemo(() => {
    const { since, until } = bounds
    const inWindow = (day: string) => (!since || day >= since) && (!until || day < until)

    // Per-day counts over the whole window (the heatmap reads it all;
    // range-bounded consumers slice).
    const perDay = new Map<string, number>()
    for (const [day, itemsOfDay] of d.doneByDay) {
      let n = 0
      itemsOfDay.forEach((e) => { if (e.done && allowsRow(scope, e.project, e.priority, e.agent)) n++ })
      if (n > 0) perDay.set(day, n)
    }
    if (subject === 'created') {
      perDay.clear()
      for (const a of d.ordered) {
        if (a.verb === 'created' && allowsRow(scope, a.project, a.priority, a.agent))
          perDay.set(a.day, (perDay.get(a.day) ?? 0) + 1)
      }
    } else if (subject === 'missed') {
      perDay.clear()
      for (const [day, hs] of d.missedByDay) {
        const n = hs.filter((h) => allowsRow(scope, h.project, h.priority, h.agent)).length
        if (n > 0) perDay.set(day, n)
      }
      for (const f of d.fellAll) {
        if (allowsRow(scope, f.project, f.priority, f.agent)) perDay.set(f.day, (perDay.get(f.day) ?? 0) + 1)
      }
    }

    // The hero's range-bounded totals + section split — the simple walk over
    // the span's days keeps the split honest.
    const totals = { count: 0, dailyDone: 0, todayDone: 0, dailyCreated: 0, todayCreated: 0, backlogCreated: 0, dailyMissed: 0, todayMissed: 0 }
    for (const day of d.days) {
      if (!inWindow(day)) continue
      if (subject === 'done') {
        const itemsOfDay = d.doneByDay.get(day)
        itemsOfDay?.forEach((e) => {
          if (!e.done || !allowsRow(scope, e.project, e.priority, e.agent)) return
          totals.count++
          if (e.section === 'daily') totals.dailyDone++
          else if (e.section === 'today') totals.todayDone++
        })
        totals.dailyMissed += d.missedByDay.get(day)?.filter((h) => allowsRow(scope, h.project, h.priority, h.agent)).length ?? 0
        totals.todayMissed += d.fellAll.filter((f) => f.day === day && allowsRow(scope, f.project, f.priority, f.agent)).length
      } else if (subject === 'created') {
        for (const a of d.ordered) {
          if (a.day !== day || a.verb !== 'created' || !allowsRow(scope, a.project, a.priority, a.agent)) continue
          totals.count++
          if (a.section === 'daily') totals.dailyCreated++
          else if (a.section === 'today') totals.todayCreated++
          else if (a.section === 'backlog') totals.backlogCreated++
        }
      } else {
        const dailyMissed = d.missedByDay.get(day)?.filter((h) => allowsRow(scope, h.project, h.priority, h.agent)).length ?? 0
        const todayMissed = d.fellAll.filter((f) => f.day === day && allowsRow(scope, f.project, f.priority, f.agent)).length
        totals.count += dailyMissed + todayMissed
        totals.dailyMissed += dailyMissed
        totals.todayMissed += todayMissed
      }
    }

    return { perDay, totals }
  }, [d, scope, subject, bounds.since, bounds.until])

  // ---- the FACET splits (each card drops its own axis) --------------------
  const splits = useMemo(() => {
    const inRange = (day: string) => day >= d.start && day <= d.end
    // (day, axis-carrying row) pairs per subject — done completions, created
    // rows, miss verdicts — each read through its facet scope.
    const projScope = without(scope, 'projects')
    const tierScope = without(scope, 'tiers')
    const agentScope = without(scope, 'agent')

    const proj = new Map<string, number>()
    const tiers = [0, 0, 0, 0] // P1 P2 P3 unmarked
    const agents = { agent: 0, mine: 0 }
    const split = (day: string, project: string | null, priority: Priority, agent: boolean) => {
      if (!inRange(day)) return
      if (allowsRow(projScope, project, priority, agent)) proj.set(project ?? '', (proj.get(project ?? '') ?? 0) + 1)
      if (allowsRow(tierScope, project, priority, agent)) tiers[priority == null ? 3 : priority - 1]++
      if (allowsRow(agentScope, project, priority, agent)) agents[agent ? 'agent' : 'mine']++
    }
    if (subject === 'done') {
      for (const [day, itemsOfDay] of d.doneByDay)
        itemsOfDay.forEach((e) => { if (e.done) split(day, e.project, e.priority, e.agent) })
    } else if (subject === 'created') {
      for (const a of d.ordered) if (a.verb === 'created') split(a.day, a.project, a.priority, a.agent)
    } else {
      for (const f of d.fellAll) split(f.day, f.project, f.priority, f.agent)
      for (const [day, hs] of d.missedByDay) for (const h of hs) split(day, h.project, h.priority, h.agent)
    }

    // The projects roster zero-filled from the live roster, sorted count
    // desc, the none bucket trailing (only when it has rows).
    const roster = projects.map((p) => ({ name: p.name, count: proj.get(p.name) ?? 0 }))
    roster.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    const none = proj.get('')
    if (none) roster.push({ name: 'none', count: none })

    return { roster, tiers, agents }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, scope, subject, bounds.since, bounds.until, projects])

  // ---- the window's task rows (journal_tasks port) ------------------------
  const tasks = useMemo<RangeTask[]>(() => {
    const { since, until } = bounds
    const inWindow = (day: string) => (!since || day >= since) && (!until || day < until)
    const out: RangeTask[] = []
    if (subject === 'done') {
      for (const [day, itemsOfDay] of d.doneByDay) {
        if (!inWindow(day)) continue
        itemsOfDay.forEach((e, itemId) => {
          if (!e.done || !allowsRow(scope, e.project, e.priority, e.agent)) return
          const last = [...d.ordered].reverse().find((a) => String(a.itemId) === itemId && a.day === day && (a.verb === 'completed' || a.verb === 'uncompleted'))
          out.push({ date: day, time: last ? hhmm(last.ts) : '', text: last?.text ?? '', project: e.project, priority: e.priority, agent: e.agent, kind: 'done' })
        })
      }
    } else if (subject === 'created') {
      for (const a of d.ordered) {
        if (a.verb !== 'created' || !inWindow(a.day) || !allowsRow(scope, a.project, a.priority, a.agent)) continue
        out.push({ date: a.day, time: hhmm(a.ts), text: a.text, project: a.project, priority: a.priority, agent: a.agent, kind: 'created' })
      }
    } else {
      for (const f of d.fellAll) {
        if (!inWindow(f.day) || !allowsRow(scope, f.project, f.priority, f.agent)) continue
        out.push({ date: f.day, time: f.time, text: f.text, project: f.project, priority: f.priority, agent: f.agent, kind: 'fell' })
      }
      for (const [day, hs] of d.missedByDay) {
        if (!inWindow(day)) continue
        for (const h of hs) {
          if (!allowsRow(scope, h.project, h.priority, h.agent)) continue
          out.push({ date: day, time: '', text: h.text, project: h.project, priority: h.priority, agent: h.agent, kind: 'missed' })
        }
      }
    }
    out.sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time) || a.text.localeCompare(b.text))
    return out
  }, [d, scope, subject, bounds.since, bounds.until])

  // The picked day's detail (the calendar card's second state).
  const detail = useMemo(() => {
    if (!pickedDay) return null
    const day = pickedDay
    const tasksOfDay: Array<{ time: string; text: string; project: string | null; priority: Priority; agent: boolean; itemId?: string }> = []
    if (subject === 'done') {
      d.doneByDay.get(day)?.forEach((e, itemId) => {
        if (!e.done || !allowsRow(scope, e.project, e.priority, e.agent)) return
        const last = [...d.ordered].reverse().find((a) => String(a.itemId) === itemId && a.day === day && (a.verb === 'completed' || a.verb === 'uncompleted') && a.verb === 'completed')
        if (last) tasksOfDay.push({ time: hhmm(last.ts), text: last.text, project: e.project, priority: e.priority, agent: e.agent, itemId })
      })
      tasksOfDay.sort((a, b) => a.time.localeCompare(b.time))
    } else if (subject === 'created') {
      for (const a of d.ordered) {
        if (a.day !== day || a.verb !== 'created' || !allowsRow(scope, a.project, a.priority, a.agent)) continue
        tasksOfDay.push({ time: hhmm(a.ts), text: a.text, project: a.project, priority: a.priority, agent: a.agent })
      }
      tasksOfDay.sort((a, b) => a.time.localeCompare(b.time))
    }
    const fell = subject === 'done'
      ? d.fellAll.filter((f) => f.day === day && allowsRow(scope, f.project, f.priority, f.agent))
      : []
    const missed = subject === 'done' && day < todayISO()
      ? (d.missedByDay.get(day) ?? []).filter((h) => allowsRow(scope, h.project, h.priority, h.agent))
      : []
    const secs = subject === 'done' && features.timer && !filtered ? (d.time.byItem.get(day) ?? new Map<string, number>()) : new Map<string, number>()
    const timeTotal = subject === 'done' && features.timer && !filtered ? (d.time.byDay.get(day) ?? 0) : 0
    return { tasks: tasksOfDay, fell, missed, secs, timeTotal }
  }, [pickedDay, subject, scope, filtered, d, features.timer])

  // The month pager's bounds: back stops at the oldest month with data.
  const heat = dash.perDay
  const oldest = useMemo(() => {
    let min: string | undefined
    for (const day of heat.keys()) if (min == null || day < min) min = day
    return min
  }, [heat])
  const now = currentMonth()
  const minMonth = oldest ? monthOfDate(oldest) : now
  const isOldestMonth = viewMonth.y === minMonth.y && viewMonth.m === minMonth.m
  const isCurrentMonth = viewMonth.y === now.y && viewMonth.m === now.m

  return (
    <div className="analytics">
      <FilterBar
        subject={subject} onSubject={setSubject}
        range={range} onRange={pickRange} onCustomRange={enterCustom}
        selProjects={selProjects} selTiers={selTiers} selAgent={selAgent}
        toggleProject={toggleProject} toggleTier={toggleTier} toggleAgent={toggleAgent} clear={clearAxes}
        projects={projects} features={features}
        dispFrom={dispFrom} dispTo={dispTo}
      />

      {/* Hero — fully scoped, each lens its own numbers. */}
      <div className="an-card an-hero">
        <StatCard value={dash.totals.count} label={subject[0].toUpperCase() + subject.slice(1)} accent />
        {d.days.length > 1 && <StatCard value={(dash.totals.count / d.days.length).toFixed(1)} label="Avg / day" />}
        {subject === 'done' && <>
          <StatCard value={dash.totals.dailyDone} label="Daily done" />
          <StatCard value={dash.totals.todayDone} label="Today done" />
        </>}
        {subject === 'created' && <>
          <StatCard value={dash.totals.dailyCreated} label="Daily created" />
          <StatCard value={dash.totals.todayCreated} label="Today created" />
          <StatCard value={dash.totals.backlogCreated} label="Backlog created" />
        </>}
        {subject === 'missed' && <>
          <StatCard value={dash.totals.dailyMissed} label="Daily missed" />
          <StatCard value={dash.totals.todayMissed} label="Today missed" />
        </>}
      </div>

      <div className="an-row3">
        {/* The Activity card — the day index AND the day detail in one. The
            hidden calendar is the sizer: the frame never resizes. */}
        <section className={`an-card an-activity${pickedDay ? ' an-daycard' : ''}`}>
          {pickedDay ? (
            <div className="an-card-title">
              <span className="an-daycard-head">
                <button className="an-back" onClick={() => setPickedDay(null)} title="Back to the calendar">
                  <Chevron className="left" />
                </button>
                <span className="an-daycard-day">{pickedDay === todayISO() ? 'Today' : fmtReminder(pickedDay)}</span>
              </span>
              <span className="hint">
                {detail != null && detail.tasks.length > 0 && <span>{detail.tasks.length} {subject}</span>}
                {detail != null && detail.fell.length + detail.missed.length > 0 && <span>{detail.fell.length + detail.missed.length} missed</span>}
                {detail != null && detail.timeTotal > 60 && <span>{fmtDuration(detail.timeTotal)}</span>}
              </span>
            </div>
          ) : (
            <div className="an-card-title">
              <span className="an-cal-nav">
                <button className="an-back" onClick={() => shiftViewMonth(-1)} disabled={isOldestMonth}
                  title={isOldestMonth ? 'Oldest month with data' : 'Previous month'} aria-label="Previous month">
                  <Chevron className="left" />
                </button>
                {new Date(viewMonth.y, viewMonth.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                <button className="an-back" onClick={() => shiftViewMonth(1)} disabled={isCurrentMonth}
                  title={isCurrentMonth ? 'Current month' : 'Next month'} aria-label="Next month">
                  <Chevron />
                </button>
              </span>
            </div>
          )}
          <div className="an-activity-body">
            <div className={`cal${pickedDay ? ' cal-hidden' : ''}`} aria-hidden={pickedDay != null}>
              <div className="cal-head">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, i) => <span key={i}>{l}</span>)}</div>
              <div className="cal-grid">
                {monthCalendar(heat, viewMonth).map((c, i) => {
                  if (c == null) return <span key={`b${i}`} className="cal-cell blank" />
                  const lv = level(c.n)
                  return (
                    <button
                      key={c.date}
                      className={`cal-cell${lv > 0 ? ` l${lv}` : ''}${c.future ? ' future' : ''}${c.isToday ? ' today' : ''}`}
                      disabled={c.future}
                      title={`${fmtReminder(c.date!)}${c.n ? ` · ${c.n} ${subject}` : ''}`}
                      onClick={() => !c.future && setPickedDay(c.date!)}
                    >
                      <span className="n">{c.day}</span>
                      {c.n > 0 && <span className="c">{c.n}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
            {pickedDay && detail && (
              <div className="an-day-detail">
                {detail.tasks.map((t, i) => (
                  <div className={`dd-row ${subject}`} key={`t${i}`}>
                    <span className="dd-mark">{subject === 'created' ? '+' : '✓'}</span>
                    <span className="dd-time">{t.time}</span>
                    <span className="dd-text">{t.text}</span>
                    {subject === 'done' && features.timer && detail.secs.get(t.text) != null && detail.secs.get(t.text)! > 0 &&
                      <span className="dd-secs">{fmtDuration(detail.secs.get(t.text)!)}</span>}
                    {features.taskProjects && <span className="dd-proj">{t.project ?? ''}</span>}
                    {features.taskPriorities && <span className="dd-axis">{t.priority != null && <PriorityBars filled={4 - t.priority} />}</span>}
                  </div>
                ))}
                {detail.fell.map((f, i) => (
                  <div className="dd-row fell" key={`f${i}`}>
                    <span className="dd-mark">↓</span>
                    <span className="dd-time">{f.time}</span>
                    <span className="dd-text">{f.text}</span>
                    {features.taskProjects && <span className="dd-proj">{f.project ?? ''}</span>}
                    {features.taskPriorities && <span className="dd-axis">{f.priority != null && <PriorityBars filled={4 - f.priority} />}</span>}
                  </div>
                ))}
                {detail.missed.map((m, i) => (
                  <div className="dd-row missed" key={`m${i}`}>
                    <span className="dd-mark">○</span>
                    <span className="dd-time" />
                    <span className="dd-text">{m.text}</span>
                    {features.taskProjects && <span className="dd-proj">{m.project ?? ''}</span>}
                    {features.taskPriorities && <span className="dd-axis">{m.priority != null && <PriorityBars filled={4 - m.priority} />}</span>}
                  </div>
                ))}
                {detail.tasks.length === 0 && detail.fell.length === 0 && detail.missed.length === 0 && (
                  <div className="dd-empty">Nothing that day.</div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* The split cards stay mounted under their own filter — the card is
            the pick surface; its counts are facet counts. */}
        {features.taskProjects && splits.roster.length > 0 && (
          <ProjectsCard roster={splits.roster} selected={selProjects} onToggle={toggleProject} />
        )}
        {(features.taskPriorities || features.agent) && (
          <div className="an-stack">
            {features.taskPriorities && <PriorityCard tiers={splits.tiers} selected={selTiers} onToggle={toggleTier} />}
            {features.agent && <DelegationCard agents={splits.agents} selected={selAgent} onToggle={toggleAgent} />}
          </div>
        )}
      </div>

      {/* The window's tasks, paginated — the row-level view under the
          aggregates, following the same subject + scope. */}
      <TasksCard tasks={tasks} subject={subject} features={features} />
    </div>
  )
}

/* ---- the small pieces ------------------------------------------------------ */

function flip<T>(set: Set<T>, v: T): Set<T> {
  const next = new Set(set)
  if (next.has(v)) next.delete(v)
  else next.add(v)
  return next
}

function dayBefore(d: string): string {
  return localISO(new Date(new Date(d + 'T00:00:00').getTime() - 86400e3))
}

function StatCard({ value, label, accent }: { value: string | number; label: string; accent?: boolean }) {
  return (
    <div className={`an-stat${accent ? ' accent' : ''}`}>
      <span className="v">{value}</span>
      <span className="l">{label}</span>
    </div>
  )
}

const MAX_PROJECT_ROWS = 10

function ProjectsCard({ roster, selected, onToggle }: {
  roster: { name: string; count: number }[]
  selected: Set<string>
  onToggle: (name: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const max = Math.max(1, ...roster.map((r) => r.count))
  const rows = expanded ? roster : roster.slice(0, MAX_PROJECT_ROWS)
  const expandable = roster.length > MAX_PROJECT_ROWS
  return (
    <section className="an-card an-projects">
      <div className="an-card-title">Projects</div>
      <div className="an-proj-body">
        {rows.map((r) => {
          const state = pickState(selected, r.name === 'none' ? '' : r.name)
          return (
            <button
              key={r.name}
              className={`an-row${state ? ` ${state}` : ''}${r.count === 0 ? ' zero' : ''}`}
              title={`Filter by ${r.name === 'none' ? 'no project' : r.name}`}
              onClick={() => onToggle(r.name === 'none' ? '' : r.name)}
            >
              <span className="name">{r.name}</span>
              <span className="track"><span className="fill" style={{ width: `${(r.count / max) * 100}%` }} /></span>
              <span className="count">{r.count}</span>
            </button>
          )
        })}
        {expandable && !expanded && (
          <>
            <span className="an-proj-fade" aria-hidden="true" />
            <button className="an-proj-more" onClick={() => setExpanded(true)} title="Show all projects" aria-label="Show all projects">
              <Chevron className="open" />
            </button>
          </>
        )}
        {expandable && expanded && (
          <button className="an-proj-less" onClick={() => setExpanded(false)} title="Show the top ten" aria-label="Show the top ten">
            <Chevron className="up" />
          </button>
        )}
        {rows.length === 0 && <div className="dash-empty">Nothing in this range.</div>}
      </div>
    </section>
  )
}

const TIER_BG = ['var(--accent)', 'rgba(var(--accent-rgb), 0.62)', 'rgba(var(--accent-rgb), 0.36)', 'rgba(var(--accent-rgb), 0.16)']

function PriorityCard({ tiers, selected, onToggle }: {
  tiers: number[]
  selected: Set<number>
  onToggle: (tier: number) => void
}) {
  const total = tiers.reduce((s, n) => s + n, 0)
  return (
    <section className="an-card an-priority">
      <div className="an-card-title">Priority</div>
      <div className="an-segbar">
        {tiers.map((n, i) => (
          <span key={i} className="seg" style={{ width: total > 0 ? `${(n / total) * 100}%` : '0%', background: TIER_BG[i] }} />
        ))}
      </div>
      <div className="an-seg-legend">
        {[1, 2, 3, 0].map((t, i) => {
          const state = pickState(selected, t)
          return (
            <button
              key={t}
              className={`leg${state ? ` ${state}` : ''}`}
              title={`Filter by ${t === 0 ? 'unmarked' : `P${t}`}`}
              onClick={() => onToggle(t)}
            >
              <PriorityBars filled={t === 0 ? 0 : 4 - t} />
              {tiers[i]}
            </button>
          )
        })}
      </div>
    </section>
  )
}

function DelegationCard({ agents, selected, onToggle }: {
  agents: { agent: number; mine: number }
  selected: Set<'agent' | 'mine'>
  onToggle: (side: 'agent' | 'mine') => void
}) {
  const total = agents.agent + agents.mine
  return (
    <section className="an-card">
      <div className="an-card-title">Delegation</div>
      <div className="an-segbar">
        <span className="seg" style={{ width: total > 0 ? `${(agents.agent / total) * 100}%` : '0%', background: TIER_BG[0] }} />
        <span className="seg" style={{ width: total > 0 ? `${(agents.mine / total) * 100}%` : '0%', background: TIER_BG[2] }} />
      </div>
      <div className="an-seg-legend">
        {(['agent', 'mine'] as const).map((side) => {
          const state = pickState(selected, side)
          return (
            <button key={side} className={`leg${state ? ` ${state}` : ''}`}
              title={`Filter by ${side === 'agent' ? 'Agent' : 'Mine'}`} onClick={() => onToggle(side)}>
              {side === 'agent' ? 'Agent' : 'Mine'} {side === 'agent' ? agents.agent : agents.mine}
            </button>
          )
        })}
      </div>
    </section>
  )
}

const TASKS_PER_PAGE = 10

const EMPTY_TEXT: Record<Subject, string> = {
  done: 'No tasks in this range.',
  created: 'Nothing was created in this range.',
  missed: 'Nothing was missed in this range.',
}

function TasksCard({ tasks, subject, features }: {
  tasks: RangeTask[]
  subject: Subject
  features: Features
}) {
  const [page, setPage] = useState(0)
  useEffect(() => setPage(0), [tasks])
  const pages = Math.max(1, Math.ceil(tasks.length / TASKS_PER_PAGE))
  const pageIndex = Math.min(page, pages - 1)
  const visible = tasks.slice(pageIndex * TASKS_PER_PAGE, (pageIndex + 1) * TASKS_PER_PAGE)
  return (
    <section className="an-card an-tasks">
      <div className="an-card-title">Tasks</div>
      {tasks.length === 0 && <div className="dash-empty">{EMPTY_TEXT[subject]}</div>}
      <div className="an-day-detail">
        {visible.map((t, i) => (
          <div key={`${i}-${t.kind}-${t.date}-${t.text}`} className={`dd-row rt-${t.kind}`}>
            <span className="dd-mark">{KIND_MARK[t.kind]}</span>
            <span className="dd-day">{t.date === todayISO() ? 'Today' : fmtReminder(t.date)}</span>
            <span className="dd-text">{t.text}</span>
            {features.taskProjects && <span className="dd-proj">{t.project ?? ''}</span>}
            {features.taskPriorities && <span className="dd-axis">{t.priority != null && <PriorityBars filled={4 - t.priority} />}</span>}
          </div>
        ))}
      </div>
      {pages > 1 && (
        <div className="an-pager">
          <button className="an-back" disabled={pageIndex === 0} onClick={() => setPage(pageIndex - 1)} title="Previous tasks" aria-label="Previous tasks">
            <Chevron className="left" />
          </button>
          <span>{pageIndex + 1} / {pages}</span>
          <button className="an-back" disabled={pageIndex === pages - 1} onClick={() => setPage(pageIndex + 1)} title="More tasks" aria-label="More tasks">
            <Chevron />
          </button>
        </div>
      )}
    </section>
  )
}

/* ---- the toolbar (FilterBar port) ------------------------------------------ */

function FilterBar({
  subject, onSubject, range, onRange, onCustomRange,
  selProjects, selTiers, selAgent, toggleProject, toggleTier, toggleAgent, clear,
  projects, features, dispFrom, dispTo,
}: {
  subject: Subject
  onSubject: (s: Subject) => void
  range: Range
  onRange: (r: Range) => void
  onCustomRange: (from: string, to: string) => void
  selProjects: Set<string>
  selTiers: Set<number>
  selAgent: Set<'agent' | 'mine'>
  toggleProject: (name: string) => void
  toggleTier: (tier: number) => void
  toggleAgent: (side: 'agent' | 'mine') => void
  clear: () => void
  projects: Project[]
  features: Features
  dispFrom: string
  dispTo: string
}) {
  const [openMenu, setOpenMenu] = useState<null | 'range' | 'projects' | 'priority' | 'agent'>(null)
  const [menuHi, setMenuHi] = useState(0)
  const [dpOpen, setDpOpen] = useState<null | 'from' | 'to'>(null)
  const [dpMonth, setDpMonth] = useState<ViewMonth>(currentMonth)
  const barRef = useRef<HTMLDivElement>(null)

  const openMenuOr = (menu: typeof openMenu) => {
    setOpenMenu(openMenu === menu ? null : menu)
    setMenuHi(0)
    setDpOpen(null)
  }

  const menuItems: { key: string; toggle: () => void }[] = (() => {
    switch (openMenu) {
      case 'range':
        return RANGES.map((r) => ({ key: r.id, toggle: () => { onRange(r.id); setOpenMenu(null) } }))
      case 'projects':
        return [
          ...projects.map((p) => ({ key: p.name, toggle: () => toggleProject(p.name) })),
          { key: '', toggle: () => toggleProject('') },
        ]
      case 'priority':
        return [1, 2, 3, 0].map((t) => ({ key: String(t), toggle: () => toggleTier(t) }))
      case 'agent':
        return (['agent', 'mine'] as const).map((a) => ({ key: a, toggle: () => toggleAgent(a) }))
      default:
        return []
    }
  })()

  // Keyboard-first dropdowns: `#` opens Projects, arrows walk, Enter
  // toggles, Esc closes — capture phase, inputs excepted.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!openMenu) {
        if (e.key !== '#') return
        const el = e.target as HTMLElement | null
        if (el?.closest?.('input,textarea')) return
        e.preventDefault()
        e.stopPropagation()
        setOpenMenu('projects')
        setMenuHi(0)
        return
      }
      if ((e.target as HTMLElement | null)?.closest?.('input,textarea')) return
      if (e.key === 'Escape' || e.key === '#') {
        e.preventDefault()
        e.stopPropagation()
        setOpenMenu(null)
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        const n = menuItems.length
        if (n > 0) setMenuHi((h) => (h + (e.key === 'ArrowDown' ? 1 : n - 1)) % n)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        menuItems[menuHi]?.toggle()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [openMenu, menuHi, menuItems])

  // Outside click anywhere off the bar closes whichever surface is open.
  useEffect(() => {
    if (!openMenu && !dpOpen) return
    const onDown = (e: MouseEvent) => {
      if (barRef.current?.contains(e.target as Node)) return
      setOpenMenu(null)
      setDpOpen(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [openMenu, dpOpen])

  const openDp = (side: 'from' | 'to') => {
    if (dpOpen === side) { setDpOpen(null); return }
    setOpenMenu(null)
    const v = side === 'from' ? dispFrom : dispTo
    const base = new Date((v || todayISO()) + 'T00:00:00')
    setDpMonth({ y: base.getFullYear(), m: base.getMonth() })
    setDpOpen(side)
  }
  const setDpSide = (side: 'from' | 'to', date: string) => {
    onCustomRange(side === 'from' ? date : dispFrom, side === 'to' ? date : dispTo)
    setDpOpen(null)
  }
  const clearDpSide = (side: 'from' | 'to') => {
    onCustomRange(side === 'from' ? '' : dispFrom, side === 'to' ? '' : dispTo)
    setDpOpen(null)
  }

  const t0 = currentMonth()
  const dpCells = dpOpen ? monthCalendar(new Map(), dpMonth) : []
  const dpMonthLabel = new Date(dpMonth.y, dpMonth.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const dpIsCurrentMonth = dpMonth.y === t0.y && dpMonth.m === t0.m
  const dpRange = dispFrom && dispTo ? [dispFrom < dispTo ? dispFrom : dispTo, dispFrom < dispTo ? dispTo : dispFrom] : null
  const dpSideValue = dpOpen === 'from' ? dispFrom : dispTo

  return (
    <div className="filter-bar" ref={barRef}>
      <span className="anf-left">
        <span className="anf-wrap">
          <button className="pill anf-dd" onClick={() => openMenuOr('range')} title="The range">
            {range === 'custom' ? 'Custom' : RANGES.find((r) => r.id === range)?.label}
            <Chevron className={openMenu === 'range' ? 'up' : 'down'} />
          </button>
          {openMenu === 'range' && (
            <div className="anf-menu left" role="menu">
              {RANGES.map((r, ri) => (
                <button key={r.id} className={`anf-menu-item${range === r.id ? ' on' : ''}${menuHi === ri ? ' hi' : ''}`}
                  onClick={() => { onRange(r.id); setOpenMenu(null) }}>
                  <span className="anf-name">{r.label}</span>
                  {range === r.id && <span className="anf-check">✓</span>}
                </button>
              ))}
            </div>
          )}
        </span>
        <span className="dp">
          <button className={`pill dp-btn${dpOpen === 'from' ? ' open' : ''}${range === 'custom' ? ' active' : ''}`}
            onClick={() => openDp('from')} title="Range start">
            {dispFrom ? fmtReminder(dispFrom) : 'Start'}
          </button>
          <span className="dp-sep">–</span>
          <button className={`pill dp-btn${dpOpen === 'to' ? ' open' : ''}${range === 'custom' ? ' active' : ''}`}
            onClick={() => openDp('to')} title="Range end">
            {dispTo ? fmtReminder(dispTo) : 'End'}
          </button>
          {dpOpen && (
            <div className="dp-pop">
              <div className="dp-head">
                <button className="an-back" onClick={() => setDpMonth(shiftMonth(dpMonth, -1))} aria-label="Previous month" title="Previous month">
                  <Chevron className="left" />
                </button>
                <span className="dp-month">{dpMonthLabel}</span>
                <button className="an-back" disabled={dpIsCurrentMonth} onClick={() => setDpMonth(shiftMonth(dpMonth, 1))}
                  aria-label="Next month" title={dpIsCurrentMonth ? 'Current month' : 'Next month'}>
                  <Chevron />
                </button>
              </div>
              <div className="dp-grid">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, i) => <span key={`w${i}`} className="dp-wk">{l}</span>)}
                {dpCells.map((c, i) =>
                  c == null ? (
                    <span key={`b${i}`} className="dp-cell blank" />
                  ) : (
                    <button key={c.date} className={[
                      'dp-cell',
                      dpSideValue === c.date ? 'sel' : '',
                      dpRange && c.date >= dpRange[0] && c.date <= dpRange[1] ? 'inrange' : '',
                      c.isToday ? 'today' : '',
                      c.future ? 'future' : '',
                    ].filter(Boolean).join(' ')}
                      disabled={c.future} onClick={() => setDpSide(dpOpen, c.date!)}>
                      {c.day}
                    </button>
                  ),
                )}
              </div>
              {dpSideValue && <button className="dp-clear" onClick={() => clearDpSide(dpOpen)}>Clear</button>}
            </div>
          )}
        </span>
      </span>
      <span className="bar-spring" />
      <span className="anf-tabs">
        {SUBJECTS.map((s) => (
          <button key={s} className={`anf-tab${subject === s ? ' active' : ''}`} onClick={() => onSubject(s)}>
            {s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </span>
      <span className="bar-spring" />
      <span className="anf">
        {features.taskProjects && (
          <span className="anf-wrap">
            <button className={`pill anf-dd${selProjects.size ? ' active' : ''}`} onClick={() => openMenuOr('projects')} title="Scope the page to projects">
              Projects{selProjects.size > 0 ? ` · ${selProjects.size}` : ''}
              <Chevron className={openMenu === 'projects' ? 'up' : 'down'} />
            </button>
            {openMenu === 'projects' && (
              <div className="anf-menu" role="menu">
                {projects.map((p, pi) => (
                  <button key={p.id} className={`anf-menu-item${selProjects.has(p.name) ? ' on' : ''}${menuHi === pi ? ' hi' : ''}`}
                    onClick={() => toggleProject(p.name)}>
                    <i className="anf-dot" style={{ background: projectColor(p.id) }} />
                    <span className="anf-name">{p.name}</span>
                    {selProjects.has(p.name) && <span className="anf-check">✓</span>}
                  </button>
                ))}
                <button className={`anf-menu-item${selProjects.has('') ? ' on' : ''}${menuHi === projects.length ? ' hi' : ''}`}
                  onClick={() => toggleProject('')}>
                  <i className="anf-dot hollow" />
                  <span className="anf-name">No project</span>
                  {selProjects.has('') && <span className="anf-check">✓</span>}
                </button>
              </div>
            )}
          </span>
        )}
        {features.taskPriorities && (
          <span className="anf-wrap">
            <button className={`pill anf-dd${selTiers.size ? ' active' : ''}`} onClick={() => openMenuOr('priority')} title="Scope the page to priority tiers">
              Priority{selTiers.size > 0 ? ` · ${selTiers.size}` : ''}
              <Chevron className={openMenu === 'priority' ? 'up' : 'down'} />
            </button>
            {openMenu === 'priority' && (
              <div className="anf-menu" role="menu">
                {([1, 2, 3, 0] as const).map((t, ti) => (
                  <button key={t} className={`anf-menu-item${selTiers.has(t) ? ' on' : ''}${menuHi === ti ? ' hi' : ''}`}
                    onClick={() => toggleTier(t)}>
                    <span className="anf-bars"><PriorityBars filled={t === 0 ? 0 : 4 - t} /></span>
                    <span className="anf-name">{t === 0 ? 'Unmarked' : `P${t}`}</span>
                    {selTiers.has(t) && <span className="anf-check">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </span>
        )}
        {features.agent && (
          <span className="anf-wrap">
            <button className={`pill anf-dd${selAgent.size ? ' active' : ''}`} onClick={() => openMenuOr('agent')} title="Scope the page by who executes">
              Delegation{selAgent.size > 0 ? ` · ${selAgent.size}` : ''}
              <Chevron className={openMenu === 'agent' ? 'up' : 'down'} />
            </button>
            {openMenu === 'agent' && (
              <div className="anf-menu" role="menu">
                {(['agent', 'mine'] as const).map((a, ai) => (
                  <button key={a} className={`anf-menu-item${selAgent.has(a) ? ' on' : ''}${menuHi === ai ? ' hi' : ''}`}
                    onClick={() => toggleAgent(a)}>
                    <span className="anf-name">{a === 'agent' ? 'Agent' : 'Mine'}</span>
                    {selAgent.has(a) && <span className="anf-check">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </span>
        )}
        {(selProjects.size > 0 || selTiers.size > 0 || selAgent.size > 0) && (
          <button className="pill anf-clear" onClick={clear} title="Clear the scope filters">Clear</button>
        )}
      </span>
    </div>
  )
}
