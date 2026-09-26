/* The two floating surfaces: the ⌘P command palette (a filter over the
   entries DemoApp builds) and the ⌘F search modal (tasks, or the # project /
   @ agent pickers on a leading character). Both follow the app's modal
   language — fixed backdrop, centered card, ↑/↓ + Enter. */

import { useEffect, useMemo, useRef, useState } from 'react'
import { tierRank, type Item, type Project } from './model'

export interface PaletteEntry {
  label: string
  hint: string
  run(): void
}

export function DemoPalette({ entries, onClose }: {
  entries: PaletteEntry[]
  onClose(): void
}) {
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => inputRef.current?.focus(), [])

  const filtered = entries.filter((e) => e.label.toLowerCase().includes(q.trim().toLowerCase()))
  const h = Math.min(hi, Math.max(filtered.length - 1, 0))

  return (
    <div className="palette-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="palette">
        <input
          ref={inputRef}
          className="palette-input"
          value={q}
          placeholder="Type a command…"
          onChange={(e) => { setQ(e.target.value); setHi(0) }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHi(Math.min(h + 1, filtered.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(Math.max(h - 1, 0)) }
            else if (e.key === 'Enter') { e.preventDefault(); filtered[h]?.run(); onClose() }
            else if (e.key === 'Escape') onClose()
          }}
        />
        <div className="palette-list">
          {filtered.length === 0 && <div className="palette-empty">No command matches.</div>}
          {filtered.map((e, i) => (
            <button
              key={e.label}
              className={'palette-row' + (i === h ? ' active' : '')}
              onMouseEnter={() => setHi(i)}
              onMouseDown={(ev) => { ev.preventDefault(); e.run(); onClose() }}
            >
              <span className="palette-label">{e.label}</span>
              {e.hint && <span className="palette-hint">{e.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

type SearchMode =
  | { kind: 'tasks' }
  | { kind: 'projects' }
  | { kind: 'agent' }

export function DemoSearch({ items, projects, onClose, onPickTask, onPickProject, onPickAgent }: {
  items: Item[]
  projects: Project[]
  onClose(): void
  onPickTask(id: number): void
  onPickProject(id: number | null): void
  onPickAgent(v: 'agent' | 'my'): void
}) {
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => inputRef.current?.focus(), [])

  const mode: SearchMode = q.startsWith('#') ? { kind: 'projects' } : q.startsWith('@') ? { kind: 'agent' } : { kind: 'tasks' }
  const rest = mode.kind === 'tasks' ? q : q.slice(1).trim().toLowerCase()

  const rows = useMemo(() => {
    if (mode.kind === 'projects') {
      const list = projects
        .filter((p) => !rest || p.name.toLowerCase().includes(rest))
        .map((p) => ({ key: `p${p.id}`, label: p.name, hint: `${items.filter((i) => i.projectId === p.id).length} tasks`, run: () => onPickProject(p.id) }))
      return rest ? list : [{ key: 'p-none', label: 'No project', hint: 'unfiled tasks', run: () => onPickProject(null) }, ...list]
    }
    if (mode.kind === 'agent') {
      return [
        { key: 'a1', label: '🤖 Agent tasks', hint: 'delegated, end to end', run: () => onPickAgent('agent') },
        { key: 'a2', label: 'My tasks', hint: 'everything unmarked', run: () => onPickAgent('my') },
      ].filter((r) => !rest || r.label.toLowerCase().includes(rest))
    }
    const n = q.trim().toLowerCase()
    if (!n) return []
    return items
      .filter((i) => i.text.toLowerCase().includes(n.slice(0, 40)))
      .sort((a, b) => tierRank(a.priority) - tierRank(b.priority))
      .slice(0, 12)
      .map((i) => ({ key: `t${i.id}`, label: i.text, hint: i.section, run: () => onPickTask(i.id) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, items, projects, mode.kind])

  const h = Math.min(hi, Math.max(rows.length - 1, 0))
  const placeholder = mode.kind === 'projects'
    ? 'Pick a project to filter the list…'
    : mode.kind === 'agent'
      ? 'Whose tasks?'
      : 'Search tasks — # flips to projects, @ to agent tasks'

  return (
    <div className="palette-backdrop search-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="palette">
        <input
          ref={inputRef}
          className="palette-input"
          value={q}
          placeholder={placeholder}
          onChange={(e) => { setQ(e.target.value); setHi(0) }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHi(Math.min(h + 1, rows.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(Math.max(h - 1, 0)) }
            else if (e.key === 'Enter') { e.preventDefault(); rows[h]?.run(); onClose() }
            else if (e.key === 'Escape') onClose()
          }}
        />
        <div className="palette-list">
          {rows.length === 0 && (
            <div className="palette-empty">
              {mode.kind === 'tasks' ? 'Type to search the task list.' : 'Nothing matches.'}
            </div>
          )}
          {rows.map((r, i) => (
            <button
              key={r.key}
              className={'palette-row' + (i === h ? ' active' : '')}
              onMouseEnter={() => setHi(i)}
              onMouseDown={(ev) => { ev.preventDefault(); r.run(); onClose() }}
            >
              <span className="palette-label">{r.label}</span>
              {r.hint && <span className="palette-hint">{r.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
