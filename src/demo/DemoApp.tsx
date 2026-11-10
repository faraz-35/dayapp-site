/* The demo's root: all state (items, notes, actions, sessions, entries),
   every mutation (each logging itself the way the app's transactions do),
   the keyboard grammar, engagement, the window chrome, and the four views.
   Keyboard only listens while the demo is engaged — pointer over it, focus
   inside it, an overlay open, or fullscreen — so the page around it never
   loses a keystroke. */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fmtClock, hideUntil, makeSeed, openSession, parseEntryCapture, parseGoalTags, parseTags,
  parseTaskCapture, setProjectColorMode, splitNoteFooter, tierRank, todayISO, totalSecs as sumSecs,
  type ActionRow, type ActionVerb, type EntryRow, type GoalRow, type HideDuration, type Item,
  type Note, type Priority, type Project, type Seed, type Section,
} from './model'
import { MoonIcon, SunIcon, THEMES, applyTheme, systemThemeId, themeById, themeIsLight, themeModeSlot } from '../themes'
import DemoList, { type CaptureHandle, type Pop, type Sel } from './DemoList'
import DemoGoals, { type GoalAct } from './DemoGoals'
import DemoAnalytics from './DemoAnalytics'
import DemoEntries from './DemoEntries'
import DemoSettings, { type Features, type FeatureKey, type HeaderBtn, type HeaderBtns } from './DemoSettings'
import { DemoPalette, DemoSearch, type PaletteEntry } from './DemoOverlays'

type View = 'list' | 'analytics' | 'journal' | 'quotes' | 'settings'

const VIEW_TITLES: Record<View, string> = {
  list: 'Live @ Demo', analytics: 'Analytics', journal: 'Journal', quotes: 'Quotes', settings: 'Settings',
}

const ADDRESS_KEYS = new Set(['n', 't', 'd', 'b', 'g'])

export default function DemoApp() {
  // The window's theme is its own — session-only like every demo setting,
  // defaulted to the system's answer at mount. It never touches the page's
  // theme (the nav toggle's business).
  const [demoThemeId, setDemoThemeId] = useState(systemThemeId)
  const demoTheme = themeById(demoThemeId)
  const themeSlot = themeModeSlot(demoTheme, THEMES)
  // The window's theme button walks the whole ladder — the app's header
  // behavior; the Settings page stays the direct door.
  const cycleTheme = () => {
    const i = THEMES.findIndex((t) => t.id === demoTheme.id)
    setDemoThemeId(THEMES[(i + 1) % THEMES.length].id)
  }
  // the palette button's glyph mirrors the platform's real modifier — ⌘ on
  // macOS, the prompt field elsewhere (Ctrl has no pictograph)
  const isMac = /Mac|iP(hone|ad|od)/.test(navigator.platform || navigator.userAgent)
  const [seed0] = useState<Seed>(makeSeed)
  const [items, setItems] = useState(seed0.items)
  const [notes, setNotes] = useState(seed0.notes)
  const [goals, setGoals] = useState(seed0.goals)
  const [projects, setProjects] = useState(seed0.projects)
  const [actions, setActions] = useState(seed0.actions)
  const [sessions, setSessions] = useState(seed0.sessions)
  const [entries, setEntries] = useState(seed0.entries)
  const idRef = useRef(1000)
  const nextId = () => ++idRef.current

  const [view, setView] = useState<View>('list')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const [sel, setSel] = useState<Sel>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [detailsId, setDetailsId] = useState<number | null>(null)
  const [pop, setPop] = useState<Pop>(null)

  const [hiddenPriorities, setHiddenPriorities] = useState<number[]>([])
  const [showHiddenTasks, setShowHiddenTasks] = useState(false)
  const [showHiddenNotes, setShowHiddenNotes] = useState(false)
  const [showPausedGoals, setShowPausedGoals] = useState(false)
  const [agentFilter, setAgentFilter] = useState<null | 'agent' | 'my'>(null)
  const [projectFilter, setProjectFilter] = useState<number | null>(null)

  // the layout toggles (⌘P) + Focus Mode, the app's lens: P1 notes only,
  // Today/Daily and P1 Backlog only — it composes, never mutates
  const [showNotes, setShowNotes] = useState(true)
  const [showGoals, setShowGoals] = useState(true)
  const [showToday, setShowToday] = useState(true)
  const [showDaily, setShowDaily] = useState(true)
  const [showBacklog, setShowBacklog] = useState(true)
  const [focusMode, setFocusMode] = useState(false)

  // the header's ◐ flips every archive axis that exists, together — the
  // app's one-button reveal
  const anyReveal = showHiddenTasks || showHiddenNotes || showPausedGoals
  const toggleHidden = () => {
    const next = !anyReveal
    setShowHiddenTasks(next && features.taskHide)
    setShowHiddenNotes(next && features.noteHide)
    setShowPausedGoals(next && features.goals && features.goalPause)
  }

  // the settings page (⌘P → Open Settings, or the gear): existence (Features),
  // the resting fills (Appearance), the window's icon buttons (Header), the
  // Focus lens (Views). Existence is configuration — Show Default View and
  // Reset the Demo never touch it. The defaults are the app's factory set
  // (2026-10-24): the plain working app — tasks + notes with note download —
  // and every power axis one switch away.
  const [features, setFeatures] = useState<Features>({
    tasks: true, today: true, daily: true, backlog: true,
    timer: false, reminders: false, taskProjects: false, taskHide: false, dailyPause: false,
    taskDetails: false, taskPriorities: false, agent: false,
    notes: true, noteProjects: false, notePriorities: false, noteHide: false, noteDownload: true,
    goals: false, goalTimeframes: false, goalProjects: false, goalPause: false,
    journal: false, quotes: false,
  })
  const [notesCard, setNotesCard] = useState(false)
  const [tasksCard, setTasksCard] = useState(false)
  // Settings → Look: how the two grouped surfaces show priority tiers
  // (dividers by default) and whether projects carry their own hue (the
  // app's default is single — one grey). projectColor reads the module flag
  // model keeps, so every label/dot follows the one write.
  const [backlogBars, setBacklogBars] = useState(true)
  const [noteBars, setNoteBars] = useState(false)
  const [projectColorsSingle, setProjectColorsSingle] = useState(() => {
    setProjectColorMode(true)
    return true
  })
  const [headerBtns, setHeaderBtns] = useState<HeaderBtns>({
    // The demo's showcase header: the app's minimal set (Analytics /
    // Settings / Theme) plus the palette door — a first-minute visitor
    // sees ⌘P has a mouse home. The app's own factory default keeps the
    // palette off; this is the demo's deliberate divergence.
    palette: true, hidden: false, journal: false, quotes: false, analytics: true, settings: true, theme: true,
  })

  const [now, setNow] = useState(0)
  const [tabVisible, setTabVisible] = useState(true)
  const [isFull, setIsFull] = useState(false)
  const [engaged, setEngaged] = useState(false)
  const pointerIn = useRef(false)
  const focusIn = useRef(false)
  const addrRef = useRef('')
  const rootRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const taskCapRef = useRef<CaptureHandle | null>(null)
  const noteCapRef = useRef<CaptureHandle | null>(null)
  const goalCapRef = useRef<CaptureHandle | null>(null)

  const activeSession = openSession(sessions)

  /* ---- the window wears its own theme: the ladder is scoped to the demo
          root, so the page around it keeps the nav toggle's theme ---- */
  useEffect(() => {
    if (rootRef.current) applyTheme(demoTheme, rootRef.current)
  }, [demoTheme])

  /* ---- visibility pipelines (the ⌘P toggles + ⌘F filters compose here) ---- */

  const pass = (i: Item) =>
    (i.hidden ? showHiddenTasks : true) &&
    (i.priority == null || !hiddenPriorities.includes(i.priority)) &&
    (agentFilter == null || (agentFilter === 'agent' ? i.agent : !i.agent)) &&
    (projectFilter == null || i.projectId === projectFilter)

  const { today, daily, backlog, allTasks } = useMemo(() => {
    const t = features.tasks && features.today ? items.filter((i) => i.section === 'today' && pass(i)) : []
    const d = features.tasks && features.daily ? items.filter((i) => i.section === 'daily' && pass(i)) : []
    const bRaw = features.tasks && features.backlog
      ? items.filter((i) => i.section === 'backlog' && pass(i) && (!focusMode || i.priority === 1))
      : []
    // tier-sorted only while the priority axis exists — off, the Backlog is
    // one flat list
    const b = features.taskPriorities
      ? [...bRaw].sort((a, c) => tierRank(a.priority) - tierRank(c.priority) || a.id - c.id)
      : bRaw
    return { today: t, daily: d, backlog: b, allTasks: [...t, ...d, ...b] }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, hiddenPriorities, showHiddenTasks, agentFilter, projectFilter, focusMode, features])

  const notesVisible = useMemo(() => features.notes ? notes.filter((n) =>
    (n.hidden ? showHiddenNotes : true) &&
    (projectFilter == null || n.projectId === projectFilter) &&
    (!focusMode || n.priority === 1),
  ) : [], [notes, showHiddenNotes, projectFilter, focusMode, features])

  // the Goals surface reads its own reveal (paused rows) — the project filter
  // narrows it too; the Focus lens hides the layer entirely (the app's lens
  // is stricter than the default working view)
  const goalsVisible = useMemo(() => features.goals ? goals.filter((g) =>
    (g.hidden ? showPausedGoals : true) &&
    (projectFilter == null || g.projectId === projectFilter) &&
    !focusMode,
  ) : [], [goals, showPausedGoals, projectFilter, focusMode, features])

  // the same rows in render order — the g<n> addresses walk the DOM
  const goalAddressList = useMemo(() => {
    const order: Record<GoalRow['horizon'], number> = { timeless: 0, long: 1, short: 2 }
    const active = goalsVisible.filter((g) => g.status === 'active')
      .sort((a, b) => (features.goalTimeframes ? order[a.horizon] - order[b.horizon] : 0) || a.id - b.id)
    const done = goalsVisible.filter((g) => g.status === 'achieved')
    return [...active, ...done]
  }, [goalsVisible, features.goalTimeframes])

  /* ---- the live timer re-renders the demo once a second — only while a
          session is open and the tab is visible ---- */
  useEffect(() => {
    const onVis = () => setTabVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])
  useEffect(() => {
    if (!activeSession || !tabVisible) return
    setNow(Date.now())
    const iv = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(iv)
  }, [activeSession?.id, tabVisible]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- the 6am-boundary sweep, demo edition: expired hide durations lift ---- */
  useEffect(() => {
    const today = todayISO()
    setItems((xs) => xs.map((x) => (x.hidden && x.hiddenUntil != null && x.hiddenUntil < today
      ? { ...x, hidden: false, hiddenUntil: null } : x)))
    setNotes((ns) => ns.map((n) => (n.hidden && n.hiddenUntil != null && n.hiddenUntil < today
      ? { ...n, hidden: false, hiddenUntil: null } : n)))
    setGoals((gs) => gs.map((g) => (g.hidden && g.hiddenUntil != null && g.hiddenUntil < today
      ? { ...g, hidden: false, hiddenUntil: null } : g)))
  }, [])

  /* ---- fullscreen (an overlay, not the Fullscreen API) + engagement ---- */
  /* The browser owns Esc in real fullscreen — it would exit and the demo
     would never see the key. The demo's fullscreen is a fixed overlay
     instead: Esc stays a DayApp key, and leaving is the ⤢ button or the
     palette. */
  useEffect(() => () => { document.body.style.overflow = '' }, [])

  useEffect(() => {
    setEngaged(pointerIn.current || focusIn.current || isFull)
  }, [isFull])

  const toggleFull = () => {
    const next = !isFull
    setIsFull(next)
    document.body.style.overflow = next ? 'hidden' : ''
  }

  /* ---- mutations — every item write appends to `actions` ---- */

  // the axes that exist right now (Settings) — the parsers only strip what
  // these allow, so a switched-off axis's token stays literal text
  const taskFlags = { projects: features.taskProjects, priorities: features.taskPriorities, agent: features.agent }
  const noteFlags = { projects: features.noteProjects, priorities: features.notePriorities }

  const logAction = (verb: ActionVerb, text: string, itemId: number | null, projectId: number | null, priority: Priority, goalId: number | null = null, section: Section | null = null, agent = false) => {
    const projectName = projects.find((p) => p.id === projectId)?.name ?? null
    const row: ActionRow = {
      id: nextId(), itemId, goalId, text, verb, project: projectName, priority, section, agent,
      day: todayISO(), ts: Date.now(),
    }
    setActions((as) => [...as, row])
  }

  const finalize = (sessionId: number, at: number) => {
    setSessions((ss) => ss.map((s) => s.id === sessionId
      ? { ...s, endedAt: at, secs: Math.max(0, Math.round((at - s.startedAt) / 1000)) }
      : s))
  }

  // The single-timer invariant enforced inside the mutation, never at the
  // call sites: starting one session finalizes whatever is open.
  const toggleTimer = (item: Item) => {
    const open = openSession(sessions)
    const at = Date.now()
    if (open && open.itemId === item.id) { finalize(open.id, at); return }
    setSessions((ss) => [
      ...ss.map((s) => s.endedAt === null
        ? { ...s, endedAt: at, secs: Math.max(0, Math.round((at - s.startedAt) / 1000)) }
        : s),
      { id: nextId(), itemId: item.id, itemText: item.text, startedAt: at, endedAt: null, secs: null },
    ])
  }

  const discardTimer = () => {
    const open = openSession(sessions)
    if (open) setSessions((ss) => ss.filter((s) => s.id !== open.id))
  }

  // Completing or deleting a running item stops its timer first — the
  // session is kept, enforced here in the write path.
  const stopFor = (itemId: number) => {
    const open = openSession(sessions)
    if (open && open.itemId === itemId) finalize(open.id, Date.now())
  }

  const act = {
    addTask(raw: string) {
      const proj = [...projects]
      const { section, tags } = parseTaskCapture(raw, proj, taskFlags)
      if (!tags.text) return
      if (proj.length !== projects.length) setProjects(proj)
      const item: Item = {
        id: nextId(), text: tags.text, section, status: 'active', doneDay: null,
        priority: tags.priority, projectId: tags.projectId, agent: tags.agent,
        details: '', hidden: false, hiddenUntil: null, createdDay: todayISO(), remindAt: null,
      }
      setItems((xs) => [...xs, item])
      logAction('created', item.text, item.id, item.projectId, item.priority, null, section, item.agent)
    },
    complete(item: Item) {
      if (item.hidden) return
      stopFor(item.id)
      if (item.section === 'backlog') {
        // done Backlog rows leave the list — the completion lives in the log
        setItems((xs) => xs.filter((x) => x.id !== item.id))
        logAction('completed', item.text, item.id, item.projectId, item.priority, null, item.section, item.agent)
        return
      }
      const done = item.status === 'done' || (item.section === 'daily' && item.doneDay === todayISO())
      setItems((xs) => xs.map((x) => x.id === item.id
        ? (x.section === 'daily'
            ? { ...x, doneDay: done ? null : todayISO() }
            : { ...x, status: done ? 'active' : 'done' as const })
        : x))
      logAction(done ? 'uncompleted' : 'completed', item.text, item.id, item.projectId, item.priority, null, item.section, item.agent)
    },
    del(item: Item) {
      stopFor(item.id)
      logAction('deleted', item.text, item.id, item.projectId, item.priority, null, item.section, item.agent)
      setItems((xs) => xs.filter((x) => x.id !== item.id))
    },
    commitEdit(item: Item, raw: string) {
      const text = raw.trim()
      if (!text || text === item.text) return
      const proj = [...projects]
      // no token on an edit leaves the value alone — current rides in
      const tags = parseTags(text, proj, { priority: item.priority, projectId: item.projectId, agent: item.agent }, taskFlags)
      if (proj.length !== projects.length) setProjects(proj)
      setItems((xs) => xs.map((x) => x.id === item.id
        ? { ...x, text: tags.text, priority: tags.priority, projectId: tags.projectId, agent: tags.agent }
        : x))
      logAction('edited', tags.text, item.id, tags.projectId, tags.priority, null, item.section, item.agent)
    },
    setProject(id: number, projectId: number | null) {
      setItems((xs) => xs.map((x) => (x.id === id ? { ...x, projectId } : x)))
    },
    setItemPriority(id: number, priority: Priority) {
      setItems((xs) => xs.map((x) => (x.id === id ? { ...x, priority } : x)))
    },
    setNotePriority(id: number, priority: Priority) {
      setNotes((ns) => ns.map((n) => (n.id === id ? { ...n, priority } : n)))
    },
    setNoteProject(id: number, projectId: number | null) {
      setNotes((ns) => ns.map((n) => (n.id === id ? { ...n, projectId } : n)))
    },
    createProject(name: string): number {
      const p: Project = { id: nextId(), name }
      setProjects((ps) => [...ps, p])
      return p.id
    },
    toggleTimer,
    promote(item: Item) {
      setItems((xs) => xs.map((x) => x.id === item.id ? { ...x, section: 'today' as const, remindAt: null } : x))
      logAction('moved', item.text, item.id, item.projectId, item.priority, null, 'today', item.agent)
    },
    hideItem(item: Item, duration: HideDuration) {
      setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, hidden: true, hiddenUntil: hideUntil(duration) } : x)))
      logAction('paused', item.text, item.id, item.projectId, item.priority, null, item.section, item.agent)
    },
    unhide(id: number) {
      const item = items.find((x) => x.id === id)
      setItems((xs) => xs.map((x) => (x.id === id ? { ...x, hidden: false, hiddenUntil: null } : x)))
      if (item) logAction('unpaused', item.text, item.id, item.projectId, item.priority, null, item.section, item.agent)
    },
    setDetails(id: number, body: string) {
      setItems((xs) => xs.map((x) => (x.id === id ? { ...x, details: body } : x)))
    },
    addNote(raw: string) {
      // the typed capture bus: a leading ##j / ##q writes an entry, not a
      // note — a switched-off route degrades the line to an ordinary note,
      // token as literal prose
      const entry = parseEntryCapture(raw, { journal: features.journal, quotes: features.quotes })
      if (entry.kind) {
        if (entry.text) addEntry(entry.kind, entry.text)
        return
      }
      const proj = [...projects]
      const tags = parseTags(raw, proj, undefined, noteFlags)
      if (!tags.text) return
      if (proj.length !== projects.length) setProjects(proj)
      const note: Note = {
        id: nextId(), body: tags.text, priority: tags.priority,
        projectId: tags.projectId, hidden: false, hiddenUntil: null, collapsed: false,
      }
      setNotes((ns) => [...ns, note])
    },
    noteBody(id: number, body: string) {
      setNotes((ns) => ns.map((n) => {
        if (n.id !== id) return n
        const proj = [...projects]
        const caught = splitNoteFooter(body, proj, { priority: n.priority, projectId: n.projectId }, noteFlags)
        if (caught) {
          if (proj.length !== projects.length) setProjects(proj)
          return { ...n, body: caught.body, priority: caught.priority, projectId: caught.projectId }
        }
        return { ...n, body }
      }))
    },
    noteCollapse(id: number) {
      setNotes((ns) => ns.map((n) => (n.id === id ? { ...n, collapsed: !n.collapsed } : n)))
    },
    noteDelete(id: number) {
      setNotes((ns) => ns.filter((n) => n.id !== id))
    },
    noteHide(id: number, duration: HideDuration) {
      setNotes((ns) => ns.map((n) => (n.id === id ? { ...n, hidden: true, hiddenUntil: hideUntil(duration) } : n)))
    },
    noteUnhide(id: number) {
      setNotes((ns) => ns.map((n) => (n.id === id ? { ...n, hidden: false, hiddenUntil: null } : n)))
    },
    noteDownload(id: number) {
      const note = notes.find((n) => n.id === id)
      if (!note) return
      const name = (note.body.split('\n').find((l) => l.trim()) ?? 'note').replace(/[^\w\s-]/g, '').trim().slice(0, 60) || 'note'
      const blob = new Blob([note.body], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${name}.txt`
      a.click()
      URL.revokeObjectURL(url)
    },
  }

  function addEntry(kind: 'journal' | 'quote', text: string) {
    const row: EntryRow = { id: nextId(), kind, text, day: todayISO(), ts: Date.now() }
    setEntries((es) => [...es, row])
  }

  /* ---- goals: state + logged activity, like the items ---- */

  const goalAct: GoalAct = {
    addGoal(raw: string) {
      const proj = [...projects]
      const tags = parseGoalTags(raw, proj, { projects: features.goalProjects, timeframes: features.goalTimeframes })
      if (!tags.text) return
      if (proj.length !== projects.length) setProjects(proj)
      const goal: GoalRow = {
        id: nextId(), text: tags.text,
        horizon: tags.horizon ?? 'short',
        status: 'active', projectId: tags.projectId,
        hidden: false, hiddenUntil: null, achievedDay: null, createdDay: todayISO(),
      }
      setGoals((gs) => [...gs, goal])
      logAction('goal_created', goal.text, null, goal.projectId, null, goal.id)
    },
    achieve(goal: GoalRow) {
      const done = goal.status === 'achieved'
      setGoals((gs) => gs.map((g) => (g.id === goal.id
        ? { ...g, status: done ? 'active' as const : 'achieved' as const, achievedDay: done ? null : todayISO() }
        : g)))
      logAction(done ? 'goal_unachieved' : 'goal_achieved', goal.text, null, goal.projectId, null, goal.id)
    },
    del(goal: GoalRow) {
      logAction('goal_deleted', goal.text, null, goal.projectId, null, goal.id)
      setGoals((gs) => gs.filter((g) => g.id !== goal.id))
    },
    commitEdit(goal: GoalRow, raw: string) {
      const text = raw.trim()
      if (!text || text === goal.text) return
      const proj = [...projects]
      const tags = parseGoalTags(text, proj, { projects: features.goalProjects, timeframes: features.goalTimeframes })
      if (proj.length !== projects.length) setProjects(proj)
      // no token on an edit leaves the horizon alone — current rides in
      setGoals((gs) => gs.map((g) => (g.id === goal.id
        ? { ...g, text: tags.text, horizon: tags.horizon ?? g.horizon, projectId: tags.projectId }
        : g)))
      logAction('goal_edited', tags.text, null, tags.projectId, null, goal.id)
    },
    setProject(id: number, projectId: number | null) {
      setGoals((gs) => gs.map((g) => (g.id === id ? { ...g, projectId } : g)))
    },
    pause(id: number, duration: HideDuration) {
      setGoals((gs) => gs.map((g) => (g.id === id ? { ...g, hidden: true, hiddenUntil: hideUntil(duration) } : g)))
      const goal = goals.find((g) => g.id === id)
      if (goal) logAction('paused', goal.text, null, goal.projectId, null, goal.id)
    },
    resume(id: number) {
      const goal = goals.find((g) => g.id === id)
      setGoals((gs) => gs.map((g) => (g.id === id ? { ...g, hidden: false, hiddenUntil: null } : g)))
      if (goal) logAction('unpaused', goal.text, null, goal.projectId, null, goal.id)
    },
    createProject(name: string): number {
      return act.createProject(name)
    },
  }

  // Show Default View resets the working view; Reset the Demo reseeds both.
  const resetView = () => {
    setView('list'); setSel(null); setEditingId(null); setDetailsId(null); setPop(null)
    setHiddenPriorities([]); setShowHiddenTasks(false); setShowHiddenNotes(false); setShowPausedGoals(false)
    setAgentFilter(null); setProjectFilter(null)
    setShowNotes(true); setShowGoals(true); setShowToday(true); setShowDaily(true); setShowBacklog(true)
    setFocusMode(false)
  }

  const reset = () => {
    const s = makeSeed()
    idRef.current = 1000
    setItems(s.items); setNotes(s.notes); setGoals(s.goals); setProjects(s.projects)
    setActions(s.actions); setSessions(s.sessions); setEntries(s.entries)
    resetView()
    setNow(0)
    addrRef.current = ''
  }

  /* ---- the keyboard grammar ---- */

  const selectTask = (id: number) => { setSel({ kind: 'task', id }); setEditingId(null); setDetailsId(null) }

  const move = (delta: number) => {
    const idx = allTasks.findIndex((i) => i.id === sel?.id && sel.kind === 'task')
    const next = idx === -1 ? 0 : Math.min(allTasks.length - 1, Math.max(0, idx + delta))
    const id = allTasks[next]?.id
    if (id != null) selectTask(id)
  }

  const scrollStep = (dir: 1 | -1) => {
    const el = isFull ? bodyRef.current : null
    if (el) el.scrollBy({ top: dir * 120, behavior: 'smooth' })
    else window.scrollBy({ top: dir * 120, behavior: 'smooth' })
  }

  const focusCapture = (h: React.RefObject<CaptureHandle | null>, pre: string | null) => {
    const c = h.current
    if (!c) return
    if (pre) c.preset(pre)
    else c.focus()
  }

  // Addresses are typed directly; n<tier><row> and b<tier><row> are the only
  // two-key-tier forms, so a resolve may re-arm itself waiting for the row.
  const resolveAddr = (a: string) => {
    const c0 = a[0]
    const c1 = a[1]
    if (!c1) { addrRef.current = a; return }
    if ((c0 === 't' || c0 === 'd') && /[1-9]/.test(c1)) {
      const list = c0 === 't' ? today : daily
      const it = list[Number(c1) - 1]
      if (it) selectTask(it.id)
      return
    }
    if (c0 === 'g' && /[1-9]/.test(c1)) {
      // goals read the rendered surface in DOM order — horizon groups, then
      // the Achieved group at the bottom
      const g = goalAddressList[Number(c1) - 1]
      if (g) { setSel({ kind: 'goal', id: g.id }); setEditingId(null) }
      return
    }
    if ((c0 === 'b' || c0 === 'n') && /[1-4]/.test(c1)) {
      if (a.length === 2) { addrRef.current = a; return }
      if (!/[1-9]/.test(a[2])) return
      const tier = Number(c1)
      const row = Number(a[2])
      if (c0 === 'b') {
        const rows = backlog.filter((i) => tierRank(i.priority) === tier)
        const it = rows[row - 1]
        if (it) selectTask(it.id)
      } else {
        const groups = groupNotes(notesVisible)
        const g = groups[tier - 1]
        const n = g[row - 1]
        if (n) { setSel({ kind: 'note', id: n.id }); setEditingId(null) }
      }
      return
    }
    if (c0 === 'n') {
      if (c1 === 'n') focusCapture(noteCapRef, null)
      else if (c1 === 'j' || c1 === 'q') focusCapture(noteCapRef, `##${c1} `)
      else if (c1 === 't' || c1 === 'd' || c1 === 'b') focusCapture(taskCapRef, `##${c1} `)
    }
  }

  const clickKb = (s: NonNullable<Sel>, n: number) => {
    const root = rootRef.current
    if (!root) return
    const scope = s.kind === 'task'
      ? root.querySelector(`[data-item-id="${s.id}"]`)
      : s.kind === 'note'
        ? root.querySelector(`[data-note-id="${s.id}"]`)
        : root.querySelector(`[data-goal-id="${s.id}"]`)
    scope?.querySelector<HTMLButtonElement>(`[data-kb="${n}"]`)?.click()
  }

  const handlerRef = useRef<(e: KeyboardEvent) => void>(() => {})
  handlerRef.current = (e: KeyboardEvent) => {
    // ⌘P / ⌘F work while engaged — the browser's own print/find never sees them.
    if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === 'p' || e.key === 'f')) {
      if (!engaged) return
      e.preventDefault()
      if (e.key === 'p') { setSearchOpen(false); setPaletteOpen((v) => !v) }
      else { setPaletteOpen(false); setSearchOpen((v) => !v) }
      return
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (paletteOpen || searchOpen) return // an open overlay owns the keyboard
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
      // Esc inside a demo field steps back out of it (the edit surfaces run
      // their own cancel/save first; the capture fields just lose focus)
      if (e.key === 'Escape' && rootRef.current?.contains(t)) t.blur()
      return
    }

    const live = engaged || !!pop
    if (!live) return

    if (view !== 'list') {
      // free mode: the only verb outside the list is scrolling
      const down = e.key === 'j' || e.key === 'ArrowDown'
      const up = e.key === 'k' || e.key === 'ArrowUp'
      if (down || up) { e.preventDefault(); scrollStep(down ? 1 : -1) }
      return
    }

    if (pop) {
      // an open row popover borrows the keyboard; its menu input is focused,
      // so this branch catches only a stray key with the input blurred
      if (e.key === 'Escape') setPop(null)
      return
    }

    const addr = addrRef.current
    if (addr) {
      e.preventDefault()
      addrRef.current = ''
      resolveAddr(addr + e.key)
      return
    }

    const down = e.key === 'j' || e.key === 'ArrowDown'
    const up = e.key === 'k' || e.key === 'ArrowUp'
    if (down || up) {
      e.preventDefault()
      if (!sel) scrollStep(down ? 1 : -1)
      else move(down ? 1 : -1)
      return
    }

    if (e.key === 'Enter' && sel?.kind === 'task') {
      const item = allTasks.find((i) => i.id === sel.id)
      if (item && !item.hidden) { e.preventDefault(); act.complete(item) }
    } else if (e.key === 'Enter' && sel?.kind === 'goal') {
      const goal = goalAddressList.find((g) => g.id === sel.id)
      if (goal && !goal.hidden) { e.preventDefault(); goalAct.achieve(goal) }
    } else if (e.key === 'e' && sel) {
      e.preventDefault()
      if (sel.kind === 'task') setEditingId(sel.id)
      else if (sel.kind === 'goal') setEditingId(sel.id)
      else rootRef.current?.querySelector<HTMLElement>(`[data-note-id="${sel.id}"] textarea`)?.focus()
    } else if (e.key === 'Escape') {
      setSel(null)
    } else if (/^[1-9]$/.test(e.key) && sel) {
      e.preventDefault()
      clickKb(sel, Number(e.key))
    } else if (ADDRESS_KEYS.has(e.key)) {
      e.preventDefault()
      setSel(null)
      addrRef.current = e.key
    }
  }

  useEffect(() => {
    const f = (e: KeyboardEvent) => handlerRef.current(e)
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [])

  /* ---- palette entries (built here, rendered by the overlay) ---- */

  const togglePrio = (p: number) =>
    setHiddenPriorities((hs) => (hs.includes(p) ? hs.filter((x) => x !== p) : [...hs, p]))

  const paletteEntries: PaletteEntry[] = [
    { label: 'View Analytics', hint: 'the week on one page', run: () => setView('analytics') },
    ...(features.journal ? [{ label: 'View Journal', hint: '##j lines by day', run: () => setView('journal') }] : []),
    ...(features.quotes ? [{ label: 'View Quotes', hint: '##q lines by day', run: () => setView('quotes') }] : []),
    { label: view === 'settings' ? 'Close Settings' : 'Open Settings', hint: 'features · appearance · header · views', run: () => setView(view === 'settings' ? 'list' : 'settings') },
    { label: 'Show Default View', hint: 'reset the working view', run: resetView },
    { label: focusMode ? 'Exit Focus Mode' : 'Enter Focus Mode', hint: 'P1 notes · Today · Daily · P1 backlog', run: () => setFocusMode((v) => !v) },
    // the two-layers rule: a surface's Show/Hide entry exists only while the
    // surface does — a disabled feature has nothing to toggle
    ...(features.goals ? [{ label: showGoals ? 'Hide Goals' : 'Show Goals', hint: '', run: () => setShowGoals((v) => !v) }] : []),
    ...(features.goals && features.goalPause ? [{ label: showPausedGoals ? 'Hide Paused Goals' : 'Show Paused Goals', hint: 'paused goals, inline', run: () => setShowPausedGoals((v) => !v) }] : []),
    ...(features.notes ? [{ label: showNotes ? 'Hide Notes' : 'Show Notes', hint: '', run: () => setShowNotes((v) => !v) }] : []),
    ...(features.tasks && features.today ? [{ label: showToday ? 'Hide Today' : 'Show Today', hint: '', run: () => setShowToday((v) => !v) }] : []),
    ...(features.tasks && features.daily ? [{ label: showDaily ? 'Hide Daily' : 'Show Daily', hint: '', run: () => setShowDaily((v) => !v) }] : []),
    ...(features.tasks && features.backlog ? [{ label: showBacklog ? 'Hide Backlog' : 'Show Backlog', hint: '', run: () => setShowBacklog((v) => !v) }] : []),
    ...(features.tasks && features.taskHide ? [{ label: showHiddenTasks ? 'Hide Hidden Tasks' : 'Show Hidden Tasks', hint: 'archived rows, inline', run: () => setShowHiddenTasks((v) => !v) }] : []),
    ...(features.notes && features.noteHide ? [{ label: showHiddenNotes ? 'Hide Hidden Notes' : 'Show Hidden Notes', hint: 'archived notes, inline', run: () => setShowHiddenNotes((v) => !v) }] : []),
    ...(features.tasks && features.agent ? [{ label: agentFilter === 'agent' ? 'Show My Tasks' : 'Show Agent Tasks', hint: 'the 🤖 queue', run: () => setAgentFilter((v) => (v === 'agent' ? null : 'agent')) }] : []),
    ...(features.tasks && features.taskPriorities ? [
      { label: hiddenPriorities.includes(1) ? 'Show Priority 1 Tasks' : 'Hide Priority 1 Tasks', hint: '', run: () => togglePrio(1) },
      { label: hiddenPriorities.includes(2) ? 'Show Priority 2 Tasks' : 'Hide Priority 2 Tasks', hint: '', run: () => togglePrio(2) },
      { label: hiddenPriorities.includes(3) ? 'Show Priority 3 Tasks' : 'Hide Priority 3 Tasks', hint: '', run: () => togglePrio(3) },
    ] : []),
    { label: isFull ? 'Exit Fullscreen' : 'Go Fullscreen', hint: 'Esc stays a DayApp key', run: toggleFull },
    { label: 'Reset the Demo', hint: 'fresh seed, fresh times', run: reset },
  ]

  return (
    <div
      ref={rootRef}
      className={'demo-root' + (isFull ? ' full' : '') + (engaged ? ' engaged' : '')
        + (notesCard ? '' : ' notes-bare') + (tasksCard ? ' sections-card' : '')}
      onPointerEnter={() => { pointerIn.current = true; setEngaged(true) }}
      onPointerLeave={() => { pointerIn.current = false; if (!focusIn.current && !isFull) setEngaged(false) }}
      onFocusCapture={() => { focusIn.current = true; setEngaged(true) }}
      onBlurCapture={(e) => {
        if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
          focusIn.current = false
          if (!pointerIn.current && !isFull) setEngaged(false)
        }
      }}
    >
      <div className="demo-grid-inner">
        <div className="app-window">
          <div className="win-header">
            {/* The demo chrome lives left: reset + fullscreen. The icon
                cluster is the app's own top-right set, in the app's order. */}
            <div className="win-left">
              <button className="win-ico" title="Reset the demo" onClick={reset}>↺</button>
              <button className={'win-ico' + (isFull ? ' on' : '')} title={isFull ? 'Exit fullscreen' : 'Fullscreen'}
                onClick={toggleFull}>
                <svg className="action-chevron" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
                  <path d="M7.5 1.5h3v3M4.5 10.5h-3v-3M10.5 1.5 7.2 4.8M1.5 10.5l3.3-3.3"
                    fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <span className="win-title">{VIEW_TITLES[view]}</span>
            <div className="win-right">
              {features.timer && activeSession && (
                <span className="timer-chip" title={activeSession.itemText}>
                  <span className="timer-chip-main">
                    <span className="timer-chip-pulse" />
                    <span className="timer-chip-elapsed">{fmtClock((now - activeSession.startedAt) / 1000)}</span>
                  </span>
                  <button className="timer-chip-discard" title="Discard the session" onClick={discardTimer}>×</button>
                </span>
              )}
              {headerBtns.palette && (
                <button className="win-ico" title={isMac ? 'Command palette (⌘P)' : 'Command palette (Ctrl+P)'}
                  onClick={() => { setSearchOpen(false); setPaletteOpen((v) => !v) }}>
                  <PaletteIcon mac={isMac} />
                </button>
              )}
              {headerBtns.hidden && (features.taskHide || features.dailyPause || features.noteHide) && (
                <button className={'win-ico' + (anyReveal ? ' on' : '')} title="Hidden entries"
                  onClick={toggleHidden}>◐</button>
              )}
              {headerBtns.analytics && (
                <button className={'win-ico' + (view === 'analytics' ? ' on' : '')} title={view === 'analytics' ? 'Back to the list' : 'Analytics'}
                  onClick={() => setView(view === 'analytics' ? 'list' : 'analytics')}>
                  {view === 'analytics' ? '×' : (
                    <svg className="action-chevron" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
                      <path d="M2 10V6M6 10V2M10 10V4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                    </svg>
                  )}
                </button>
              )}
              {headerBtns.journal && features.journal && (
                <button className={'win-ico' + (view === 'journal' ? ' on' : '')} title={view === 'journal' ? 'Back to the list' : 'Journal'}
                  onClick={() => setView(view === 'journal' ? 'list' : 'journal')}>{view === 'journal' ? '×' : '¶'}</button>
              )}
              {headerBtns.quotes && features.quotes && (
                <button className={'win-ico' + (view === 'quotes' ? ' on' : '')} title={view === 'quotes' ? 'Back to the list' : 'Quotes'}
                  onClick={() => setView(view === 'quotes' ? 'list' : 'quotes')}>{view === 'quotes' ? '×' : '❝'}</button>
              )}
              {headerBtns.theme && (
                <button className="win-ico theme-cycle" title={`Theme: ${demoTheme.name}`}
                  aria-label="Cycle theme" onClick={cycleTheme}>
                  {themeIsLight(demoTheme) ? <SunIcon /> : <MoonIcon />}
                  {themeSlot.count > 1 && (
                    <span className="theme-idx" aria-hidden="true">{themeSlot.index}</span>
                  )}
                </button>
              )}
              {headerBtns.settings && (
                <button className={'win-ico' + (view === 'settings' ? ' on' : '')} title={view === 'settings' ? 'Back to the list' : 'Settings'}
                  onClick={() => setView(view === 'settings' ? 'list' : 'settings')}>
                  {view === 'settings' ? '×' : <SettingsIcon />}
                </button>
              )}
            </div>
          </div>
          <div className="win-body" ref={bodyRef}>
            {view === 'list' && (
              <DemoList
                features={features}
                tasksArea={features.tasks}
                showNotes={features.notes && showNotes}
                showToday={features.tasks && features.today && showToday}
                showDaily={features.tasks && features.daily && showDaily}
                showBacklog={features.tasks && features.backlog && showBacklog}
                notes={notesVisible}
                today={today} daily={daily} backlog={backlog}
                projects={projects} activeSession={activeSession} nowMs={now || Date.now()}
                totalSecsOf={(id) => sumSecs(sessions, id)}
                sel={sel} setSel={setSel} editingId={editingId} setEditingId={setEditingId}
                detailsId={detailsId} setDetailsId={setDetailsId} pop={pop} setPop={setPop}
                taskCapRef={taskCapRef} noteCapRef={noteCapRef} act={act}
                backlogBars={backlogBars} noteBars={noteBars}
                goalsSlot={features.goals && showGoals && (
                  <DemoGoals
                    features={features}
                    goals={goalsVisible}
                    projects={projects}
                    sel={sel} setSel={setSel}
                    pop={pop} setPop={setPop}
                    editingId={editingId} setEditingId={setEditingId}
                    captureRef={goalCapRef}
                    act={goalAct}
                  />
                )}
              />
            )}
            {view === 'settings' && (
              <DemoSettings
                features={features}
                onToggleFeature={(key: FeatureKey) => setFeatures((f) => ({ ...f, [key]: !f[key] }))}
                notesCard={notesCard} tasksCard={tasksCard}
                onSetCard={(surface, card) => surface === 'notes' ? setNotesCard(card) : setTasksCard(card)}
                backlogBars={backlogBars} noteBars={noteBars}
                onSetPriorityBars={(surface, bars) => surface === 'backlog' ? setBacklogBars(bars) : setNoteBars(bars)}
                projectColorsSingle={projectColorsSingle}
                onSetProjectColors={(single) => { setProjectColorMode(single); setProjectColorsSingle(single) }}
                headerBtns={headerBtns}
                onToggleHeaderBtn={(btn: HeaderBtn) => setHeaderBtns((hs) => ({ ...hs, [btn]: !hs[btn] }))}
                themeId={demoThemeId}
                onSetTheme={setDemoThemeId}
                focusMode={focusMode}
                onToggleFocusMode={() => setFocusMode((v) => !v)}
              />
            )}
            {view === 'analytics' && (
              <DemoAnalytics items={items} actions={actions} sessions={sessions} projects={projects} features={features} />
            )}
            {view === 'journal' && (
              <DemoEntries kind="journal" entries={entries}
                onAdd={(k, t) => addEntry(k, t)}
                onEdit={(id, t) => setEntries((es) => es.map((x) => (x.id === id ? { ...x, text: t } : x)))}
                onDelete={(id) => setEntries((es) => es.filter((x) => x.id !== id))} />
            )}
            {view === 'quotes' && (
              <DemoEntries kind="quote" entries={entries}
                onAdd={(k, t) => addEntry(k, t)}
                onEdit={(id, t) => setEntries((es) => es.map((x) => (x.id === id ? { ...x, text: t } : x)))}
                onDelete={(id) => setEntries((es) => es.filter((x) => x.id !== id))} />
            )}
          </div>
        </div>
      </div>

      {!isFull && (
        <div className="demo-hint">
          {engaged
            ? 'Keyboard live — ⌘P palette · nn notes · t1 first task · j/k move · ⌘F search'
            : 'Hover the window — it is the real thing. ⌘P palette · nn · t1 · j/k · ⌘F · ⤢ fullscreen'}
        </div>
      )}

      {paletteOpen && (
        <DemoPalette entries={paletteEntries} onClose={() => setPaletteOpen(false)} />
      )}
      {searchOpen && (
        <DemoSearch
          items={allTasks}
          projects={projects}
          projectsEnabled={features.taskProjects || features.noteProjects}
          agentEnabled={features.agent}
          onClose={() => setSearchOpen(false)}
          onPickTask={(id) => { setSearchOpen(false); setView('list'); selectTask(id) }}
          onPickProject={(id) => { setSearchOpen(false); setView('list'); setProjectFilter((prev) => (prev === id ? null : id)) }}
          onPickAgent={(v) => { setSearchOpen(false); setView('list'); setAgentFilter(v === agentFilter ? null : v) }}
        />
      )}
    </div>
  )
}

function groupNotes(notes: Note[]): Note[][] {
  const g: Note[][] = [[], [], [], []]
  ;[...notes].sort((a, b) => tierRank(a.priority) - tierRank(b.priority) || a.id - b.id)
    .forEach((n) => g[tierRank(n.priority) - 1].push(n))
  return g
}

// The palette door's glyph — the app's IconCommandPalette: ⌘ on macOS (the
// icon is the key), the prompt field elsewhere (Ctrl has no pictograph, so
// the icon says "type a command" instead).
function PaletteIcon({ mac }: { mac: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {mac ? (
        <path d="M10 4v8a2 2 0 1 0 2-2H4a2 2 0 1 0 2 2V4a2 2 0 1 0-2 2h8a2 2 0 1 0-2-2" />
      ) : (
        <>
          <rect x="2.2" y="3.4" width="11.6" height="9.2" rx="1.8" />
          <path d="M5.2 6.4 7 8.1l-1.8 1.7" />
          <path d="M9.2 10.2h2.3" />
        </>
      )}
    </svg>
  )
}

// The settings door's glyph — the classic cog (Lucide's settings outline,
// MIT), scaled into the 16-box at the family's 1.7 visual stroke. Teeth ride
// the silhouette, so beside the sun it reads gear, never twin rays.
function SettingsIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <g
        transform="scale(0.6667)"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.55"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </g>
    </svg>
  )
}
