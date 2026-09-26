/* The demo's main view: Notes above the task stack, one capture bar routing
   to three sections, tier dividers labeling the Backlog and the notes. Every
   action the real app offers on tasks and notes works here; reminders are the
   one deliberate stub (they need real days). Class names and metrics follow
   the app's own stylesheet. */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  dayISO, fmtClock, fmtDuration, fmtReminder, projectColor, clipProject, tierRank,
  todayISO, tokenSpans,
  type HideDuration, type Item, type Note, type Project, type Section,
  type SessionRow, type TokenSurface,
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
        surface="note-capture"
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
        surface="task-capture"
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

/* ---- token fields: substituted mirror + painted caret ---------------------- */
/* The app's TokenField model, ported: the field's real text renders trans-
   parent and a mirror paints the SUBSTITUTED line — ##j becomes "journal",
   !2 becomes the bars glyph, @ becomes "agent" — so a token shows what it
   does. The native caret and selection track the RAW value and would drift
   off the wider display words, so both are hidden and redrawn over the
   mirror's own layout (Range rects over the segment spans). The demo has no
   CSS zoom, so the app's zoom-division work doesn't apply here. */

const TOKEN_WORDS: Record<string, string> = {
  '##t': 'today', '##d': 'daily', '##b': 'backlog', '##j': 'journal', '##q': 'quote',
  '@': 'agent', '@0': 'agent',
}

interface MirrorSeg { raw: string; word?: string; bars?: number; tok?: boolean }

function buildMirror(text: string, surface: TokenSurface): MirrorSeg[] {
  const segs: MirrorSeg[] = []
  let pos = 0
  for (const [a, b] of tokenSpans(text, surface)) {
    if (a > pos) segs.push({ raw: text.slice(pos, a) })
    const raw = text.slice(a, b)
    if (raw.startsWith('!')) segs.push({ raw, bars: raw === '!0' ? 0 : 4 - Number(raw[1]) })
    else if (TOKEN_WORDS[raw]) segs.push({ raw, word: TOKEN_WORDS[raw] })
    else segs.push({ raw, tok: true }) // #tag — processed, but nothing to convert
    pos = b
  }
  if (pos < text.length) segs.push({ raw: text.slice(pos) })
  return segs
}

// A raw caret index lands at a display position: inside a converting token
// the caret rides the end of its display word; a bars segment has no text,
// so it is crossed at its edge (after = end of the segment).
function displayPos(segs: MirrorSeg[], rawIdx: number): { seg: number; off: number; after?: boolean } {
  let raw = 0
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]
    if (rawIdx <= raw + s.raw.length) {
      const off = rawIdx - raw
      if (s.bars != null) return { seg: i, off, after: off >= s.raw.length }
      if (s.word != null) return { seg: i, off: off === 0 ? 0 : s.word.length }
      return { seg: i, off }
    }
    raw += s.raw.length
  }
  const last = segs[segs.length - 1]
  if (!last) return { seg: 0, off: 0 }
  return { seg: segs.length - 1, off: last.word?.length ?? 0, after: last.bars != null }
}

function setBoundary(range: Range, mirror: HTMLElement, pos: { seg: number; off: number; after?: boolean }, at: 'start' | 'end') {
  const set = (container: Node, off: number) => { if (at === 'start') range.setStart(container, off); else range.setEnd(container, off) }
  const child = mirror.children[pos.seg] as HTMLElement | undefined
  if (!child) { set(mirror, mirror.children.length); return }
  if (child.classList.contains('tok-bars')) {
    set(mirror, Array.prototype.indexOf.call(mirror.children, child) + (pos.after ? 1 : 0))
    return
  }
  const node = child.firstChild
  if (!node) { set(mirror, Array.prototype.indexOf.call(mirror.children, child)); return }
  set(node, Math.min(pos.off, node.textContent?.length ?? 0))
}

function useTokenPaint(
  surface: TokenSurface,
  fieldRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
  mirrorRef: React.RefObject<HTMLDivElement | null>,
  layerRef: React.RefObject<HTMLDivElement | null>,
) {
  const paintRef = useRef<() => void>(() => {})

  useEffect(() => {
    const field = fieldRef.current
    const mirror = mirrorRef.current
    const layer = layerRef.current
    if (!field || !mirror || !layer) return

    const paint = () => {
      const text = field.value
      const segs = buildMirror(text, surface)
      // rebuild the mirror from the live value — the source of truth is the DOM
      mirror.textContent = ''
      segs.forEach((s, i) => {
        const el = document.createElement('span')
        el.dataset.seg = String(i)
        if (s.bars != null) {
          el.className = 'tok priority-bars tok-bars'
          for (let b = 1; b <= 3; b++) {
            const bar = document.createElement('span')
            bar.className = 'bar' + (b <= s.bars ? ' filled' : '')
            el.appendChild(bar)
          }
        } else if (s.word != null || s.tok) {
          el.className = 'tok'
          el.textContent = s.word ?? s.raw
        } else el.textContent = s.raw
        mirror.appendChild(el)
      })

      layer.textContent = ''
      if (document.activeElement !== field) return
      const base = mirror.getBoundingClientRect()
      const lineH = parseFloat(getComputedStyle(field).lineHeight) || 18
      const caretAt = (pos: { seg: number; off: number; after?: boolean }) => {
        const range = document.createRange()
        setBoundary(range, mirror, pos, 'start')
        range.collapse(true)
        return range.getClientRects()[0] ?? range.getBoundingClientRect()
      }

      const s = field.selectionStart ?? 0
      const e = field.selectionEnd ?? 0
      if (text === '') {
        // empty field: the caret sits at the origin
        const c = document.createElement('div')
        c.className = 'tok-caret'
        c.style.left = '0px'
        c.style.top = '0px'
        c.style.height = lineH + 'px'
        layer.appendChild(c)
        return
      }
      if (s === e) {
        const rect = caretAt(displayPos(segs, s))
        const c = document.createElement('div')
        c.className = 'tok-caret'
        const left = rect.left - base.left
        const top = rect.top - base.top
        c.style.left = left + 'px'
        c.style.top = top + 'px'
        c.style.height = (rect.height || lineH) + 'px'
        layer.appendChild(c)
        // the single-line mirror tracks the caret for horizontal scroll —
        // the substituted width differs from the raw text, so the input's
        // own scrollLeft can't be copied
        if (mirror.scrollWidth > mirror.clientWidth) {
          if (left > mirror.clientWidth - 14) mirror.scrollLeft += left - mirror.clientWidth + 14
          else if (left < 0) mirror.scrollLeft = Math.max(0, mirror.scrollLeft + left - 14)
        }
      } else {
        const range = document.createRange()
        setBoundary(range, mirror, displayPos(segs, Math.min(s, e)), 'start')
        setBoundary(range, mirror, displayPos(segs, Math.max(s, e)), 'end')
        for (const rect of range.getClientRects()) {
          if (rect.width < 1) continue
          const d = document.createElement('div')
          d.className = 'tok-sel-rect'
          d.style.left = rect.left - base.left + 'px'
          d.style.top = rect.top - base.top + 'px'
          d.style.width = rect.width + 'px'
          d.style.height = rect.height + 'px'
          layer.appendChild(d)
        }
      }
    }

    paintRef.current = paint
    // Paint runs synchronously — it is pure DOM (no React state in the
    // dispatch, the trap the app's rAF deferral works around) and reading the
    // field's value/selection at event time is exactly the point.
    field.addEventListener('input', paint)
    field.addEventListener('focus', paint)
    field.addEventListener('keyup', paint)
    const onSel = () => { if (document.activeElement === field) paint() }
    document.addEventListener('selectionchange', onSel)
    paint()
    return () => {
      field.removeEventListener('input', paint)
      field.removeEventListener('focus', paint)
      field.removeEventListener('keyup', paint)
      document.removeEventListener('selectionchange', onSel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surface, fieldRef, mirrorRef, layerRef])

  return paintRef
}

// Both capture fields and the row editor render through this: uncontrolled
// field (the DOM holds the value), transparent text, mirror + caret layer
// painted by the hook.
function CaptureField({ handleRef, onSubmit, placeholder, textarea, surface }: {
  handleRef: React.RefObject<CaptureHandle | null>
  onSubmit(raw: string): void
  placeholder: string
  textarea?: boolean
  surface: TokenSurface
}) {
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null)
  const mirrorRef = useRef<HTMLDivElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const paint = useTokenPaint(surface, inputRef, mirrorRef, layerRef)

  useEffect(() => {
    handleRef.current = {
      preset(v: string) {
        const el = inputRef.current
        if (!el) return
        el.value = v
        el.focus()
        el.setSelectionRange(el.value.length, el.value.length)
        paint.current()
      },
      focus: () => inputRef.current?.focus(),
    }
    return () => { handleRef.current = null }
  }, [handleRef, paint])

  const submit = () => {
    const el = inputRef.current
    if (!el) return
    if (!el.value.trim()) return
    onSubmit(el.value)
    el.value = ''
    paint.current()
  }

  return (
    <form className="capture" onSubmit={(e) => { e.preventDefault(); submit() }}>
      <div className="tok-field">
        {textarea ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            rows={1}
            placeholder={placeholder}
            onInput={(e) => autosize(e.currentTarget)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            placeholder={placeholder}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
          />
        )}
        <div className="tok-mirror" ref={mirrorRef} data-multi={textarea ? '1' : undefined} />
        <div className="tok-caret-layer" ref={layerRef} />
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
          /* The cluster flows inline on desktop; on phones (≤640px) it floats
             over the row's right edge on hover/focus instead of reserving
             width — there is no room for a dead strip there. */
          <span className="item-actions">
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
          </span>
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
          <RemindStub onPick={() => setPop(null)} />
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
  const mirrorRef = useRef<HTMLDivElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const paint = useTokenPaint('task-edit', ref, mirrorRef, layerRef)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
    paint.current()
  }, [paint])
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
      <div className="tok-mirror" ref={mirrorRef} />
      <div className="tok-caret-layer" ref={layerRef} />
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

  const [menuRef, flip] = useFlip()
  return (
    <div className={'row-menu' + (flip ? ' flip' : '')} ref={menuRef} onClick={(e) => e.stopPropagation()}>
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

// A row near the viewport's bottom flips its popover upward — opening a menu
// must never hide it below the screen edge.
function useFlip(): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement>(null)
  const [flip, setFlip] = useState(false)
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    setFlip(m.getBoundingClientRect().bottom + 8 > window.innerHeight)
  })
  return [ref, flip]
}

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
  const [ref, flip] = useFlip()
  return (
    <div className={'row-menu hide-menu' + (flip ? ' flip' : '')} ref={ref} onClick={(e) => e.stopPropagation()}>
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

/* ---- the reminder popover (the one stub) -------------------------------------- */
/* The app's menu, faithfully: presets carrying their computed dates and a
   native date picker. The promotion itself needs the app open across real
   days, so a pick only closes the menu — the line at the bottom says so. */

const REMIND_PRESETS = [
  { days: 1, label: 'Tomorrow' },
  { days: 3, label: 'In 3 days' },
  { days: 7, label: 'In a week' },
]

function RemindStub({ onPick }: { onPick(): void }) {
  const [ref, flip] = useFlip()
  return (
    <div className={'row-menu' + (flip ? ' flip' : '')} ref={ref} onClick={(e) => e.stopPropagation()}>
      {REMIND_PRESETS.map((p) => (
        <button key={p.days} className="hide-menu-item" onMouseDown={(e) => { e.preventDefault(); onPick() }}>
          <span className="hide-menu-label">{p.label}</span>
          <span className="hide-menu-sub">{dayISO(-p.days)}</span>
        </button>
      ))}
      <div className="row-menu-divider" />
      <input type="date" className="menu-input" defaultValue={dayISO(-1)} title="Pick a date" />
      <div className="row-menu-divider" />
      <p className="remind-note">
        A reminder promotes the task on the morning it names. That needs real days
        on your Mac — it's a stub in this demo.
      </p>
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
