/* The analytics page — synthesis over the action log, never the log itself:
   effective completions (a complete→uncheck arc doesn't count), streak, the
   daily-miss replay (paused days fold, deleted habits still count for the
   days they existed), tracked time split at the 6am boundary, the month
   heatmap, the project/priority splits, and the days ledger opening into day
   cards. Derivations are folded per render — the data is dozens of rows. */

import { useMemo, useState } from 'react'
import {
  dayISO, fmtDay, fmtDuration, todayISO,
  type ActionRow, type Item, type Project, type SessionRow,
} from './model'
import { PriorityBars } from './DemoList'

type Range = 'today' | 'week' | 'month' | 'all'
const SPAN: Record<Range, number> = { today: 1, week: 7, month: 30, all: 400 }

// Effective completions: completed actions that were never uncompleted later.
// Rows without an item (history one-offs) always count.
function effective(actions: ActionRow[]): ActionRow[] {
  const kept: ActionRow[] = []
  const stacks = new Map<number, ActionRow[]>()
  for (const a of actions) {
    if (a.verb === 'completed') {
      if (a.itemId == null) kept.push(a)
      else {
        const st = stacks.get(a.itemId) ?? []
        st.push(a)
        stacks.set(a.itemId, st)
      }
    } else if (a.verb === 'uncompleted' && a.itemId != null) {
      stacks.get(a.itemId)?.pop()
    }
  }
  stacks.forEach((st) => kept.push(...st))
  return kept.sort((a, b) => a.ts - b.ts)
}

function monthGrid(counts: Map<string, number>, picked: string | null, onPick: (day: string) => void) {
  const today = new Date()
  const y = today.getFullYear()
  const m = today.getMonth()
  const first = new Date(y, m, 1)
  const lead = (first.getDay() + 6) % 7 // Monday-first
  const days = new Date(y, m + 1, 0).getDate()
  const cells: Array<{ day: string | null; n: number | null }> = []
  for (let i = 0; i < lead; i++) cells.push({ day: null, n: null })
  for (let d = 1; d <= days; d++) {
    const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ day: iso, n: counts.get(iso) ?? 0 })
  }
  const level = (n: number) => (n <= 0 ? '' : n === 1 ? ' l1' : n === 2 ? ' l2' : n <= 4 ? ' l3' : ' l4')
  return (
    <div className="cal">
      <div className="cal-head">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}</div>
      <div className="cal-grid">
        {cells.map((c, i) => {
          if (!c.day) return <span key={i} className="cal-cell blank" />
          const future = c.day > todayISO()
          const isToday = c.day === todayISO()
          return (
            <button
              key={i}
              className={`cal-cell${level(c.n ?? 0)}${future ? ' future' : ''}${isToday ? ' today' : ''}${picked === c.day ? ' picked' : ''}`}
              onClick={() => !future && onPick(c.day!)}
              title={`${fmtDay(c.day)} — ${c.n} done`}
            >
              <span className="n">{Number(c.day.slice(8))}</span>
              {(c.n ?? 0) > 0 && <span className="c">{c.n}</span>}
            </button>
          )
        })}
      </div>
      <div className="hm-legend">
        less <i style={{ background: 'var(--bg-hover)' }} />
        <i style={{ background: 'rgba(123,140,255,0.24)' }} />
        <i style={{ background: 'rgba(123,140,255,0.42)' }} />
        <i style={{ background: 'rgba(123,140,255,0.64)' }} />
        <i style={{ background: 'var(--accent)' }} /> more
      </div>
    </div>
  )
}

export default function DemoAnalytics({ items, actions, sessions, projects }: {
  items: Item[]
  actions: ActionRow[]
  sessions: SessionRow[]
  projects: Project[]
}) {
  const [range, setRange] = useState<Range>('week')
  const [picked, setPicked] = useState<string | null>(null)

  const d = useMemo(() => {
    const span = SPAN[range]
    const keys: string[] = []
    for (let k = 0; k < span; k++) keys.push(dayISO(k))
    const daySet = new Set(keys)
    const ordered = [...actions].sort((a, b) => a.ts - b.ts)
    const doneAll = effective(ordered)
    const doneRows = doneAll.filter((a) => daySet.has(a.day))

    const doneByDay = new Map<string, number>()
    doneAll.forEach((a) => doneByDay.set(a.day, (doneByDay.get(a.day) ?? 0) + 1))

    // streak — a live today with nothing yet doesn't break it
    let streak = 0
    for (let k = 0; k < 400; k++) {
      const n = doneByDay.get(dayISO(k)) ?? 0
      if (n > 0) streak++
      else if (k === 0) continue
      else break
    }

    // the daily-miss replay: a habit is expected on every day since it was
    // created; a pause window folds in, so paused days are never missed
    const dailyItems = items.filter((i) => i.section === 'daily')
    const missedByDay = new Map<string, Item[]>()
    const pausedAt = (item: Item, throughMs: number): boolean => {
      let p = false
      for (const a of ordered) {
        if (a.itemId !== item.id) continue
        if (a.ts >= throughMs) break
        if (a.verb === 'paused') p = true
        else if (a.verb === 'unpaused') p = false
      }
      return p
    }
    const completedOn = (item: Item, dayKey: string) =>
      ordered.some((a) => a.itemId === item.id && a.verb === 'completed' && a.day === dayKey)

    const missForDay = (dayKey: string): Item[] => {
      const endMs = dayStartOf(dayKey)
      return dailyItems.filter((it) =>
        it.createdDay <= dayKey && !completedOn(it, dayKey) && !pausedAt(it, endMs))
    }
    for (const k of keys.slice(1)) missedByDay.set(k, missForDay(k))

    // tracked time, split at the 6am boundary
    const timeByDay = new Map<string, number>()
    const timeByItem = new Map<string, Map<string, number>>() // day → itemText → secs
    for (const s of sessions) {
      if (s.endedAt === null) continue
      let cur = s.startedAt
      const end = s.startedAt + (s.secs ?? 0) * 1000
      while (cur < end) {
        const dayKey = dayKeyOf(cur)
        const nextBoundary = dayStartOf(dayKey) + 86400e3
        const chunk = Math.min(end, nextBoundary) - cur
        timeByDay.set(dayKey, (timeByDay.get(dayKey) ?? 0) + chunk / 1000)
        let perItem = timeByItem.get(dayKey)
        if (!perItem) { perItem = new Map(); timeByItem.set(dayKey, perItem) }
        perItem.set(s.itemText, (perItem.get(s.itemText) ?? 0) + chunk / 1000)
        cur = nextBoundary
      }
    }

    const fellByDay = new Map<string, ActionRow[]>()
    ordered.filter((a) => a.verb === 'fell to backlog' && daySet.has(a.day))
      .forEach((a) => {
        const arr = fellByDay.get(a.day) ?? []
        arr.push(a)
        fellByDay.set(a.day, arr)
      })

    // the Created subject: one `created` action per task, nothing to fold
    const createdRows = ordered.filter((a) => a.verb === 'created' && daySet.has(a.day))
    const createdByDay = new Map<string, number>()
    ordered.filter((a) => a.verb === 'created').forEach((a) =>
      createdByDay.set(a.day, (createdByDay.get(a.day) ?? 0) + 1))

    return { keys, doneRows, doneAll, doneByDay, createdByDay, createdRows, streak, missedByDay, timeByDay, timeByItem, fellByDay }
  }, [actions, items, sessions, range])

  const [subject, setSubject] = useState<'done' | 'created'>('done')
  const rows = subject === 'done' ? d.doneRows : d.createdRows
  const countByDay = subject === 'done' ? d.doneByDay : d.createdByDay
  const doneCount = rows.length
  const daysWithSignal = d.keys.filter((k) =>
    (countByDay.get(k) ?? 0) > 0 ||
    (subject === 'done' && ((d.missedByDay.get(k)?.length ?? 0) > 0 || (d.timeByDay.get(k) ?? 0) > 0)))

  const splits = useMemo(() => {
    const proj = new Map<string, number>()
    rows.forEach((a) => proj.set(a.project ?? 'none', (proj.get(a.project ?? 'none') ?? 0) + 1))
    const roster = [
      ...projects.map((p) => ({ name: p.name, count: proj.get(p.name) ?? 0 })),
      ...(proj.get('none') ? [{ name: 'none', count: proj.get('none')! }] : []),
    ]
    const prio = [0, 0, 0, 0] // P1 P2 P3 unmarked
    rows.forEach((a) => prio[a.priority == null ? 3 : a.priority - 1]++)
    const total = Math.max(1, doneCount)
    return { roster: roster.filter((r) => r.count > 0), prio, total }
  }, [rows, projects, doneCount])

  const monthName = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const pickedRow = picked ? {
    done: subject === 'done'
      ? d.doneAll.filter((a) => a.day === picked)
      : d.createdRows.filter((a) => a.day === picked),
    fell: subject === 'done' ? (d.fellByDay.get(picked) ?? []) : [],
    missed: subject === 'done' && picked < todayISO() ? (d.missedByDay.get(picked) ?? []) : [],
    time: subject === 'done' ? (d.timeByItem.get(picked) ?? new Map<string, number>()) : new Map<string, number>(),
    timeTotal: subject === 'done' ? (d.timeByDay.get(picked) ?? 0) : 0,
  } : null
  const dayTotal = d.keys.slice(1).reduce((acc, k) => acc + (d.missedByDay.get(k)?.length ?? 0), 0)

  return (
    <div className="analytics">
      <div className="filter-bar">
        <span className="subj">
          <button className={'pill' + (subject === 'done' ? ' active' : '')} onClick={() => setSubject('done')}>Done</button>
          <button className={'pill' + (subject === 'created' ? ' active' : '')} onClick={() => setSubject('created')}>Created</button>
        </span>
        {(['today', 'week', 'month', 'all'] as Range[]).map((r) => (
          <button key={r} className={'pill' + (range === r ? ' active' : '')} onClick={() => { setRange(r); setPicked(null) }}>
            {r === 'today' ? 'Today' : r === 'week' ? 'Week' : r === 'month' ? 'Month' : 'All'}
          </button>
        ))}
      </div>

      <div className="an-card an-hero">
        <div className="an-stat accent"><span className="v">{doneCount}</span><span className="l">{subject === 'done' ? 'Done' : 'Created'}</span></div>
        {range !== 'today' && <div className="an-stat"><span className="v">{(doneCount / SPAN[range]).toFixed(1)}</span><span className="l">Avg / day</span></div>}
        {subject === 'done' && <div className="an-stat"><span className="v">{d.streak}</span><span className="l">Day streak</span></div>}
        {subject === 'done' && <div className="an-stat"><span className="v">{dayTotal}</span><span className="l">Daily missed</span></div>}
        {subject === 'done' && <div className="an-stat"><span className="v">{d.fellByDay.get(todayISO())?.length ?? 0}</span><span className="l">Today missed</span></div>}
      </div>

      <div className="an-row3">
        <div className="an-card an-activity">
          <div className="an-card-title"><span>Activity</span><span className="hint">{monthName}</span></div>
          {monthGrid(subject === 'done' ? effectiveCounts(d.doneAll) : d.createdByDay, picked, setPicked)}
        </div>

        <div className="an-card">
          <div className="an-card-title"><span>Projects</span></div>
          {splits.roster.length === 0
            ? <div className="dash-empty">Nothing completed in this range yet.</div>
            : splits.roster.map((r) => (
              <div className="an-row" key={r.name}>
                <span className="name">{r.name}</span>
                <span className="track"><span className="fill" style={{ width: `${(r.count / splits.total) * 100}%` }} /></span>
                <span className="count">{r.count}</span>
              </div>
            ))}
        </div>

        <div className="an-card">
          <div className="an-card-title"><span>Priority</span></div>
          <div className="an-segbar">
            {splits.prio.map((n, i) => n > 0 && (
              <span key={i} className="seg" style={{ width: `${(n / splits.total) * 100}%`, background: ['var(--accent)', 'rgba(123,140,255,0.64)', 'rgba(123,140,255,0.42)', 'rgba(123,140,255,0.24)'][i] }} />
            ))}
          </div>
          <div className="an-seg-legend">
            {[1, 2, 3, null].map((p, i) => (
              <span key={i} className={'leg' + (splits.prio[i] === 0 ? ' zero' : '')}>
                <PriorityBars filled={p == null ? 0 : 4 - p} />
                {splits.prio[i]}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="an-card">
        {pickedRow ? (
          <>
            <div className="an-card-title an-daycard-title">
              <span className="an-daycard-head">
                <button className="an-back" title="Back to the days" onClick={() => setPicked(null)}>
                  <svg className="dd-chev left" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
                    <path d="M7.5 2 3.5 6l4 4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <span className="an-daycard-day">{picked === todayISO() ? 'Today' : fmtDay(picked!)}</span>
              </span>
              <span className="hint">
                <span>{pickedRow.done.length} {subject === 'done' ? 'done' : 'created'}</span>
                {pickedRow.missed.length > 0 && <span>{pickedRow.missed.length} missed</span>}
                {pickedRow.timeTotal > 60 && <span>{fmtDuration(pickedRow.timeTotal)}</span>}
              </span>
            </div>
            <div className="an-day-detail">
              {pickedRow.done.map((a, i) => (
                <div className="dd-row" key={`d${i}`}>
                  <span className="dd-mark">{subject === 'done' ? '✓' : '+'}</span>
                  <span className="dd-time">{hhmm(a.ts)}</span>
                  <span className="dd-text">{a.text}</span>
                  {pickedRow.time.get(a.text) && <span className="dd-secs">{fmtDuration(pickedRow.time.get(a.text)!)}</span>}
                  <span className="dd-axis">{a.priority != null && <PriorityBars filled={4 - a.priority} />}</span>
                  <span className="dd-proj">{a.project ?? ''}</span>
                </div>
              ))}
              {pickedRow.fell.map((a, i) => (
                <div className="dd-row fell" key={`f${i}`}>
                  <span className="dd-mark">↓</span>
                  <span className="dd-time">{hhmm(a.ts)}</span>
                  <span className="dd-text">{a.text}</span>
                  <span className="dd-axis">{a.priority != null && <PriorityBars filled={4 - a.priority} />}</span>
                  <span className="dd-proj">{a.project ?? ''}</span>
                </div>
              ))}
              {pickedRow.missed.map((it, i) => (
                <div className="dd-row missed" key={`m${i}`}>
                  <span className="dd-mark">○</span>
                  <span className="dd-time" />
                  <span className="dd-text">{it.text}</span>
                  <span className="dd-axis">{it.priority != null && <PriorityBars filled={4 - it.priority} />}</span>
                  <span className="dd-proj">{projects.find((p) => p.id === it.projectId)?.name ?? ''}</span>
                </div>
              ))}
              {pickedRow.done.length === 0 && pickedRow.fell.length === 0 && pickedRow.missed.length === 0 && (
                <div className="dd-empty">{subject === 'done' ? 'A quiet day — nothing done, nothing missed.' : 'Nothing was created that day.'}</div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="an-card-title"><span>Days</span></div>
            {daysWithSignal.length === 0 && <div className="dash-empty">Nothing yet — the ledger fills as you work.</div>}
            {daysWithSignal.map((k) => (
              <button key={k} className="an-day" onClick={() => setPicked(k)}>
                <span className="d">{k === todayISO() ? 'Today' : fmtDay(k)}</span>
                <span className="s">
                  <span className="done">{countByDay.get(k) ?? 0} {subject === 'done' ? 'done' : 'created'}</span>
                  {subject === 'done' && (d.missedByDay.get(k)?.length ?? 0) > 0 && <span>{d.missedByDay.get(k)!.length} missed</span>}
                  {subject === 'done' && (d.timeByDay.get(k) ?? 0) > 60 && <span className="time">{fmtDuration(d.timeByDay.get(k)!)}</span>}
                </span>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// The heatmap counts every day's effective completions, regardless of range.
function effectiveCounts(doneAll: ActionRow[]): Map<string, number> {
  const m = new Map<string, number>()
  doneAll.forEach((a) => m.set(a.day, (m.get(a.day) ?? 0) + 1))
  return m
}

// The 6am-open day's end: the next day's 6am.
function dayStartOf(dayKey: string): number {
  const [y, m, dd] = dayKey.split('-').map(Number)
  return new Date(y, m - 1, dd, 6, 0, 0, 0).getTime()
}

function dayKeyOf(ms: number): string {
  const dt = new Date(ms - 6 * 3600e3)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
}

function hhmm(ts: number): string {
  const dt = new Date(ts)
  return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
}
