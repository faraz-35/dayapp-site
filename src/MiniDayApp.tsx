import { useRef, useState } from 'react'

/* A working miniature of DayApp's main page, in the browser: Notes above the
   task stack, one capture bar routing to three sections, tier dividers with
   the label centered between two hairlines — and a live "actions" log beside
   it. Tasks log themselves (the thesis); notes deliberately don't (content,
   not activity) — exactly the app's rule. */

type Section = 'today' | 'daily' | 'backlog'
type Priority = 1 | 2 | 3 | null

interface Item {
  id: number
  text: string
  section: Section
  done: boolean
  priority: Priority
  project: string | null
  agent: boolean
}

interface Note {
  id: number
  body: string
  priority: Priority
  project: string | null
}

interface LogEntry {
  id: number
  verb: string
  text: string
  at: string
  tone: 'done' | 'create' | 'delete' | 'undo'
}

const SECTIONS: Section[] = ['today', 'daily', 'backlog']

// deterministic hue per project name — the app's stable color labels
function projectColor(name: string): string {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return `hsl(${h % 360} 55% 68%)`
}

// trailing !N / #tag / bare @ , composable, in any order
function parseTags(raw: string): { text: string; priority: Priority; project: string | null; agent: boolean } {
  const words = raw.trim().split(/\s+/)
  let priority: Priority = null
  let project: string | null = null
  let agent = false
  while (words.length > 1) {
    const w = words[words.length - 1]
    if (w === '@') agent = true
    else if (/^![1230]$/.test(w)) priority = w === '!0' ? null : (Number(w[1]) as 1 | 2 | 3)
    else if (/^#[\w-]+$/.test(w)) project = w.slice(1)
    else break
    words.pop()
  }
  return { text: words.join(' '), priority, project, agent }
}

// the task capture's routing: a leading ##t / ##d / ##b sends the line to a
// section; a plain line lands in Today; a bare token adds nothing
function parseTaskCapture(raw: string): { section: Section; tags: ReturnType<typeof parseTags> } {
  let section: Section = 'today'
  let text = raw.trim()
  const route = text.match(/^##(t|d|b)(\s+|$)/)
  if (route) {
    section = route[1] === 't' ? 'today' : route[1] === 'd' ? 'daily' : 'backlog'
    text = text.slice(route[0].length)
  }
  return { section, tags: parseTags(text) }
}

// the demo persona: a founder/builder's day
const SEED_TASKS: Omit<Item, 'id'>[] = [
  { text: 'Ship the landing page', section: 'today', done: false, priority: 1, project: 'growth', agent: false },
  { text: 'Send the invoice', section: 'today', done: true, priority: null, project: null, agent: false },
  { text: 'Reply to the intro email', section: 'today', done: false, priority: null, project: null, agent: false },
  { text: 'Read 20 pages', section: 'daily', done: true, priority: null, project: null, agent: false },
  { text: 'Ship one small thing', section: 'daily', done: false, priority: 2, project: null, agent: false },
  { text: 'Rewrite onboarding flow', section: 'backlog', done: false, priority: 2, project: 'growth', agent: false },
  { text: 'Sketch the mobile widget', section: 'backlog', done: false, priority: 3, project: null, agent: true },
  { text: 'Deep-clean the apartment', section: 'backlog', done: false, priority: null, project: null, agent: false },
]

const SEED_NOTES: Omit<Note, 'id'>[] = [
  {
    body: 'Launch checklist\nscreenshots · dmg link · first post draft',
    priority: 1,
    project: null,
  },
  {
    body: 'Idea: a quote screensaver for the idle minutes',
    priority: null,
    project: 'growth',
  },
  {
    body: 'Deep Work — lines to reread\n"clarity about what matters provides clarity about what does not"',
    priority: null,
    project: null,
  },
]

// the persona's morning, already in the log — the panel is alive on arrival
const SEED_LOG: Omit<LogEntry, 'id'>[] = [
  { verb: 'completed', text: 'Send the invoice', at: '9:41', tone: 'done' },
  { verb: 'created', text: 'Ship the landing page', at: '8:57', tone: 'create' },
  { verb: 'completed', text: 'Read 20 pages', at: '7:30', tone: 'done' },
]

function seedTasks(): Item[] {
  return SEED_TASKS.map((s, i) => ({ ...s, id: i + 1 }))
}

const tierRank = (p: Priority) => (p == null ? 4 : p)

// the app's signal bars: filled count = urgency — P1 is ▮▮▮, P3 is ▮▯▯
function Bars({ filled, faint }: { filled: number; faint?: boolean }) {
  return (
    <span className={'bars' + (faint ? ' faint' : '')} aria-hidden>
      {[1, 2, 3].map((i) => (
        <span key={i} className={'b' + (i <= filled ? ' on' : '')} />
      ))}
    </span>
  )
}

function Row({ item, showBars, onToggle, onRemove }: {
  item: Item
  showBars: boolean
  onToggle: () => void
  onRemove: () => void
}) {
  return (
    <div className={'mrow' + (item.done ? ' done' : '')}>
      <span className="grip" aria-hidden>⠿</span>
      <button className="mcheck" onClick={onToggle} aria-label={item.done ? 'uncomplete' : 'complete'}>
        <span>✓</span>
      </button>
      <span className="mtext">{item.text}</span>
      <span className="mmeta">
        {item.agent && <span className="bot" title="delegated to the agent">🤖</span>}
        {showBars && item.priority != null && <Bars filled={4 - item.priority} />}
        {item.project && (
          <span className="mproj" style={{ color: projectColor(item.project) }}>#{item.project}</span>
        )}
        <button className="mdel" onClick={onRemove} aria-label="delete">×</button>
      </span>
    </div>
  )
}

function NoteCard({ note, onRemove }: { note: Note; onRemove: () => void }) {
  return (
    <div className="mnote">
      <div className="mnote-body">{note.body}</div>
      <span className="mnote-meta">
        {note.project && (
          <span className="mproj" style={{ color: projectColor(note.project) }}>#{note.project}</span>
        )}
        <button className="mdel" onClick={onRemove} aria-label="delete note">×</button>
      </span>
    </div>
  )
}

export default function MiniDayApp() {
  const [items, setItems] = useState<Item[]>(seedTasks)
  const [notes, setNotes] = useState<Note[]>(() => SEED_NOTES.map((s, i) => ({ ...s, id: i + 1 })))
  const [log, setLog] = useState<LogEntry[]>(() => SEED_LOG.map((s, i) => ({ ...s, id: i + 1 })))
  const logId = useRef(SEED_LOG.length)

  function record(verb: string, text: string, tone: LogEntry['tone']) {
    const at = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    setLog((l) => [{ id: ++logId.current, verb, text, at, tone }, ...l].slice(0, 30))
  }

  function toggle(item: Item) {
    if (item.section === 'backlog') {
      // backlog: complete = leave the list, the completion lives in the log
      setItems((xs) => xs.filter((x) => x.id !== item.id))
      record('completed', item.text, 'done')
      return
    }
    const done = !item.done
    setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, done } : x)))
    record(done ? 'completed' : 'uncompleted', item.text, done ? 'done' : 'undo')
  }

  function remove(item: Item) {
    setItems((xs) => xs.filter((x) => x.id !== item.id))
    record('deleted', item.text, 'delete')
  }

  function addTask(raw: string) {
    const { section, tags } = parseTaskCapture(raw)
    if (!tags.text) return
    setItems((xs) => [...xs, { id: Date.now(), done: false, section, ...tags }])
    record('created', tags.text, 'create')
  }

  function addNote(raw: string) {
    const { text, priority, project } = parseTags(raw)
    if (!text) return
    setNotes((ns) => [...ns, { id: Date.now(), body: text, priority, project }])
    // deliberately unlogged — notes are content, not activity (the app's rule)
  }

  function removeNote(note: Note) {
    setNotes((ns) => ns.filter((n) => n.id !== note.id))
  }

  function reset() {
    setItems(seedTasks())
    setNotes(SEED_NOTES.map((s, i) => ({ ...s, id: i + 1 })))
    setLog(SEED_LOG.map((s, i) => ({ ...s, id: i + 1 })))
    logId.current = SEED_LOG.length
  }

  const backlog = items
    .filter((i) => i.section === 'backlog')
    .slice()
    .sort((a, b) => tierRank(a.priority) - tierRank(b.priority) || a.id - b.id)

  return (
    <div className="demo-grid">
      <div className="app-window">
        <div className="win-header">
          <span className="win-title">Live @ Demo</span>
          <button className="win-reset" onClick={reset} title="reset the demo">↺</button>
        </div>
        <div className="win-body">
          {/* ---- notes: content, not activity — creating one writes no log ---- */}
          <div className="surface-head">Notes</div>
          <form
            className="capture"
            onSubmit={(e) => {
              e.preventDefault()
              addNote((e.currentTarget.elements[0] as HTMLInputElement).value)
              e.currentTarget.reset()
            }}
          >
            <input placeholder="Add a note — end with !1 or #tag to mark it" aria-label="add a note" />
          </form>
          {notes.map((n) => (
            <NoteCard key={n.id} note={n} onRemove={() => removeNote(n)} />
          ))}

          {/* ---- tasks: ONE capture above the stack, ##t / ##d / ##b routes ---- */}
          <div className="surface-head tasks-head">Tasks</div>
          <form
            className="capture"
            onSubmit={(e) => {
              e.preventDefault()
              addTask((e.currentTarget.elements[0] as HTMLInputElement).value)
              e.currentTarget.reset()
            }}
          >
            <input
              placeholder="Add a task — plain for Today, ##d / ##b to route, !1 #tag @ to mark"
              aria-label="add a task"
            />
          </form>
          {SECTIONS.map((section) => (
            <section className="msection" key={section}>
              <div className="stack-head">{section}</div>
              {items
                .filter((i) => i.section === section)
                .map((item) => (
                  <Row
                    key={item.id}
                    item={item}
                    showBars
                    onToggle={() => toggle(item)}
                    onRemove={() => remove(item)}
                  />
                ))}
            </section>
          ))}
          <section className="msection">
            <div className="stack-head">backlog</div>
            {backlog.map((item, i) => {
              const prev = backlog[i - 1]
              const newTier = !prev || tierRank(prev.priority) !== tierRank(item.priority)
              return (
                <div key={item.id} className="mrow-wrap">
                  {newTier && (
                    <div className="tier-divider">
                      <Bars filled={item.priority == null ? 0 : 4 - item.priority} faint />
                    </div>
                  )}
                  <Row item={item} showBars={false} onToggle={() => toggle(item)} onRemove={() => remove(item)} />
                </div>
              )
            })}
          </section>
        </div>
      </div>

      <aside className="log-panel">
        <div className="log-head">
          actions <span>— the journal writes itself</span>
        </div>
        {log.length === 0 ? (
          <div className="log-empty">
            Every create, complete, uncomplete and delete lands here, timestamped — try the circles,
            or capture a task ending in <code>!1</code>, <code>#tag</code> or a bare <code>@</code>.
            In the real app this log is the journal, the analytics, the week in review: no separate
            journal to keep. Notes never appear here — they are content, not activity.
          </div>
        ) : (
          log.map((e) => (
            <div key={e.id} className={'log-row ' + e.tone}>
              <span className="log-verb">{e.verb}</span>
              <span className="log-text">{e.text}</span>
              <span className="log-at">{e.at}</span>
            </div>
          ))
        )}
      </aside>
    </div>
  )
}
