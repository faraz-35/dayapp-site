/* The demo's main view: Notes above the task stack, one capture bar routing
   to three sections, tier dividers labeling the Backlog and the notes. Every
   action the real app offers on tasks and notes works here; reminders are the
   one deliberate stub (they need real days). Class names and metrics follow
   the app's own stylesheet. */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  fmtClock, fmtDuration, fmtReminder, projectColor, clipProject, tierRank,
  todayISO, tokenSpans,
  type HideDuration, type Item, type Note, type Project, type Section, type SessionRow,
} from './model'

export type Pop = { kind: 'project' | 'remind' | 'hide'; on: 'task' | 'note'; id: number } | null
export type Sel = { kind: 'task' | 'note'; id: number } | null

export interface CaptureHandle {
  preset(v: string): void
  focus(): void
}

export interface DemoListProps {
  today: Item[]
  daily: Item[]
  backlog: Item[]
  notes: Note[]
  projects: Project[]
  activeSession: SessionRow | null
  nowMs: number
  totalSecsOf(id: number): number
  sel: Sel
  setSel(s: Sel): void
  editingId: number | null
  setEditingId(id: number | null): void
  detailsId: number | null
  setDetailsId(id: number | null): void
  pop: Pop
  setPop(p: Pop): void
  taskCapRef: React.RefObject<CaptureHandle | null>
  noteCapRef: React.RefObject<CaptureHandle | null>
  act: {
    addTask(raw: string): void
    addNote(raw: string): void
    complete(item: Item): void
    del(item: Item): void
    commitEdit(item: Item, raw: string): void
    setProject(id: number, projectId: number | null): void
    createProject(name: string): number
    toggleTimer(item: Item): void
    promote(item: Item): void
    hideItem(item: Item, duration: HideDuration): void
    unhide(id: number): void
    setDetails(id: number, body: string): void
    noteBody(id: number, body: string): void
    noteCollapse(id: number): void
    noteDelete(id: number): void
    noteHide(id: number, duration: HideDuration): void
    noteUnhide(id: number): void
    noteDownload(id: number): void
  }
}

export default function DemoList(p: DemoListProps) {
  return (
    <div className="d-list">
      {/* ---- notes: content, not activity — creating one writes no log ---- */}
      <div className="surface-head">Notes</div>
      <CaptureField
        textarea
        handleRef={p.noteCapRef}
        placeholder="Add a note — Enter saves · !1 #tag tag it · ##j / ##q write a journal line or quote"
        onSubmit={p.act.addNote}
      />
      <NoteGroups
        notes={p.notes}
        projects={p.projects}
        sel={p.sel}
        setSel={p.setSel}
        pop={p.pop}
        setPop={p.setPop}
        act={p.act}
      />

      {/* ---- tasks: ONE capture above the stack, ##t / ##d / ##b route ---- */}
      <div className="surface-head tasks-head">Tasks</div>
      <CaptureField
        handleRef={p.taskCapRef}
        placeholder="Add a task — plain lands in Today · ##d / ##b route · !1 #tag @ mark"
        onSubmit={p.act.addTask}
      />
      <ItemSection
        name="today" items={p.today} projects={p.projects}
        activeSession={p.activeSession} nowMs={p.nowMs} totalSecsOf={p.totalSecsOf}
        sel={p.sel} setSel={p.setSel} editingId={p.editingId} setEditingId={p.setEditingId}
        detailsId={p.detailsId} setDetailsId={p.setDetailsId} pop={p.pop} setPop={p.setPop} act={p.act}
      />
      <ItemSection
        name="daily" items={p.daily} projects={p.projects}
        activeSession={p.activeSession} nowMs={p.nowMs} totalSecsOf={p.totalSecsOf}
        sel={p.sel} setSel={p.setSel} editingId={p.editingId} setEditingId={p.setEditingId}
        detailsId={p.detailsId} setDetailsId={p.setDetailsId} pop={p.pop} setPop={p.setPop} act={p.act}
      />
      <ItemSection
        name="backlog" items={p.backlog} projects={p.projects}
        activeSession={p.activeSession} nowMs={p.nowMs} totalSecsOf={p.totalSecsOf}
        sel={p.sel} setSel={p.setSel} editingId={p.editingId} setEditingId={p.setEditingId}
        detailsId={p.detailsId} setDetailsId={p.setDetailsId} pop={p.pop} setPop={p.setPop} act={p.act}
      />
    </div>
  )
}

/* ---- capture fields with live token coloring ------------------------------ */
/* The field's text renders transparent; a mirror underneath paints the same
   text with the tokens accented — color only, never substitution, so the
   mirror is width-identical to the raw text and the native caret and
   selection stay exact. */

function TokenText({ text }: { text: string }) {
  if (!text) return null
  const spans = tokenSpans(text)
  const out: ReactNode[] = []
  let pos = 0
  spans.forEach(([a, b], i) => {
    if (a > pos) out.push(<span key={`p${i}`}>{text.slice(pos, a)}</span>)
    out.push(<span key={`t${i}`} className="tok">{text.slice(a, b)}</span>)
    pos = b
  })
  if (pos < text.length) out.push(<span key="end">{text.slice(pos)}</span>)
  return <>{out}</>
}

function CaptureField({ handleRef, onSubmit, placeholder, textarea }: {
  handleRef: React.RefObject<CaptureHandle | null>
  onSubmit(raw: string): void
  placeholder: string
  textarea?: boolean
}) {
  const [val, setVal] = useState('')
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null)

  useEffect(() => {
    handleRef.current = {
      preset(v: string) {
        setVal(v)
        requestAnimationFrame(() => {
          const el = inputRef.current
          if (!el) return
          el.focus()
          el.setSelectionRange(el.value.length, el.value.length)
        })
      },
      focus: () => inputRef.current?.focus(),
    }
    return () => { handleRef.current = null }
  }, [handleRef])

  const submit = () => {
    if (!val.trim()) return
    onSubmit(val)
    setVal('')
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !(textarea && e.shiftKey)) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <form
      className="capture"
      onSubmit={(e) => { e.preventDefault(); submit() }}
    >
      <div className="tok-field">
        {textarea ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            rows={1}
            value={val}
            placeholder={placeholder}
            onChange={(e) => { setVal(e.target.value); autosize(e.target) }}
            onKeyDown={onKey}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            value={val}
            placeholder={placeholder}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={onKey}
          />
        )}
        <div className="tok-mirror" data-multi={textarea ? '1' : undefined}>
          <TokenText text={val} />
        </div>
      </div>
    </form>
  )
}

function autosize(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

/* ---- notes: tier groups with the divider language -------------------------- */

const noteGroupsOf = (notes: Note[]): Note[][] => {
  const g: Note[][] = [[], [], [], []] // P1 P2 P3 unmarked
  ;[...notes].sort((a, b) => tierRank(a.priority) - tierRank(b.priority) || a.id - b.id)
    .forEach((n) => g[tierRank(n.priority) - 1].push(n))
  return g
}

function firstProseLine(body: string): string {
  const lines = body.split('\n').map((l) => l.trim())
  const tokenOnly = (l: string) => l.length > 0 && l.split(/\s+/).every((w) => /^(![0-3]|#[\w-]+)$/.test(w))
  return lines.find((l) => l && !tokenOnly(l)) ?? ''
}

function NoteGroups({ notes, projects, sel, setSel, pop, setPop, act }: {
  notes: Note[]
  projects: Project[]
  sel: Sel
  setSel(s: Sel): void
  pop: Pop
  setPop(p: Pop): void
  act: DemoListProps['act']
}) {
  const groups = noteGroupsOf(notes)
  const marked = groups.slice(0, 3).some((g) => g.length > 0)
  return (
    <div className="d-notes">
      {groups.map((rows, gi) => {
        if (!rows.length) return null
        const showDivider = marked && gi < 3
        return (
          <div key={gi}>
            {showDivider && (
              <div className="tier-divider"><PriorityBars filled={3 - gi} faint /></div>
            )}
            {rows.map((n) => (
              <NoteCard key={n.id} note={n} projects={projects} selected={sel?.kind === 'note' && sel.id === n.id}
                setSel={setSel} pop={pop} setPop={setPop} act={act} />
            ))}
          </div>
        )
      })}
    </div>
  )
}

function NoteCard({ note, projects, selected, setSel, pop, setPop, act }: {
  note: Note
  projects: Project[]
  selected: boolean
  setSel(s: Sel): void
  pop: Pop
  setPop(p: Pop): void
  act: DemoListProps['act']
}) {
  const [val, setVal] = useState(note.body)
  const ref = useRef<HTMLTextAreaElement>(null)
  const project = projects.find((pr) => pr.id === note.projectId) ?? null

  // The card keeps a local draft saved (with the footer catch) on blur, the
  // app's debounce-and-flush collapsed to a blur save. When the saved body
  // changes under us (a footer was caught, or the collapse button flushed),
  // the draft re-syncs so a stale footer line can't be re-applied on the
  // next blur.
  useEffect(() => { setVal(note.body) }, [note.body])
  // Autosize lives in an effect, never the ref callback: measuring during
  // the commit phase precedes final flex layout and can read a collapsed
  // width, writing a huge height.
  useEffect(() => {
    if (!note.collapsed && ref.current) autosize(ref.current)
  }, [note.collapsed, val, note.body])

  const flush = () => {
    if (val !== note.body) act.noteBody(note.id, val)
  }

  return (
    <div
      className={`note${note.hidden ? ' hidden' : ''}${note.collapsed ? ' collapsed' : ''}${selected ? ' focused' : ''}`}
      data-note-id={note.id}
      onClick={() => {
        setSel({ kind: 'note', id: note.id })
        if (note.collapsed) act.noteCollapse(note.id)
      }}
    >
      {note.collapsed ? (
        <div className="note-preview">
          <span className="note-preview-text">{firstProseLine(note.body)}</span>
          {project && (
            <span className="project-label" style={{ color: projectColor(project.id) }} title={`Project: ${project.name}`}>
              {clipProject(project.name)}
            </span>
          )}
        </div>
      ) : (
        <textarea
          ref={ref}
          className="note-textarea"
          value={val}
          onChange={(e) => { setVal(e.target.value); autosize(e.target) }}
          onBlur={flush}
          onKeyDown={(e) => { if (e.key === 'Escape') e.currentTarget.blur() }}
          spellCheck={false}
        />
      )}
      <div className="note-actions">
        {note.hidden ? (
          <>
            <button className="item-action" data-kb="3" title="Unhide" onClick={(e) => { e.stopPropagation(); act.noteUnhide(note.id) }}>↺</button>
            <button className="item-action danger" data-kb="4" title="Delete" onClick={(e) => { e.stopPropagation(); act.noteDelete(note.id) }}>×</button>
          </>
        ) : (
          <>
            <button className="item-action" data-kb="1" title={note.collapsed ? 'Expand' : 'Collapse'}
              onClick={(e) => { e.stopPropagation(); if (val !== note.body) act.noteBody(note.id, val); act.noteCollapse(note.id) }}>
              <Chevron up={note.collapsed} />
            </button>
            {note.body.trim() && (
              <button className="item-action" data-kb="2" title="Download .txt"
                onClick={(e) => { e.stopPropagation(); flush(); act.noteDownload(note.id) }}>
                <TrayIcon />
              </button>
            )}
            <button className="item-action" data-kb="3" title="Hide"
              onClick={(e) => { e.stopPropagation(); setPop(pop?.kind === 'hide' && pop.on === 'note' && pop.id === note.id ? null : { kind: 'hide', on: 'note', id: note.id }) }}>◐</button>
            <button className="item-action danger" data-kb="4" title="Delete" onClick={(e) => { e.stopPropagation(); act.noteDelete(note.id) }}>×</button>
          </>
        )}
      </div>
      {pop && pop.on === 'note' && pop.id === note.id && pop.kind === 'hide' && (
        <HideMenu verb="Hide" onPick={(d) => { act.noteHide(note.id, d); setPop(null) }} />
      )}
    </div>
  )
}

/* ---- task sections ---------------------------------------------------------- */

function ItemSection({ name, items, projects, activeSession, nowMs, totalSecsOf, sel, setSel, editingId, setEditingId, detailsId, setDetailsId, pop, setPop, act }: {
  name: Section
  items: Item[]
  projects: Project[]
  activeSession: SessionRow | null
  nowMs: number
  totalSecsOf(id: number): number
  sel: Sel
  setSel(s: Sel): void
  editingId: number | null
  setEditingId(id: number | null): void
  detailsId: number | null
  setDetailsId(id: number | null): void
  pop: Pop
  setPop(p: Pop): void
  act: DemoListProps['act']
}) {
  const backlog = name === 'backlog'
  return (
    <section className="d-section">
      <div className="stack-head">{name}</div>
      {items.length === 0 && !backlog && <div className="d-empty">Nothing here. Add something above.</div>}
      {items.map((item, i) => {
        const prev = items[i - 1]
        const newTier = backlog && (!prev || tierRank(prev.priority) !== tierRank(item.priority))
        return (
          <div key={item.id}>
            {newTier && (
              <div className="tier-divider">
                <PriorityBars filled={item.priority == null ? 0 : 4 - item.priority} faint />
              </div>
            )}
            <TaskRow
              item={item} projects={projects}
              activeSession={activeSession} nowMs={nowMs} totalSecsOf={totalSecsOf}
              selected={sel?.kind === 'task' && sel.id === item.id}
              setSel={setSel}
              editing={editingId === item.id}
              setEditingId={setEditingId}
              detailsOpen={detailsId === item.id}
              setDetailsId={setDetailsId}
              pop={pop} setPop={setPop} act={act}
            />
            {detailsId === item.id && (
              <DetailsBody
                initial={item.details}
                onCommit={(body) => act.setDetails(item.id, body)}
                onDone={() => setDetailsId(null)}
              />
            )}
          </div>
        )
      })}
    </section>
  )
}

function TaskRow({ item, projects, activeSession, nowMs, totalSecsOf, selected, setSel, editing, setEditingId, detailsOpen, setDetailsId, pop, setPop, act }: {
  item: Item
  projects: Project[]
  activeSession: SessionRow | null
  nowMs: number
  totalSecsOf(id: number): number
  selected: boolean
  setSel(s: Sel): void
  editing: boolean
  setEditingId(id: number | null): void
  detailsOpen: boolean
  setDetailsId(id: number | null): void
  pop: Pop
  setPop(p: Pop): void
  act: DemoListProps['act']
}) {
  const done = item.status === 'done' || (item.section === 'daily' && item.doneDay === todayISO())
  const project = projects.find((pr) => pr.id === item.projectId) ?? null
  const isTiming = activeSession?.itemId === item.id
  const elapsed = isTiming && activeSession ? (nowMs - activeSession.startedAt) / 1000 : 0
  const total = totalSecsOf(item.id)
  const startEdit = () => setEditingId(item.id)

  return (
    <>
      <div
        className={`item${done ? ' done' : ''}${item.hidden ? ' hidden' : ''}${selected ? ' selected' : ''}`}
        data-item-id={item.id}
        onClick={() => {
          setSel({ kind: 'task', id: item.id })
          if (!editing) startEdit()
        }}
      >
        <span className="grip" title="Drag to reorder (in the app)">⠿</span>
        <button
          className={`item-check${done ? ' checked' : ''}`}
          title={item.hidden ? 'Hidden' : done ? (item.section === 'today' ? 'Completed — click to undo' : 'Completed for today') : 'Mark done'}
          onClick={(e) => { e.stopPropagation(); if (!item.hidden) act.complete(item) }}
        />
        {editing ? (
          <EditInput
            initial={item.text}
            onCommit={(raw) => { act.commitEdit(item, raw); setEditingId(null) }}
          />
        ) : (
          <span className="item-text">{item.text}</span>
        )}
        {!editing && (
          <div className="item-meta">
            {item.hidden && <span className="hidden-chip">◐ {item.hiddenUntil ? `until ${fmtReminder(item.hiddenUntil)}` : 'forever'}</span>}
            {!isTiming && total > 0 && <span className="time-label" title="Time tracked">⏱ {fmtDuration(total)}</span>}
            {item.remindAt && <span className="reminder-chip" title={`Reminds on ${item.remindAt}`}>→ {fmtReminder(item.remindAt)}</span>}
            <span className={`meta-priority${isTiming ? ' timing' : ''}`}>
              {isTiming ? <span className="timer-live" title="Elapsed">{fmtClock(elapsed)}</span>
                : item.section !== 'backlog' && item.priority != null ? <PriorityBars filled={4 - item.priority} />
                : null}
            </span>
            <span className="meta-agent">{item.agent && <AgentBadge />}</span>
            <span className="meta-project">
              {project && (
                <span className="project-label" style={{ color: projectColor(project.id) }} title={`Project: ${project.name}`}>
                  {clipProject(project.name)}
                </span>
              )}
            </span>
          </div>
        )}
        {!editing && (
          <>
            {isTiming ? (
              <button className="item-action" data-kb="1" title="Stop timer" onClick={(e) => { e.stopPropagation(); act.toggleTimer(item) }}>⏸</button>
            ) : item.hidden ? null : item.section === 'backlog' ? (
              <button className="item-action" data-kb="1" title="Send to Today" onClick={(e) => { e.stopPropagation(); act.promote(item) }}><Chevron up /></button>
            ) : (
              <button className="item-action" data-kb="1" title="Start timer" onClick={(e) => { e.stopPropagation(); act.toggleTimer(item) }}>▶</button>
            )}
            {item.hidden ? (
              <>
                <button className="item-action" data-kb="4" title="Unhide" onClick={(e) => { e.stopPropagation(); act.unhide(item.id) }}>↺</button>
                <button className="item-action danger" data-kb="6" title="Delete" onClick={(e) => { e.stopPropagation(); act.del(item) }}>×</button>
              </>
            ) : (
              <>
                <button className={`item-action${pop?.kind === 'project' && pop.on === 'task' && pop.id === item.id ? ' active' : ''}`} data-kb="2" title="Project"
                  onClick={(e) => { e.stopPropagation(); setPop(pop?.kind === 'project' && pop.on === 'task' && pop.id === item.id ? null : { kind: 'project', on: 'task', id: item.id }) }}>#</button>
                <button className={`item-action${pop?.kind === 'remind' && pop.on === 'task' && pop.id === item.id ? ' active' : ''}`} data-kb="3" title="Remind me"
                  onClick={(e) => { e.stopPropagation(); setPop(pop?.kind === 'remind' && pop.on === 'task' && pop.id === item.id ? null : { kind: 'remind', on: 'task', id: item.id }) }}>◷</button>
                <button className={`item-action${pop?.kind === 'hide' && pop.on === 'task' && pop.id === item.id ? ' active' : ''}`} data-kb="4"
                  title={item.section === 'daily' ? 'Pause' : 'Hide'}
                  onClick={(e) => { e.stopPropagation(); setPop(pop?.kind === 'hide' && pop.on === 'task' && pop.id === item.id ? null : { kind: 'hide', on: 'task', id: item.id }) }}>◐</button>
                <button className={`item-action${detailsOpen ? ' active' : ''}`} data-kb="5"
                  title={detailsOpen ? 'Collapse details' : item.details ? 'Expand details' : 'Add details'}
                  onClick={(e) => { e.stopPropagation(); setDetailsId(detailsOpen ? null : item.id) }}>
                  {detailsOpen ? <Chevron up /> : item.details ? <Chevron /> : '⋯'}
                </button>
                <button className="item-action danger" data-kb="6" title="Delete" onClick={(e) => { e.stopPropagation(); act.del(item) }}>×</button>
              </>
            )}
          </>
        )}
        {pop && pop.on === 'task' && pop.id === item.id && pop.kind === 'project' && (
          <ProjectMenu
            projects={projects}
            current={item.projectId}
            onPick={(pid) => { act.setProject(item.id, pid); setPop(null) }}
            onCreate={(name) => { const id = act.createProject(name); act.setProject(item.id, id); setPop(null) }}
            onClose={() => setPop(null)}
          />
        )}
        {pop && pop.on === 'task' && pop.id === item.id && pop.kind === 'remind' && (
          <div className="row-menu remind-stub">
            <div className="row-menu-title">◷ Remind me</div>
            <p>
              Pick a date and the task promotes itself to Today on that morning.
              That needs real days on your Mac — it's left out of this demo.
            </p>
          </div>
        )}
        {pop && pop.on === 'task' && pop.id === item.id && pop.kind === 'hide' && (
          <HideMenu
            verb={item.section === 'daily' ? 'Pause' : 'Hide'}
            onPick={(d) => { act.hideItem(item, d); setPop(null) }}
          />
        )}
      </div>
    </>
  )
}

function EditInput({ initial, onCommit }: {
  initial: string
  onCommit(raw: string): void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])
  return (
    <div className="tok-field item-edit">
      <input
        ref={ref}
        defaultValue={initial}
        onClick={(e) => e.stopPropagation()}
        onBlur={(e) => onCommit(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); onCommit(e.currentTarget.value) }
          if (e.key === 'Escape') { e.currentTarget.value = initial; onCommit(initial) }
        }}
      />
      <EditMirror initial={initial} inputRef={ref} />
    </div>
  )
}

// The edit field's mirror re-parses as you type so the tokens its commit will
// strip are the ones it colors. The input is uncontrolled; the mirror reads
// its live value through the ref, repainting on each keystroke's own event.
function EditMirror({ initial, inputRef }: {
  initial: string
  inputRef: React.RefObject<HTMLInputElement | null>
}) {
  const [, force] = useState(0)
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    const on = () => force((n) => n + 1)
    el.addEventListener('input', on)
    return () => el.removeEventListener('input', on)
  }, [inputRef])
  const text = inputRef.current?.value ?? initial
  return (
    <div className="tok-mirror">
      <TokenText text={text} />
    </div>
  )
}

function DetailsBody({ initial, onCommit, onDone }: {
  initial: string
  onCommit(body: string): void
  onDone(): void
}) {
  const [val, setVal] = useState(initial)
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    autosize(el)
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])
  const flush = () => { if (val !== initial) onCommit(val) }
  return (
    <div className="item-details">
      <span className="grip" aria-hidden>⠿</span>
      <span className="details-slot" aria-hidden />
      <textarea
        ref={ref}
        value={val}
        placeholder="Add context, constraints, done-criteria… (for @ tasks, the prompt)"
        spellCheck={false}
        onChange={(e) => { setVal(e.target.value); autosize(e.target) }}
        onBlur={flush}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); flush(); onDone() }
        }}
      />
    </div>
  )
}

/* ---- the project popover ---------------------------------------------------- */

function ProjectMenu({ projects, current, onPick, onCreate, onClose }: {
  projects: Project[]
  current: number | null
  onPick(projectId: number | null): void
  onCreate(name: string): void
  onClose(): void
}) {
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => inputRef.current?.focus(), [])

  const n = q.trim().toLowerCase()
  const rows: Array<{ id: number | null; name: string; color?: string }> = [
    { id: null, name: 'No project' },
    ...projects.map((pr) => ({ id: pr.id, name: pr.name, color: projectColor(pr.id) })),
  ]
  const filtered = n ? rows.filter((r) => r.name.toLowerCase().includes(n)) : rows
  const exact = projects.find((pr) => pr.name.toLowerCase() === n)
  const canCreate = n.length > 0 && !exact
  const items = canCreate ? [...filtered, { id: -1 as number | null, name: `Create “${q.trim()}”` }] : filtered
  const h = Math.min(hi, Math.max(items.length - 1, 0))

  const pickAt = (i: number) => {
    const it = items[i]
    if (!it) return
    if (it.id === -1) onCreate(q.trim())
    else onPick(it.id)
  }

  return (
    <div className="row-menu" onClick={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        className="row-menu-input"
        value={q}
        placeholder="Filter or create…"
        onChange={(e) => { setQ(e.target.value); setHi(0) }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setHi(Math.min(h + 1, items.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(Math.max(h - 1, 0)) }
          else if (e.key === 'Enter') { e.preventDefault(); pickAt(h) }
          else if (e.key === 'Escape') { e.preventDefault(); onClose() }
        }}
      />
      <div className="row-menu-list">
        {items.map((r, i) => (
          <button
            key={`${r.id}-${r.name}`}
            className={'row-menu-item' + (i === h ? ' hi' : '') + (r.id === current ? ' cur' : '')}
            onMouseDown={(e) => { e.preventDefault(); pickAt(i) }}
          >
            {r.id === -1 ? (
              <span className="row-menu-name">{r.name}</span>
            ) : (
              <>
                {r.id === null
                  ? <span className="dot hollow" />
                  : <span className="dot" style={{ background: r.color }} />}
                <span className="row-menu-name">{r.name}</span>
                {r.id === current && <span className="row-menu-check">✓</span>}
              </>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ---- the hide-duration popover ---------------------------------------------- */

const HIDE_OPTIONS: { id: HideDuration; label: string; sub: string }[] = [
  { id: 'forever', label: 'Forever', sub: 'until unhidden' },
  { id: 'day', label: 'For a day', sub: 'until tomorrow' },
  { id: 'week', label: 'For a week', sub: 'until next week' },
  { id: 'month', label: 'For a month', sub: 'until next month' },
]

function HideMenu({ verb, onPick }: {
  verb: 'Hide' | 'Pause'
  onPick(d: HideDuration): void
}) {
  return (
    <div className="row-menu hide-menu" onClick={(e) => e.stopPropagation()}>
      {HIDE_OPTIONS.map((o) => (
        <button
          key={o.id}
          className="hide-menu-item"
          onMouseDown={(e) => { e.preventDefault(); onPick(o.id) }}
        >
          <span className="hide-menu-label">{o.label}</span>
          <span className="hide-menu-sub">{o.id === 'forever' && verb === 'Pause' ? 'until unpaused' : o.sub}</span>
        </button>
      ))}
    </div>
  )
}

/* ---- shared glyphs ----------------------------------------------------------- */

export function PriorityBars({ filled, faint }: { filled: number; faint?: boolean }) {
  return (
    <span className={'priority-bars' + (faint ? ' faint' : '')} aria-hidden>
      {[1, 2, 3].map((i) => (
        <span key={i} className={'bar' + (i <= filled ? ' filled' : '')} />
      ))}
    </span>
  )
}

function AgentBadge() {
  return (
    <span className="agent-badge" title="Assigned to the AI agent">
      <svg viewBox="0 0 12 12" width="13" height="13" aria-hidden="true">
        <circle cx="6" cy="1.6" r="1" />
        <rect x="5.4" y="2.2" width="1.2" height="1.4" rx="0.6" />
        <rect x="1.8" y="3.4" width="8.4" height="6.8" rx="1.8" />
        <circle className="agent-eye" cx="4.5" cy="6.8" r="1" />
        <circle className="agent-eye" cx="7.5" cy="6.8" r="1" />
      </svg>
    </span>
  )
}

function Chevron({ up }: { up?: boolean }) {
  return (
    <svg className="action-chevron" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
      <path d={up ? 'M2.8 7.6 6 4.4 9.2 7.6' : 'M2.8 4.4 6 7.6 9.2 4.4'}
        fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TrayIcon() {
  return (
    <svg className="action-chevron" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
      <path d="M6 1.5v6M3.4 5.4 6 8l2.6-2.6M2 10.5h8"
        fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
