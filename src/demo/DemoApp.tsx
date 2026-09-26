/* The demo's root: all state (items, notes, actions, sessions, entries),
   every mutation (each logging itself the way the app's transactions do),
   the keyboard grammar, engagement, the window chrome, and the four views.
   Keyboard only listens while the demo is engaged — pointer over it, focus
   inside it, an overlay open, or fullscreen — so the page around it never
   loses a keystroke. */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fmtClock, makeSeed, openSession, parseEntryCapture, parseTags,
  parseTaskCapture, splitNoteFooter, tierRank, todayISO, totalSecs as sumSecs,
  type ActionRow, type ActionVerb, type EntryRow, type Item, type Note,
  type Priority, type Project, type Seed,
} from './model'
import DemoList, { type CaptureHandle, type Pop, type Sel } from './DemoList'
import DemoAnalytics from './DemoAnalytics'
import DemoEntries from './DemoEntries'
import { DemoPalette, DemoSearch, type PaletteEntry } from './DemoOverlays'

type View = 'list' | 'analytics' | 'journal' | 'quotes'

const VIEW_TITLES: Record<View, string> = {
  list: 'Live @ Demo', analytics: 'Analytics', journal: 'Journal', quotes: 'Quotes',
}

const ADDRESS_KEYS = new Set(['n', 't', 'd', 'b'])

export default function DemoApp() {
  const [seed0] = useState<Seed>(makeSeed)
  const [items, setItems] = useState(seed0.items)
  const [notes, setNotes] = useState(seed0.notes)
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
  const [agentFilter, setAgentFilter] = useState<null | 'agent' | 'my'>(null)
  const [projectFilter, setProjectFilter] = useState<number | null>(null)

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
  const canFull = useState(() => typeof document !== 'undefined' && document.fullscreenEnabled === true)[0]

  const activeSession = openSession(sessions)

  /* ---- visibility pipelines (the ⌘P toggles + ⌘F filters compose here) ---- */

  const pass = (i: Item) =>
    (i.hidden ? showHiddenTasks : true) &&
    (i.priority == null || !hiddenPriorities.includes(i.priority)) &&
    (agentFilter == null || (agentFilter === 'agent' ? i.agent : !i.agent)) &&
    (projectFilter == null || i.projectId === projectFilter)

  const { today, daily, backlog, allTasks } = useMemo(() => {
    const t = items.filter((i) => i.section === 'today' && pass(i))
    const d = items.filter((i) => i.section === 'daily' && pass(i))
    const b = items.filter((i) => i.section === 'backlog' && pass(i))
      .sort((a, c) => tierRank(a.priority) - tierRank(c.priority) || a.id - c.id)
    return { today: t, daily: d, backlog: b, allTasks: [...t, ...d, ...b] }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, hiddenPriorities, showHiddenTasks, agentFilter, projectFilter])

  const notesVisible = useMemo(() => notes.filter((n) =>
    (n.hidden ? showHiddenNotes : true) &&
    (projectFilter == null || n.projectId === projectFilter),
  ), [notes, showHiddenNotes, projectFilter])

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

  /* ---- fullscreen + engagement ---- */
  useEffect(() => {
    const onFs = () => setIsFull(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  useEffect(() => {
    setEngaged(pointerIn.current || focusIn.current || isFull)
  }, [isFull])

  const toggleFull = () => {
    // the class flips optimistically — the fullscreenchange listener below
    // reconciles the Esc-key exit
    if (document.fullscreenElement) {
      document.exitFullscreen()
      setIsFull(false)
    } else {
      rootRef.current?.requestFullscreen()
        .then(() => setIsFull(true))
        .catch((err) => console.warn('fullscreen failed', err))
    }
  }

  /* ---- mutations — every item write appends to `actions` ---- */

  const logAction = (verb: ActionVerb, text: string, itemId: number | null, projectId: number | null, priority: Priority) => {
    const projectName = projects.find((p) => p.id === projectId)?.name ?? null
    const row: ActionRow = {
      id: nextId(), itemId, text, verb, project: projectName, priority,
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
      const { section, tags } = parseTaskCapture(raw, proj)
      if (!tags.text) return
      if (proj.length !== projects.length) setProjects(proj)
      const item: Item = {
        id: nextId(), text: tags.text, section, status: 'active', doneDay: null,
        priority: tags.priority, projectId: tags.projectId, agent: tags.agent,
        details: '', hidden: false, createdDay: todayISO(), remindAt: null,
      }
      setItems((xs) => [...xs, item])
      logAction('created', item.text, item.id, item.projectId, item.priority)
    },
    complete(item: Item) {
      if (item.hidden) return
      stopFor(item.id)
      if (item.section === 'backlog') {
        // done Backlog rows leave the list — the completion lives in the log
        setItems((xs) => xs.filter((x) => x.id !== item.id))
        logAction('completed', item.text, item.id, item.projectId, item.priority)
        return
      }
      const done = item.status === 'done' || (item.section === 'daily' && item.doneDay === todayISO())
      setItems((xs) => xs.map((x) => x.id === item.id
        ? (x.section === 'daily'
            ? { ...x, doneDay: done ? null : todayISO() }
            : { ...x, status: done ? 'active' : 'done' as const })
        : x))
      logAction(done ? 'uncompleted' : 'completed', item.text, item.id, item.projectId, item.priority)
    },
    del(item: Item) {
      stopFor(item.id)
      logAction('deleted', item.text, item.id, item.projectId, item.priority)
      setItems((xs) => xs.filter((x) => x.id !== item.id))
    },
    commitEdit(item: Item, raw: string) {
      const text = raw.trim()
      if (!text || text === item.text) return
      const proj = [...projects]
      // no token on an edit leaves the value alone — current rides in
      const tags = parseTags(text, proj, { priority: item.priority, projectId: item.projectId, agent: item.agent })
      if (proj.length !== projects.length) setProjects(proj)
      setItems((xs) => xs.map((x) => x.id === item.id
        ? { ...x, text: tags.text, priority: tags.priority, projectId: tags.projectId, agent: tags.agent }
        : x))
      logAction('edited', tags.text, item.id, tags.projectId, tags.priority)
    },
    setProject(id: number, projectId: number | null) {
      setItems((xs) => xs.map((x) => (x.id === id ? { ...x, projectId } : x)))
    },
    createProject(name: string): number {
      const p: Project = { id: nextId(), name }
      setProjects((ps) => [...ps, p])
      return p.id
    },
    toggleTimer,
    promote(item: Item) {
      setItems((xs) => xs.map((x) => x.id === item.id ? { ...x, section: 'today' as const, remindAt: null } : x))
      logAction('moved', item.text, item.id, item.projectId, item.priority)
    },
    hideItem(item: Item) {
      setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, hidden: true } : x)))
      logAction('paused', item.text, item.id, item.projectId, item.priority)
    },
    unhide(id: number) {
      const item = items.find((x) => x.id === id)
      setItems((xs) => xs.map((x) => (x.id === id ? { ...x, hidden: false } : x)))
      if (item) logAction('unpaused', item.text, item.id, item.projectId, item.priority)
    },
    setDetails(id: number, body: string) {
      setItems((xs) => xs.map((x) => (x.id === id ? { ...x, details: body } : x)))
    },
    addNote(raw: string) {
      // the typed capture bus: a leading ##j / ##q writes an entry, not a note
      const entry = parseEntryCapture(raw)
      if (entry.kind) {
        if (entry.text) addEntry(entry.kind, entry.text)
        return
      }
      const proj = [...projects]
      const tags = parseTags(raw, proj)
      if (!tags.text) return
      if (proj.length !== projects.length) setProjects(proj)
      const note: Note = {
        id: nextId(), body: tags.text, priority: tags.priority,
        projectId: tags.projectId, hidden: false, collapsed: false,
      }
      setNotes((ns) => [...ns, note])
    },
    noteBody(id: number, body: string) {
      setNotes((ns) => ns.map((n) => {
        if (n.id !== id) return n
        const proj = [...projects]
        const caught = splitNoteFooter(body, proj, { priority: n.priority, projectId: n.projectId })
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
    noteHide(id: number) {
      setNotes((ns) => ns.map((n) => (n.id === id ? { ...n, hidden: true } : n)))
    },
    noteUnhide(id: number) {
      setNotes((ns) => ns.map((n) => (n.id === id ? { ...n, hidden: false } : n)))
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

  // Show Default View resets the working view; Reset the Demo reseeds both.
  const resetView = () => {
    setView('list'); setSel(null); setEditingId(null); setDetailsId(null); setPop(null)
    setHiddenPriorities([]); setShowHiddenTasks(false); setShowHiddenNotes(false)
    setAgentFilter(null); setProjectFilter(null)
  }

  const reset = () => {
    const s = makeSeed()
    idRef.current = 1000
    setItems(s.items); setNotes(s.notes); setProjects(s.projects)
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
      : root.querySelector(`[data-note-id="${s.id}"]`)
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
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return

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
    } else if (e.key === 'e' && sel) {
      e.preventDefault()
      if (sel.kind === 'task') setEditingId(sel.id)
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
    { label: 'View Journal', hint: '##j lines by day', run: () => setView('journal') },
    { label: 'View Quotes', hint: '##q lines by day', run: () => setView('quotes') },
    { label: 'Show Default View', hint: 'reset the working view', run: resetView },
    { label: showHiddenTasks ? 'Hide Hidden Tasks' : 'Show Hidden Tasks', hint: 'archived rows, inline', run: () => setShowHiddenTasks((v) => !v) },
    { label: showHiddenNotes ? 'Hide Hidden Notes' : 'Show Hidden Notes', hint: 'archived notes, inline', run: () => setShowHiddenNotes((v) => !v) },
    { label: agentFilter === 'agent' ? 'Show My Tasks' : 'Show Agent Tasks', hint: 'the 🤖 queue', run: () => setAgentFilter((v) => (v === 'agent' ? null : 'agent')) },
    { label: hiddenPriorities.includes(1) ? 'Show Priority 1 Tasks' : 'Hide Priority 1 Tasks', hint: '', run: () => togglePrio(1) },
    { label: hiddenPriorities.includes(2) ? 'Show Priority 2 Tasks' : 'Hide Priority 2 Tasks', hint: '', run: () => togglePrio(2) },
    { label: hiddenPriorities.includes(3) ? 'Show Priority 3 Tasks' : 'Hide Priority 3 Tasks', hint: '', run: () => togglePrio(3) },
    ...(canFull ? [{ label: isFull ? 'Exit Fullscreen' : 'Go Fullscreen', hint: 'Esc leaves', run: toggleFull }] : []),
    { label: 'Reset the Demo', hint: 'fresh seed, fresh times', run: reset },
  ]

  return (
    <div
      ref={rootRef}
      className={'demo-root' + (isFull ? ' full' : '') + (engaged ? ' engaged' : '')}
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
            <div className="win-left">
              <button className={'win-ico' + (view === 'journal' ? ' on' : '')} title={view === 'journal' ? 'Back to the list' : 'Journal'}
                onClick={() => setView(view === 'journal' ? 'list' : 'journal')}>{view === 'journal' ? '×' : '¶'}</button>
              <button className={'win-ico' + (view === 'quotes' ? ' on' : '')} title={view === 'quotes' ? 'Back to the list' : 'Quotes'}
                onClick={() => setView(view === 'quotes' ? 'list' : 'quotes')}>{view === 'quotes' ? '×' : '❝'}</button>
              <button className={'win-ico' + (view === 'analytics' ? ' on' : '')} title={view === 'analytics' ? 'Back to the list' : 'Analytics'}
                onClick={() => setView(view === 'analytics' ? 'list' : 'analytics')}>
                {view === 'analytics' ? '×' : (
                  <svg className="action-chevron" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
                    <path d="M2 10V6M6 10V2M10 10V4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                )}
              </button>
            </div>
            <span className="win-title">{VIEW_TITLES[view]}</span>
            <div className="win-right">
              {activeSession && (
                <span className="timer-chip" title={activeSession.itemText}>
                  <span className="timer-chip-main">
                    <span className="timer-chip-pulse" />
                    <span className="timer-chip-elapsed">{fmtClock((now - activeSession.startedAt) / 1000)}</span>
                  </span>
                  <button className="timer-chip-discard" title="Discard the session" onClick={discardTimer}>×</button>
                </span>
              )}
              <button className="win-ico" title="Reset the demo" onClick={reset}>↺</button>
              {canFull && (
                <button className={'win-ico' + (isFull ? ' on' : '')} title={isFull ? 'Exit fullscreen' : 'Fullscreen'}
                  onClick={toggleFull}>
                  <svg className="action-chevron" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
                    <path d="M7.5 1.5h3v3M4.5 10.5h-3v-3M10.5 1.5 7.2 4.8M1.5 10.5l3.3-3.3"
                      fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div className="win-body" ref={bodyRef}>
            {view === 'list' && (
              <DemoList
                today={today} daily={daily} backlog={backlog} notes={notesVisible}
                projects={projects} activeSession={activeSession} nowMs={now || Date.now()}
                totalSecsOf={(id) => sumSecs(sessions, id)}
                sel={sel} setSel={setSel} editingId={editingId} setEditingId={setEditingId}
                detailsId={detailsId} setDetailsId={setDetailsId} pop={pop} setPop={setPop}
                taskCapRef={taskCapRef} noteCapRef={noteCapRef} act={act}
              />
            )}
            {view === 'analytics' && (
              <DemoAnalytics items={items} actions={actions} sessions={sessions} projects={projects} />
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
