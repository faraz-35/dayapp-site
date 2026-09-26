/* Journal ¶ and Quotes ❝ — the written word's two pages over `entries`, one
   component parameterized by kind. Days newest-first, entries in capture
   order, single-click edits inline, hover reveals ×. The capture at the top
   is the bus with a default: plain lines land as this page's kind, the
   opposite token routes. */

import { useEffect, useMemo, useRef, useState } from 'react'
import { fmtDay, parseEntryCapture, todayISO, type EntryRow } from './model'

export default function DemoEntries({ kind, entries, onAdd, onEdit, onDelete }: {
  kind: 'journal' | 'quote'
  entries: EntryRow[]
  onAdd(kind: 'journal' | 'quote', text: string): void
  onEdit(id: number, text: string): void
  onDelete(id: number): void
}) {
  const mine = useMemo(() =>
    entries.filter((e) => e.kind === kind).sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : a.ts - b.ts)),
    [entries, kind])

  const days: Array<{ day: string; rows: EntryRow[] }> = []
  for (const e of mine) {
    const last = days[days.length - 1]
    if (last && last.day === e.day) last.rows.push(e)
    else days.push({ day: e.day, rows: [e] })
  }

  return (
    <div className="entry-page">
      <CaptureBar kind={kind} onAdd={onAdd} />
      {days.length === 0 && (
        <div className="entry-empty">
          Nothing here yet. Capture a line above{kind === 'journal' ? ' — or type ##j anywhere in the notes bar' : ''}.
        </div>
      )}
      {days.map((d) => (
        <div key={d.day}>
          <div className="entry-day">{d.day === todayISO() ? 'Today' : fmtDay(d.day)}</div>
          {d.rows.map((e) => (
            <EntryRowView key={e.id} entry={e} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      ))}
    </div>
  )
}

function CaptureBar({ kind, onAdd }: {
  kind: 'journal' | 'quote'
  onAdd(kind: 'journal' | 'quote', text: string): void
}) {
  const [val, setVal] = useState('')
  const submit = () => {
    const parsed = parseEntryCapture(val)
    if (!parsed.text) return
    // plain lines land as this page's kind; the opposite token routes
    onAdd(parsed.kind ?? kind, parsed.text)
    setVal('')
  }
  return (
    <form className="capture" onSubmit={(e) => { e.preventDefault(); submit() }}>
      <input
        value={val}
        placeholder={kind === 'journal' ? 'Write a journal line' : 'Add a quote'}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
      />
    </form>
  )
}

function EntryRowView({ entry, onEdit, onDelete }: {
  entry: EntryRow
  onEdit(id: number, text: string): void
  onDelete(id: number): void
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(entry.text)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (editing) {
      ref.current?.focus()
      ref.current?.setSelectionRange(val.length, val.length)
    }
  }, [editing]) // eslint-disable-line react-hooks/exhaustive-deps

  const commit = () => {
    if (val.trim() && val !== entry.text) onEdit(entry.id, val)
    else setVal(entry.text)
    setEditing(false)
  }

  return (
    <div className="entry-row">
      {editing ? (
        <input
          ref={ref}
          className="item-edit"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit() }
            if (e.key === 'Escape') { setVal(entry.text); setEditing(false) }
          }}
        />
      ) : (
        <>
          <span className="entry-text" onClick={() => setEditing(true)}>{entry.text}</span>
          <button className="item-action danger" title="Delete" onClick={onDelete.bind(null, entry.id)}>×</button>
        </>
      )}
    </div>
  )
}
