/* The demo's data model — the app's shape, small enough to hold in React
   state: items (state + a self-writing action log), notes and entries
   (content, never logged), sessions (measurement). The seed is the app's own
   demo seed, ported row for row: one row per surface, plain everyday texts.
   Every seed timestamp is computed relative to now onto the app's 6am→6am
   logical day, so the done-today daily, its streak, and the pending reminder
   demo correctly no matter when a visitor lands. */

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

export type Horizon = 'timeless' | 'long' | 'short'

export interface GoalRow {
  id: number
  text: string
  horizon: Horizon
  status: 'active' | 'achieved'
  projectId: number | null
  hidden: boolean
  hiddenUntil: string | null
  achievedDay: string | null
  createdDay: string
}

export interface Project {
  id: number
  name: string
}

export type ActionVerb =
  | 'created' | 'completed' | 'uncompleted' | 'moved' | 'edited' | 'deleted'
  | 'fell to backlog' | 'paused' | 'unpaused'
  | 'goal_created' | 'goal_achieved' | 'goal_unachieved' | 'goal_edited' | 'goal_deleted'

export interface ActionRow {
  id: number
  itemId: number | null
  goalId: number | null
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
  goals: GoalRow[]
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

// Month-granular, the achieved stamp: "Aug 2026".
export function fmtMonth(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  return `${MO[m - 1]} ${y}`
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

// Which surface a token line is on — the matcher colors exactly what that
// surface parses: the task capture routes ##t/##d/##b (##j/##q are prose
// there), the notes capture routes ##j/##q (no @ — notes have no delegation
// axis), the goal surfaces color $N/#tag only, edits parse only the trailing
// !N/#tag/@ tokens.
export type TokenSurface = 'task-capture' | 'task-edit' | 'note-capture' | 'goal-capture' | 'goal-edit'

// The Settings switches ride through here: a switched-off axis's token is
// literal prose — not colored, not stripped — on every surface at once.
export interface TagFlags {
  projects?: boolean
  priorities?: boolean
  agent?: boolean
  journal?: boolean
  quotes?: boolean
  timeframes?: boolean
}

// The alternation a surface colors/strips, narrowed by the flags. null =
// nothing parses on this surface right now.
function tokenRe(surface: TokenSurface, f?: TagFlags): RegExp | null {
  const parts: string[] = []
  if (surface === 'note-capture') {
    if (f?.journal !== false) parts.push('##j(?=\\s|$)')
    if (f?.quotes !== false) parts.push('##q(?=\\s|$)')
  } else if (surface === 'goal-capture' || surface === 'goal-edit') {
    // $N needs the space/end guard only — "$100k" fails the lookahead after
    // the digit, so money stays literal prose
    if (f?.timeframes !== false) parts.push('\\$[123](?=\\s|$)')
  } else {
    parts.push('##[tbd](?=\\s|$)')
  }
  if (f?.priorities !== false && surface !== 'goal-capture' && surface !== 'goal-edit') parts.push('![0-3](?=\\s|$)')
  if (f?.projects !== false) parts.push('#[\\w-]+')
  if (surface !== 'note-capture' && surface !== 'goal-capture' && surface !== 'goal-edit' && f?.agent !== false) parts.push('@0?(?=\\s|$)')
  return parts.length > 0 ? new RegExp(parts.join('|'), 'g') : null
}

export function tokenSpans(text: string, surface: TokenSurface, flags?: TagFlags): Array<[number, number]> {
  const re = tokenRe(surface, flags)
  const spans: Array<[number, number]> = []
  if (!re) return spans
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) spans.push([m.index, m.index + m[0].length])
  return spans
}

export interface Tags {
  text: string
  priority: Priority
  projectId: number | null
  agent: boolean
}

// Trailing !N / #tag / bare @ — composable, any order, last wins. With no
// `current` (a capture) absent tokens leave the values unset; with `current`
// (an edit) absent tokens leave the current values alone. @0 / !0 / #0 clear.
// `flags` narrows the grammar to the axes that exist (Settings): a
// switched-off axis's token is literal text the loop stops at.
// Project tokens resolve against `projects` (exact, then unique prefix) and
// create unknown ones.
export function parseTags(
  raw: string,
  projects: Project[],
  current?: { priority: Priority; projectId: number | null; agent: boolean },
  flags?: TagFlags,
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
  const kindOf = (w: string): 'agent' | 'unagent' | 'prio' | 'proj' | null => {
    if (flags?.agent !== false) {
      if (w === '@') return 'agent'
      if (w === '@0') return 'unagent'
    }
    if (flags?.priorities !== false && /^![0-3]$/.test(w)) return 'prio'
    if (flags?.projects !== false && /^#[\w-]+$/.test(w)) return 'proj'
    return null
  }
  while (words.length > 1 || (words.length === 1 && kindOf(words[0]))) {
    const w = words[words.length - 1]
    const kind = kindOf(w)
    if (!kind) break
    if (kind === 'agent') agent = true
    else if (kind === 'unagent') agent = false
    else if (kind === 'prio') priority = w === '!0' ? null : (Number(w[1]) as 1 | 2 | 3)
    else {
      const name = w.slice(1)
      projectId = name === '0' ? null : (findProject(name) ?? addProject(name, projects))
    }
    words.pop()
  }
  return { text: words.join(' '), priority, projectId, agent }
}

function addProject(name: string, projects: Project[]): number {
  const id = Math.max(0, ...projects.map((p) => p.id)) + 1
  projects.push({ id, name })
  return id
}

export interface GoalTags {
  text: string
  horizon: Horizon | null // null = no token on the line (an edit keeps its tier)
  projectId: number | null
}

// The goals' token grammar: $1 short · $2 long · $3 timeless (last wins) +
// the #tag project link. Tokens strip from anywhere in the line — unlike
// items' trailing-only rule — and "$100k" never parses (the digit must end
// the word). No token leaves the horizon alone; #0 clears the project.
// `flags` narrows to the axes that exist; the resolver creates unknown tags,
// so the caller mutates its projects copy like every other parse.
export function parseGoalTags(
  raw: string,
  projects: Project[],
  flags?: TagFlags,
): GoalTags {
  const words = raw.trim().split(/\s+/)
  let horizon: Horizon | null = null
  let projectId: number | null = null
  const kept: string[] = []
  for (const w of words) {
    if (flags?.timeframes !== false && /^\$[123]$/.test(w)) {
      horizon = w === '$1' ? 'short' : w === '$2' ? 'long' : 'timeless'
    } else if (flags?.projects !== false && /^#[\w-]+$/.test(w)) {
      const name = w.slice(1)
      if (name === '0') projectId = null
      else {
        const n = name.toLowerCase()
        const exact = projects.find((p) => p.name.toLowerCase() === n)
        const pre = projects.filter((p) => p.name.toLowerCase().startsWith(n))
        projectId = exact ? exact.id : pre.length === 1 ? pre[0].id : addProject(name, projects)
      }
    } else kept.push(w)
  }
  return { text: kept.join(' '), horizon, projectId }
}

// The task capture's route: a leading ##t / ##d / ##b picks the section, a
// plain line lands in Today, a bare token adds nothing.
export function parseTaskCapture(raw: string, projects: Project[], flags?: TagFlags): { section: Section; tags: Tags } {
  let section: Section = 'today'
  let text = raw.trim()
  const route = text.match(/^##([tdb])(\s+|$)/)
  if (route) {
    section = route[1] === 't' ? 'today' : route[1] === 'd' ? 'daily' : 'backlog'
    text = text.slice(route[0].length)
  }
  return { section, tags: parseTags(text, projects, undefined, flags) }
}

// The typed capture's route: ##j / ##q split journal lines and quotes away
// from note creation. Leading position only; a bare token is a no-op. A
// switched-off route is literal prose — the whole line stays the note.
export function parseEntryCapture(raw: string, enabled?: { journal?: boolean; quotes?: boolean }): { kind: 'journal' | 'quote' | null; text: string } {
  const text = raw.trim()
  const route = text.match(/^##([jq])(\s+|$)/)
  if (route) {
    const kind = route[1] === 'j' ? 'journal' : 'quote'
    const on = route[1] === 'j' ? enabled?.journal : enabled?.quotes
    if (on !== false) return { kind, text: text.slice(route[0].length) }
  }
  return { kind: null, text }
}

// A note body's pending footer: tokens typed on their own final line after a
// blank line are input syntax, caught on blur — stripped from the body and
// applied to the columns. No token in the footer leaves the values alone;
// !0 / #0 clear. `flags` narrows the grammar to the axes that exist.
export function splitNoteFooter(
  body: string,
  projects: Project[],
  current: { priority: Priority; projectId: number | null },
  flags?: TagFlags,
): { body: string; priority: Priority; projectId: number | null } | null {
  const isTok = (w: string) =>
    (flags?.priorities !== false && /^![0-3]$/.test(w)) ||
    (flags?.projects !== false && /^#[\w-]+$/.test(w))
  const lines = body.split('\n')
  const last = lines[lines.length - 1].trim()
  if (!last || lines.length < 2 || lines[lines.length - 2].trim() !== '') return null
  const words = last.split(/\s+/)
  if (!words.every(isTok)) return null
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
/* ---- derived facts --------------------------------------------------------- */

// Single-color projects — the app's default since 2026-10-27: every label
// and dot reads in the metadata grey; Settings → Look → Project colors →
// Multi brings back the per-id hue. The demo shell flips the flag exactly
// like the app's shell does.
let singleColorProjects = true
export function setProjectColorMode(single: boolean): void {
  singleColorProjects = single
}
export function projectColor(id: number): string {
  if (singleColorProjects) return 'var(--text-dim)'
  return `hsl(${(id * 83) % 360} 55% var(--project-l, 68%))`
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

export function makeSeed(): Seed {
  // The app's demo seed (src-tauri/demo.sql), ported: deliberately small —
  // the first minute is the product. One row per surface and plain everyday
  // texts: a daily habit done for today, a backlog row shelved with a
  // reminder, a note. Today is empty on purpose: the capture bar with its
  // rotating hints is the first act. The backlog row still carries its axes —
  // priority, pending reminder, project link — dormant while their Settings
  // switches are off (the factory defaults), and in action the moment one is
  // flipped on. What was cut is count, not capability.
  const projects: Project[] = [
    { id: 1, name: 'Home' },
  ]

  const items: Item[] = [
    { id: 1, text: 'Water the plants', section: 'daily', status: 'active', doneDay: todayISO(), priority: null, projectId: null, agent: false, details: '', hidden: false, hiddenUntil: null, createdDay: dayISO(4), remindAt: null },
    { id: 2, text: 'Book dentist appointment', section: 'backlog', status: 'active', doneDay: null, priority: 2, projectId: 1, agent: false, details: '', hidden: false, hiddenUntil: null, createdDay: dayISO(2), remindAt: dayISO(-3) },
  ]

  const notes: Note[] = [
    { id: 1, body: 'Groceries\n- oats\n- bananas\n- coffee', priority: null, projectId: null, hidden: false, hiddenUntil: null, collapsed: false },
  ]

  // The daily's short life, in strict chronological order (id order = the
  // journal's display order): created four days ago, done every day since —
  // the streak and the analytics day-ledger read true.
  const actions: ActionRow[] = [
    { id: 1, itemId: 1, goalId: null, text: 'Water the plants', verb: 'created', project: null, priority: null, day: dayISO(4), ts: at(4, 7, 0) },
    { id: 2, itemId: 1, goalId: null, text: 'Water the plants', verb: 'completed', project: null, priority: null, day: dayISO(3), ts: at(3, 9, 12) },
    { id: 3, itemId: 1, goalId: null, text: 'Water the plants', verb: 'completed', project: null, priority: null, day: dayISO(2), ts: at(2, 8, 40) },
    { id: 4, itemId: 2, goalId: null, text: 'Book dentist appointment', verb: 'created', project: 'Home', priority: 2, day: dayISO(2), ts: at(2, 11, 0) },
    { id: 5, itemId: 1, goalId: null, text: 'Water the plants', verb: 'completed', project: null, priority: null, day: dayISO(1), ts: at(1, 9, 20) },
    { id: 6, itemId: 1, goalId: null, text: 'Water the plants', verb: 'completed', project: null, priority: null, day: todayISO(), ts: at(0, 7, 30) },
  ]

  // No seeded goals — the factory set ships Goals off, and the app's demo
  // seed plants none: flipping the switch on reveals the empty capture-first
  // surface, exactly like the app.
  return { items, notes, goals: [], projects, actions, sessions: [], entries: [] }
}
