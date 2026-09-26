/* The demo's data model — the app's shape, small enough to hold in React
   state: items (state + a self-writing action log), notes and entries
   (content, never logged), sessions (measurement). One persona, the same one
   the app's own demo mode seeds: a founder growing a small SaaS. Every seed
   timestamp is computed relative to now onto the app's 6am→6am logical day,
   so a fresh visitor always lands on a live-looking week. */

export type Section = 'today' | 'daily' | 'backlog'
export type Priority = 1 | 2 | 3 | null

export interface Item {
  id: number
  text: string
  section: Section
  status: 'active' | 'done'
  doneDay: string | null
  priority: Priority
  projectId: number | null
  agent: boolean
  details: string
  hidden: boolean
  hiddenUntil: string | null
  createdDay: string
  remindAt: string | null
}

export interface Note {
  id: number
  body: string
  priority: Priority
  projectId: number | null
  hidden: boolean
  hiddenUntil: string | null
  collapsed: boolean
}

export interface Project {
  id: number
  name: string
}

export type ActionVerb =
  | 'created' | 'completed' | 'uncompleted' | 'moved' | 'edited' | 'deleted'
  | 'fell to backlog' | 'paused' | 'unpaused'

export interface ActionRow {
  id: number
  itemId: number | null
  text: string
  verb: ActionVerb
  project: string | null
  priority: Priority
  day: string // ISO day key on the 6am boundary
  ts: number // ms — the order inside a day
}

export interface SessionRow {
  id: number
  itemId: number
  itemText: string
  startedAt: number
  endedAt: number | null
  secs: number | null
}

export interface EntryRow {
  id: number
  kind: 'journal' | 'quote'
  text: string
  day: string
  ts: number
}

export interface Seed {
  items: Item[]
  notes: Note[]
  projects: Project[]
  actions: ActionRow[]
  sessions: SessionRow[]
  entries: EntryRow[]
}

/* ---- the day runs 6am→6am ------------------------------------------------ */

export function todayISO(): string {
  return dayISO(0)
}

// ISO day key of the logical day k days ago (0 = today).
export function dayISO(k: number): string {
  const d = new Date(Date.now() - 6 * 3600e3 - k * 86400e3)
  return localISO(d)
}

// The local 6am that opens logical day k.
export function dayStart(k: number): Date {
  const d = new Date(Date.now() - 6 * 3600e3 - k * 86400e3)
  d.setHours(6, 0, 0, 0)
  return d
}

// A timestamp k logical days ago at hh:mm (hh < 6 reads as after midnight —
// still the same logical day, 18+ hours after its 6am open).
export function at(k: number, hh: number, mm: number): number {
  const h = (((hh - 6) % 24) + 24) % 24
  return dayStart(k).getTime() + h * 3600e3 + mm * 60e3
}

export function isoOf(ms: number): string {
  return localISO(new Date(ms - 6 * 3600e3))
}

function localISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function fmtDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return `${WD[dt.getDay()]}, ${MO[m - 1]} ${d}`
}

export function fmtReminder(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${MO[m - 1]} ${d}`
}

// 4920 → "1h 22m" · 1500 → "25m" · 372 → "6m"
export function fmtDuration(secs: number): string {
  const m = Math.round(secs / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

// The live timer: 1:22:07 or 22:07.
export function fmtClock(secs: number): string {
  const s = Math.max(0, Math.floor(secs))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const p = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${p(m)}:${p(ss)}` : `${p(m)}:${p(ss)}`
}

export function fmtAt(ts: number): string {
  const d = new Date(ts)
  const h = d.getHours() % 12 || 12
  return `${h}:${String(d.getMinutes()).padStart(2, '0')}`
}

/* ---- the token grammar ----------------------------------------------------- */

export interface Tags {
  text: string
  priority: Priority
  projectId: number | null
  agent: boolean
}

// Trailing !N / #tag / bare @ — composable, any order, last wins. With no
// `current` (a capture) absent tokens leave the values unset; with `current`
// (an edit) absent tokens leave the current values alone. @0 / !0 / #0 clear.
// Project tokens resolve against `projects` (exact, then unique prefix) and
// create unknown ones.
export function parseTags(
  raw: string,
  projects: Project[],
  current?: { priority: Priority; projectId: number | null; agent: boolean },
): Tags {
  const words = raw.trim().split(/\s+/)
  let priority = current?.priority ?? null
  let projectId = current?.projectId ?? null
  let agent = current?.agent ?? false
  const findProject = (name: string): number | null => {
    const n = name.toLowerCase()
    const exact = projects.find((p) => p.name.toLowerCase() === n)
    if (exact) return exact.id
    const pre = projects.filter((p) => p.name.toLowerCase().startsWith(n))
    return pre.length === 1 ? pre[0].id : null
  }
  while (words.length > 1 || (words.length === 1 && /^(![0-3]|#[\w-]+|@0?)$/.test(words[0]))) {
    const w = words[words.length - 1]
    if (w === '@') agent = true
    else if (w === '@0') agent = false
    else if (/^![0-3]$/.test(w)) priority = w === '!0' ? null : (Number(w[1]) as 1 | 2 | 3)
    else if (/^#[\w-]+$/.test(w)) {
      const name = w.slice(1)
      projectId = name === '0' ? null : (findProject(name) ?? addProject(name, projects))
    }
    else break
    words.pop()
  }
  return { text: words.join(' '), priority, projectId, agent }
}

function addProject(name: string, projects: Project[]): number {
  const id = Math.max(0, ...projects.map((p) => p.id)) + 1
  projects.push({ id, name })
  return id
}

// The task capture's route: a leading ##t / ##d / ##b picks the section, a
// plain line lands in Today, a bare token adds nothing.
export function parseTaskCapture(raw: string, projects: Project[]): { section: Section; tags: Tags } {
  let section: Section = 'today'
  let text = raw.trim()
  const route = text.match(/^##([tdb])(\s+|$)/)
  if (route) {
    section = route[1] === 't' ? 'today' : route[1] === 'd' ? 'daily' : 'backlog'
    text = text.slice(route[0].length)
  }
  return { section, tags: parseTags(text, projects) }
}

// The typed capture's route: ##j / ##q split journal lines and quotes away
// from note creation. Leading position only; a bare token is a no-op.
export function parseEntryCapture(raw: string): { kind: 'journal' | 'quote' | null; text: string } {
  const text = raw.trim()
  const route = text.match(/^##([jq])(\s+|$)/)
  if (route) return { kind: route[1] === 'j' ? 'journal' : 'quote', text: text.slice(route[0].length) }
  return { kind: null, text }
}

// A note body's pending footer: tokens typed on their own final line after a
// blank line are input syntax, caught on blur — stripped from the body and
// applied to the columns. No token in the footer leaves the values alone;
// !0 / #0 clear.
export function splitNoteFooter(
  body: string,
  projects: Project[],
  current: { priority: Priority; projectId: number | null },
): { body: string; priority: Priority; projectId: number | null } | null {
  const lines = body.split('\n')
  const last = lines[lines.length - 1].trim()
  if (!last || lines.length < 2 || lines[lines.length - 2].trim() !== '') return null
  const words = last.split(/\s+/)
  if (!words.every((w) => /^(![0-3]|#[\w-]+)$/.test(w))) return null
  let { priority, projectId } = current
  for (const w of words) {
    if (/^![0-3]$/.test(w)) priority = w === '!0' ? null : (Number(w[1]) as 1 | 2 | 3)
    else {
      const name = w.slice(1)
      projectId = name === '0' ? null : (resolveProject(name, projects) ?? addProject(name, projects))
    }
  }
  return { body: lines.slice(0, -1).join('\n').trimEnd(), priority, projectId }
}

// #tag resolution: case-insensitive exact, then unique prefix, else null
// (the caller decides whether to create).
function resolveProject(name: string, projects: Project[]): number | null {
  const n = name.toLowerCase()
  const exact = projects.find((p) => p.name.toLowerCase() === n)
  if (exact) return exact.id
  const pre = projects.filter((p) => p.name.toLowerCase().startsWith(n))
  return pre.length === 1 ? pre[0].id : null
}

// The one token matcher — colors exactly what the parsers strip.
const TOKEN_RE = /##[jdqtb](?=\s|$)|![0-3](?=\s|$)|#[\w-]+|@(?=\s|$)/g

export function tokenSpans(text: string): Array<[number, number]> {
  const spans: Array<[number, number]> = []
  TOKEN_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = TOKEN_RE.exec(text))) spans.push([m.index, m.index + m[0].length])
  return spans
}

/* ---- derived facts --------------------------------------------------------- */

export function projectColor(id: number): string {
  return `hsl(${(id * 83) % 360} 55% 68%)`
}

export const clipProject = (name: string) => (name.length > 6 ? `${name.slice(0, 6)}…` : name)

export function openSession(sessions: SessionRow[]): SessionRow | null {
  return sessions.find((s) => s.endedAt === null) ?? null
}

export function totalSecs(sessions: SessionRow[], itemId: number): number {
  return sessions
    .filter((s) => s.itemId === itemId)
    .reduce((acc, s) => acc + (s.endedAt === null ? 0 : (s.secs ?? 0)), 0)
}

export const tierRank = (p: Priority) => (p == null ? 4 : p)

/* ---- hiding (the duration popover) ---------------------------------------- */

export type HideDuration = 'forever' | 'day' | 'week' | 'month'

// The date a duration hides until — forever is null, the sweep's signal.
export function hideUntil(d: HideDuration): string | null {
  if (d === 'forever') return null
  return dayISO(d === 'day' ? -1 : d === 'week' ? -7 : -30)
}

/* ---- the tick store -------------------------------------------------------- */
/* The live timer re-renders two tiny leaves (the row's elapsed, the header
   chip) once a second — never the demo tree. The driver runs only while a
   session is open AND the demo is on screen and engaged. */

let tickNow = Date.now()
const tickSubs = new Set<() => void>()
let tickIv: ReturnType<typeof setInterval> | null = null

function tickBump() {
  tickNow = Date.now()
  tickSubs.forEach((f) => f())
}

export function subscribeTick(f: () => void): () => void {
  tickSubs.add(f)
  if (!tickIv) tickIv = setInterval(tickBump, 1000)
  return () => {
    tickSubs.delete(f)
    if (tickSubs.size === 0 && tickIv) { clearInterval(tickIv); tickIv = null }
  }
}

export function getTickNow(): number {
  return tickNow
}

/* ---- the seed ---------------------------------------------------------------- */

// Deterministic PRNG — every visitor sees the same week.
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DONE_POOL = [
  ['Fix flaky integration test', 'meridian', 2],
  ['Write the changelog', 'meridian', null],
  ['Reply to support emails', null, null],
  ['Update landing page copy', 'growth', 3],
  ['Refactor the sync module', 'meridian', null],
  ['Plan the week', null, null],
  ['Send the invoices', null, null],
  ['Ship the blog post', 'growth', 2],
  ['Triage the feedback inbox', null, 3],
  ['Prep the investor deck', 'growth', 1],
] as const

export function makeSeed(): Seed {
  const projects: Project[] = [
    { id: 1, name: 'meridian' },
    { id: 2, name: 'growth' },
    { id: 3, name: 'health' },
  ]

  const items: Item[] = [
    { id: 1, text: 'Review PR #214 — search ranking tweak', section: 'today', status: 'active', doneDay: null, priority: 2, projectId: 1, agent: false, details: '', hidden: false, hiddenUntil: null, createdDay: dayISO(2), remindAt: null },
    { id: 2, text: 'Fix crash on first-launch onboarding', section: 'today', status: 'done', doneDay: todayISO(), priority: 1, projectId: 1, agent: false, details: '', hidden: false, hiddenUntil: null, createdDay: dayISO(1), remindAt: null },
    { id: 3, text: 'Draft the monthly investor update', section: 'today', status: 'active', doneDay: null, priority: null, projectId: 2, agent: false, details: '', hidden: false, hiddenUntil: null, createdDay: todayISO(), remindAt: null },
    { id: 4, text: 'Compile user interview insights', section: 'today', status: 'active', doneDay: null, priority: null, projectId: 2, agent: true, details: 'Read the six interview transcripts in the Research doc. Pull out: (1) recurring onboarding pain points, (2) why users churn before the first aha moment, (3) feature requests mentioned by three or more people. Write the summary as a note titled "Interview synthesis".', hidden: false, hiddenUntil: null, createdDay: dayISO(2), remindAt: null },
    { id: 5, text: 'Gym — push day', section: 'today', status: 'active', doneDay: null, priority: null, projectId: 3, agent: false, details: '', hidden: false, hiddenUntil: null, createdDay: dayISO(4), remindAt: null },
    { id: 6, text: 'Morning deep work block', section: 'daily', status: 'active', doneDay: null, priority: null, projectId: null, agent: false, details: '', hidden: false, hiddenUntil: null, createdDay: dayISO(20), remindAt: null },
    { id: 7, text: 'Read 20 pages', section: 'daily', status: 'active', doneDay: null, priority: null, projectId: null, agent: false, details: '', hidden: false, hiddenUntil: null, createdDay: dayISO(18), remindAt: null },
    { id: 8, text: 'Walk 8k steps', section: 'daily', status: 'active', doneDay: todayISO(), priority: null, projectId: 3, agent: false, details: '', hidden: false, hiddenUntil: null, createdDay: dayISO(12), remindAt: null },
    { id: 9, text: 'Renew meridian SSL certificate', section: 'backlog', status: 'active', doneDay: null, priority: 1, projectId: 1, agent: false, details: '', hidden: false, hiddenUntil: null, createdDay: dayISO(12), remindAt: dayISO(-3) },
    { id: 10, text: 'Rewrite the onboarding flow', section: 'backlog', status: 'active', doneDay: null, priority: 2, projectId: 2, agent: false, details: '', hidden: false, hiddenUntil: null, createdDay: dayISO(9), remindAt: null },
    { id: 11, text: 'Sketch the mobile widget', section: 'backlog', status: 'active', doneDay: null, priority: 3, projectId: 1, agent: true, details: 'Three widgets: today list, running timer, quick capture. Sketch on paper first.', hidden: false, hiddenUntil: null, createdDay: dayISO(6), remindAt: null },
    { id: 12, text: 'Deep-clean the apartment', section: 'backlog', status: 'active', doneDay: null, priority: null, projectId: null, agent: false, details: '', hidden: false, hiddenUntil: null, createdDay: dayISO(15), remindAt: null },
    { id: 13, text: 'Retire the old landing A/B test', section: 'backlog', status: 'active', doneDay: null, priority: null, projectId: 2, agent: false, details: '', hidden: true, hiddenUntil: null, createdDay: dayISO(11), remindAt: null },
  ]

  const notes: Note[] = [
    { id: 1, body: 'Launch checklist\nscreenshots · install link · first post draft', priority: 1, projectId: null, hidden: false, hiddenUntil: null, collapsed: false },
    { id: 2, body: 'Interview synthesis draft\nthe churn story is the onboarding story', priority: 2, projectId: 2, hidden: false, hiddenUntil: null, collapsed: false },
    { id: 3, body: 'Idea: a quote screensaver for the idle minutes', priority: null, projectId: 2, hidden: false, hiddenUntil: null, collapsed: false },
    { id: 4, body: 'Deep Work — lines to reread\n"clarity about what matters provides clarity about what does not"', priority: null, projectId: null, hidden: false, hiddenUntil: null, collapsed: false },
    { id: 5, body: 'Domain shortlist from March\nall of these are taken now', priority: null, projectId: null, hidden: true, hiddenUntil: null, collapsed: false },
  ]

  const rnd = mulberry32(0xdada)
  const actions: ActionRow[] = []
  const sessions: SessionRow[] = []
  let aid = 0
  let sid = 0

  const log = (verb: ActionVerb, text: string, itemId: number | null, k: number, hh: number, mm: number, project: string | null = null, priority: Priority = null) => {
    actions.push({ id: ++aid, itemId, text, verb, project, priority, day: dayISO(k), ts: at(k, hh, mm) })
  }

  // Backlog rows were created on the days the seed says they were.
  log('created', 'Renew meridian SSL certificate', 9, 12, 10, 20, 'meridian', 1)
  log('created', 'Deep-clean the apartment', 12, 15, 20, 5)
  log('created', 'Rewrite the onboarding flow', 10, 9, 11, 40, 'growth', 2)
  log('created', 'Sketch the mobile widget', 11, 6, 15, 10, 'meridian', 3)
  log('created', 'Retire the old landing A/B test', 13, 11, 9, 30, 'growth')

  // Two weeks of the persona's history: dailies with honest gaps, one or two
  // one-off completions a day, deep-work time, an occasional fall to Backlog.
  // "Read 20 pages" was paused for four days — the pause folds into the
  // analytics replay, so those days are never counted as missed.
  log('paused', 'Read 20 pages', 7, 10, 7, 5)
  for (let k = 13; k >= 1; k--) {
    if (k === 6) log('unpaused', 'Read 20 pages', 7, k, 7, 30)
    const readPaused = k >= 6 && k <= 10
    if (!readPaused && rnd() < 0.82) log('completed', 'Read 20 pages', 7, k, 21, 20 + Math.floor(rnd() * 25))
    if (rnd() < 0.7) {
      log('completed', 'Morning deep work block', 6, k, 7, 15 + Math.floor(rnd() * 10))
      const mins = 50 + Math.floor(rnd() * 45)
      sessions.push({ id: ++sid, itemId: 6, itemText: 'Morning deep work block', startedAt: at(k, 7, 20), endedAt: at(k, 7, 20) + mins * 60e3, secs: mins * 60 })
    }
    if (k <= 12 && rnd() < 0.75) log('completed', 'Walk 8k steps', 8, k, 7, 12)
    const n = rnd() < 0.5 ? 2 : 1
    for (let i = 0; i < n; i++) {
      const [text, proj, prio] = DONE_POOL[Math.floor(rnd() * DONE_POOL.length)]
      const hh = 9 + Math.floor(rnd() * 9)
      log('completed', text, null, k, hh, Math.floor(rnd() * 60), proj, prio as Priority)
      if (rnd() < 0.4) {
        const mins = 20 + Math.floor(rnd() * 70)
        sessions.push({ id: ++sid, itemId: -1, itemText: text, startedAt: at(k, hh - 1, 30), endedAt: at(k, hh - 1, 30) + mins * 60e3, secs: mins * 60 })
      }
    }
    if (rnd() < 0.3) log('fell to backlog', DONE_POOL[Math.floor(rnd() * DONE_POOL.length)][0], null, k, 22, 30)
  }

  // Time already tracked on the live rows.
  sessions.push({ id: ++sid, itemId: 1, itemText: 'Review PR #214 — search ranking tweak', startedAt: at(1, 9, 0), endedAt: at(1, 9, 45), secs: 2700 })
  sessions.push({ id: ++sid, itemId: 1, itemText: 'Review PR #214 — search ranking tweak', startedAt: at(0, 9, 14), endedAt: at(0, 9, 41), secs: 1620 })
  sessions.push({ id: ++sid, itemId: 9, itemText: 'Renew meridian SSL certificate', startedAt: at(8, 11, 0), endedAt: at(8, 11, 15), secs: 900 })

  // Today, so far.
  log('completed', 'Walk 8k steps', 8, 0, 7, 12, 'health')
  log('created', 'Draft the monthly investor update', 3, 0, 8, 15, 'growth')
  log('completed', 'Fix crash on first-launch onboarding', 2, 0, 9, 41, 'meridian', 1)

  actions.sort((a, b) => a.ts - b.ts)
  actions.forEach((a, i) => { a.id = i + 1 })

  const e = (kind: 'journal' | 'quote', text: string, k: number, hh: number, mm: number, n: number): EntryRow =>
    ({ id: 0, kind, text, day: dayISO(k), ts: at(k, hh, mm) + n })

  const entries: EntryRow[] = [
    e('journal', 'Momentum is back — the crash fix shipped before lunch.', 0, 9, 52, 0),
    e('quote', 'Simplicity is the ultimate sophistication.', 0, 8, 2, 0),
    e('journal', 'Search ranking tweak on staging. Waiting feels worse than building.', 1, 18, 30, 0),
    e('quote', 'What gets measured gets managed.', 2, 21, 10, 0),
    e('journal', 'Six interviews read. The pattern is obvious in hindsight: nobody reads onboarding.', 3, 22, 5, 0),
    e('quote', 'The way to get started is to quit talking and begin doing.', 4, 7, 45, 0),
    e('journal', 'Slept badly, still showed up. The walk helps.', 5, 20, 40, 0),
    e('quote', 'Make it work, make it right, make it fast.', 7, 12, 15, 0),
    e('journal', 'Decided the widget ships after the waitlist, not before.', 8, 19, 20, 0),
    e('quote', 'Amateurs wait for inspiration. The rest of us just get up and go to work.', 9, 8, 50, 0),
    e('journal', 'Paused the reading habit while the launch eats the evenings. Not a failure — a choice.', 10, 23, 0, 0),
  ]
  entries.forEach((en, i) => { en.id = i + 1 })

  return { items, notes, projects, actions, sessions, entries }
}
