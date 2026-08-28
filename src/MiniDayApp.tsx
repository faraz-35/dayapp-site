import { useRef, useState } from 'react'

/* A working miniature of DayApp, in the browser. Real state, real mutations,
   and a live "actions" log beside it — the product's whole thesis (every
   mutation writes itself into a timestamped log) demonstrated instead of
   described. */

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

// the app's token grammar: trailing !N / #tag / bare @ , composable, in any order
function parseCapture(raw: string): { text: string; priority: Priority; project: string | null; agent: boolean } {
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

// the demo.sql persona: a founder/builder's day
const SEED: Omit<Item, 'id'>[] = [
  { text: 'Ship the landing page', section: 'today', done: false, priority: 1, project: 'growth', agent: false },
  { text: 'Reply to the intro email', section: 'today', done: false, priority: null, project: null, agent: false },
  { text: 'Read 20 pages', section: 'daily', done: true, priority: null, project: null, agent: false },
  { text: 'Ship one small thing', section: 'daily', done: false, priority: 2, project: null, agent: false },
  { text: 'Rewrite onboarding flow', section: 'backlog', done: false, priority: 2, project: 'growth', agent: false },
  { text: 'Sketch the mobile widget', section: 'backlog', done: false, priority: 3, project: null, agent: true },
  { text: 'Deep-clean the apartment', section: 'backlog', done: false, priority: null, project: null, agent: false },
]

function seed(): Item[] {
  return SEED.map((s, i) => ({ ...s, id: i + 1 }))
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

function Capture({ placeholder, onAdd }: { placeholder?: string; onAdd: (text: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <form
      className="mcapture"
      onSubmit={(e) => {
        e.preventDefault()
        onAdd(value)
        setValue('')
      }}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label="add a task"
      />
    </form>
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

export default function MiniDayApp() {
  const [items, setItems] = useState<Item[]>(seed)
  const [log, setLog] = useState<LogEntry[]>([])
  const logId = useRef(0)

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

  function add(section: Section, raw: string) {
    const { text, priority, project, agent } = parseCapture(raw)
    if (!text) return
    setItems((xs) => [...xs, { id: Date.now(), text, section, done: false, priority, project, agent }])
    record('created', text, 'create')
  }

  function reset() {
    setItems(seed())
    setLog([])
    logId.current = 0
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
          {SECTIONS.filter((s) => s !== 'backlog').map((section) => (
            <section className="msection" key={section}>
              <div className="mhead">{section}</div>
              <Capture
                placeholder={section === 'today' ? 'try: ship the pitch deck !1' : undefined}
                onAdd={(t) => add(section, t)}
              />
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
            <div className="mhead">backlog</div>
            <Capture placeholder="or: draft the launch post #growth @" onAdd={(t) => add('backlog', t)} />
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
            journal to keep.
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
