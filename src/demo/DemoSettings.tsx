/* The demo's settings page (⌘P → Open Settings, or the gear) — the app's
   SettingsView structure at demo scope: a tab bar picks one pane at a time
   (Features / Appearance / Header / Views). Features lays the Tasks / Notes
   surface cards side by side, each carrying its existence master as the card
   title's own switch with the sub-features beneath (the demo has no Goals
   layer); a sub-row dims inert while its master is off, and the Header rows
   need their features. Appearance is one look card — the two resting fills
   over the theme ladder. Views holds the demo's one lens, Focus, as a card
   with an Active/Enter state. A theme pick dresses the window only; the page
   around it answers to the nav toggle. Mouse-first like the analytics page:
   no grammar wiring, free-mode scrolling works. */

import { useState } from 'react'
import { THEMES, type ThemeColors } from '../themes'

export type FeatureKey =
  | 'tasks' | 'today' | 'daily' | 'backlog' | 'timer' | 'reminders'
  | 'taskProjects' | 'taskHide' | 'dailyPause' | 'taskDetails' | 'taskPriorities' | 'agent'
  | 'notes' | 'noteProjects' | 'notePriorities' | 'noteHide' | 'noteDownload'
  | 'journal' | 'quotes'

export type HeaderBtn = 'palette' | 'hidden' | 'analytics' | 'journal' | 'quotes' | 'settings' | 'theme'

export type Features = Record<FeatureKey, boolean>
export type HeaderBtns = Record<HeaderBtn, boolean>

// The three surface cards; the demo has no Goals layer.
const FEATURE_GROUPS = [
  { id: 'tasks', title: 'Tasks' },
  { id: 'notes', title: 'Notes' },
] as const

const FEATURES: { key: FeatureKey; label: string; hint: string; group: (typeof FEATURE_GROUPS)[number]['id'] }[] = [
  { key: 'tasks', label: 'Tasks', hint: 'the whole surface — capture + all three sections', group: 'tasks' },
  { key: 'today', label: 'Today', hint: 'section', group: 'tasks' },
  { key: 'daily', label: 'Daily', hint: 'section', group: 'tasks' },
  { key: 'backlog', label: 'Backlog', hint: 'section', group: 'tasks' },
  { key: 'timer', label: 'Timer', hint: 'per-task time tracking (▶ / ⏱)', group: 'tasks' },
  { key: 'reminders', label: 'Reminders', hint: 'the ◷ date that pulls a row to Today', group: 'tasks' },
  { key: 'taskProjects', label: 'Task projects', hint: 'the #tag axis + the row’s label', group: 'tasks' },
  { key: 'taskHide', label: 'Task hide', hint: 'soft-archive Today + Backlog rows (◐)', group: 'tasks' },
  { key: 'dailyPause', label: 'Pause daily tasks', hint: 'the ◐ pause on Daily habits — auto-resumes at its date', group: 'tasks' },
  { key: 'taskDetails', label: 'Task details', hint: 'the ⋯ spec body under a task', group: 'tasks' },
  { key: 'taskPriorities', label: 'Task priorities', hint: 'the !1–!3 tiers + signal bars', group: 'tasks' },
  { key: 'agent', label: 'Agent delegation', hint: 'the @ axis — 🤖 badge + the agent queue', group: 'tasks' },
  { key: 'notes', label: 'Notes', hint: 'the notepad surface', group: 'notes' },
  { key: 'noteProjects', label: 'Note projects', hint: 'the #tag footer token + the collapsed label', group: 'notes' },
  { key: 'notePriorities', label: 'Note priorities', hint: 'the !N footer tiers on notes', group: 'notes' },
  { key: 'noteHide', label: 'Note hide', hint: 'soft-archive notes (◐)', group: 'notes' },
  { key: 'noteDownload', label: 'Note download', hint: 'the ⬇ .txt export on notes', group: 'notes' },
  { key: 'journal', label: 'Journal', hint: '##j entries + the page — survives Notes off', group: 'notes' },
  { key: 'quotes', label: 'Quotes', hint: '##q entries + the page — survives Notes off', group: 'notes' },
]

// Rows whose switch is pointless while their card's master (or a tighter
// gate) is off — the row goes inert and its hint says why. Journal/Quotes
// never dim: they ride the Notes card but outlive it.
const GATED_BY: Partial<Record<FeatureKey, FeatureKey>> = {
  today: 'tasks',
  daily: 'tasks',
  backlog: 'tasks',
  timer: 'tasks',
  reminders: 'tasks',
  taskProjects: 'tasks',
  taskHide: 'tasks',
  taskDetails: 'tasks',
  taskPriorities: 'tasks',
  agent: 'tasks',
  dailyPause: 'daily',
  noteProjects: 'notes',
  notePriorities: 'notes',
  noteHide: 'notes',
  noteDownload: 'notes',
}

// `need` lists the features the button reads — the row goes inert only when
// ALL of them are off. Array order is both the card's row order and the
// window header's cluster order.
const HEADER_BUTTONS: { key: HeaderBtn; label: string; hint: string; need?: FeatureKey[] }[] = [
  { key: 'palette', label: 'Command palette', hint: '⌘ on macOS, the prompt field elsewhere — the mouse door for ⌘P' },
  { key: 'hidden', label: 'Hidden entries', hint: 'the ◐ archive peek', need: ['taskHide', 'dailyPause', 'noteHide'] },
  { key: 'analytics', label: 'Analytics', hint: 'the chart icon' },
  { key: 'journal', label: 'Journal', hint: 'the prose icon', need: ['journal'] },
  { key: 'quotes', label: 'Quotes', hint: 'the quote icon', need: ['quotes'] },
  { key: 'settings', label: 'Settings', hint: 'the gear icon' },
  { key: 'theme', label: 'Theme cycle', hint: 'the moon/sun icon' },
]

// The panes, in tab order — Features holds the surface cards, the rest are
// single cards.
const TABS = [
  { id: 'features', label: 'Features' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'header', label: 'Header' },
  { id: 'views', label: 'Views' },
] as const
type Tab = (typeof TABS)[number]['id']

// The strip's shade order — the app's editor ladder, so a theme reads at a
// glance the same way here as in the app.
const COLOR_KEYS: (keyof ThemeColors)[] = [
  'bg', 'bgElev', 'bgSoft', 'bgHover', 'border', 'text', 'textDim', 'textFaint', 'accent', 'done', 'danger',
]

/** A switch row: the whole row is the click target; the switch is its state.
 *  `needs` dims the row inert while that feature is off, and the hint says
 *  why — the same gates the demo applies when rendering, visible at the
 *  control. */
function ToggleRow({ label, hint, on, needs, needsLabel, onToggle }: {
  label: string
  hint: string
  on: boolean
  needs?: boolean
  needsLabel?: string
  onToggle(): void
}) {
  return (
    <div
      className={'set-row' + (needs ? ' dep' : '')}
      role="switch"
      aria-checked={on}
      aria-disabled={needs || undefined}
      onClick={needs ? undefined : onToggle}
    >
      <span className="set-row-text">
        <span className="set-name">{label}</span>
        <span className="set-hint">{needs ? `needs ${needsLabel} — off above` : hint}</span>
      </span>
      <span className={'set-sw' + (on ? ' on' : '')} />
    </div>
  )
}

/** A plain row: label over hint, anything at the right (a Seg, a swatch). */
function InfoRow({ label, hint, children }: {
  label: string
  hint: string
  children?: React.ReactNode
}) {
  return (
    <div className="set-row">
      <span className="set-row-text">
        <span className="set-name">{label}</span>
        <span className="set-hint">{hint}</span>
      </span>
      {children}
    </div>
  )
}

/** Segmented control — exclusive choices in one hairline box. */
function Seg({ value, options, onPick }: {
  value: string
  options: { v: string; label: string }[]
  onPick(v: string): void
}) {
  return (
    <span className="set-seg" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.v}
          role="radio"
          aria-checked={o.v === value}
          className={o.v === value ? 'on' : ''}
          onClick={(e) => { e.stopPropagation(); onPick(o.v) }}
        >{o.label}</button>
      ))}
    </span>
  )
}

/** A card — the analytics card language. A surface card passes `master`:
 *  its existence switch rides the title line itself — the whole line is the
 *  click target, the box is the state — and no separate master row renders
 *  beneath. */
function Group({ title, count, master, children }: {
  title: string
  count?: string
  master?: { on: boolean; hint: string; onToggle(): void }
  children?: React.ReactNode
}) {
  return (
    <section className="an-card">
      <div
        className={'an-card-title' + (master ? ' toggable' : '')}
        role={master ? 'switch' : undefined}
        aria-checked={master?.on}
        title={master?.hint}
        onClick={master?.onToggle}
      >
        {title}
        {count && <span className="set-count">{count}</span>}
        {master && <span className={'set-sw' + (master.on ? ' on' : '')} />}
      </div>
      {children}
    </section>
  )
}

export default function DemoSettings({ features, onToggleFeature, notesCard, tasksCard, onSetCard, headerBtns, onToggleHeaderBtn, themeId, onSetTheme, focusMode, onToggleFocusMode }: {
  features: Features
  onToggleFeature(key: FeatureKey): void
  notesCard: boolean
  tasksCard: boolean
  onSetCard(surface: 'notes' | 'tasks', card: boolean): void
  headerBtns: HeaderBtns
  onToggleHeaderBtn(btn: HeaderBtn): void
  themeId: string
  onSetTheme(id: string): void
  focusMode: boolean
  onToggleFocusMode(): void
}) {
  const [tab, setTab] = useState<Tab>('features')
  const shown = HEADER_BUTTONS.filter((b) => headerBtns[b.key] && !(b.need && b.need.every((k) => !features[k]))).length

  // Features: the surface cards side by side, the master riding each title.
  const featuresPane = (
    <div className="set-grid3">
      {FEATURE_GROUPS.map((g) => {
        const rows = FEATURES.filter((f) => f.group === g.id && f.key !== g.id)
        const master = FEATURES.find((f) => f.key === g.id)!
        return (
          <Group
            key={g.id}
            title={g.title}
            master={{ on: features[g.id], hint: master.hint, onToggle: () => onToggleFeature(g.id) }}
          >
            <div className="set-rows">
              {rows.map(({ key, label, hint }) => {
                const gate = GATED_BY[key]
                return (
                  <ToggleRow
                    key={key}
                    label={label}
                    hint={hint}
                    on={features[key]}
                    needs={gate && !features[gate] ? true : undefined}
                    needsLabel={gate ? FEATURES.find((f) => f.key === gate)?.label : undefined}
                    onToggle={() => onToggleFeature(key)}
                  />
                )
              })}
            </div>
          </Group>
        )
      })}
    </div>
  )

  // Appearance: one look card — the resting fills, then themes as ladder
  // cards (the eleven shades in editor order).
  const appearancePane = (
    <Group title="Appearance">
      <div className="set-rows">
        {([['notes', 'Notes background', 'the fill behind each note'],
           ['tasks', 'Tasks background', 'the fill behind each row']] as const).map(
          ([key, label, hint]) => {
            const card = key === 'notes' ? notesCard : tasksCard
            return (
              <InfoRow key={key} label={label} hint={hint}>
                <span className={'set-swatch' + (card ? ' filled' : ' empty')} />
                <Seg
                  value={card ? 'card' : 'bare'}
                  options={[{ v: 'card', label: 'Card' }, { v: 'bare', label: 'Bare' }]}
                  onPick={(v) => onSetCard(key, v === 'card')}
                />
              </InfoRow>
            )
          },
        )}
      </div>
      <div className="set-theme-grid">
        {THEMES.map((t) => {
          const active = themeId === t.id
          return (
            <div
              key={t.id}
              role="button"
              aria-pressed={active}
              className={'set-theme-card' + (active ? ' on' : '')}
              onClick={() => onSetTheme(t.id)}
            >
              <span className="set-strip">
                {COLOR_KEYS.map((k) => (
                  <i key={k} style={{ background: t.colors[k] }} />
                ))}
              </span>
              <span className="set-theme-foot">
                <span className="set-theme-name">{t.name}</span>
                {active && <span className="set-state on">Active</span>}
              </span>
            </div>
          )
        })}
      </div>
    </Group>
  )

  // Header: which icon buttons mount top-left of the window. Off hides only
  // the button; the view stays in ⌘P (the two-layers rule). A button whose
  // feature is off dims inert, like every dependent row.
  const headerPane = (
    <Group
      title="Header"
      count={`${shown} of ${HEADER_BUTTONS.length} shown`}
    >
      <div className="set-rows">
        {HEADER_BUTTONS.map(({ key, label, hint, need }) => (
          <ToggleRow
            key={key}
            label={label}
            hint={hint}
            on={headerBtns[key]}
            needs={need && need.every((k) => !features[k]) ? true : undefined}
            needsLabel={need ? need.map((k) => FEATURES.find((f) => f.key === k)?.label).join(' or ') : undefined}
            onToggle={() => onToggleHeaderBtn(key)}
          />
        ))}
      </div>
    </Group>
  )

  // Views: the demo's one lens as a card — Active/Enter, the same contract
  // as the app's view cards (composes, never mutates; the palette's
  // Enter/Exit Focus Mode is the same state).
  const viewsPane = (
    <Group title="Views">
      <div className="set-views">
        <div
          role="button"
          aria-pressed={focusMode}
          className={'set-view-card' + (focusMode ? ' on' : '')}
          onClick={onToggleFocusMode}
        >
          <span className="set-view-text">
            <span className="set-view-name">Focus</span>
            <span className="set-view-sum">P1 notes · Today · Daily · P1 backlog</span>
          </span>
          <span className={'set-state' + (focusMode ? ' on' : '')}>{focusMode ? 'Active' : 'Enter'}</span>
        </div>
      </div>
    </Group>
  )

  return (
    <div className="settings">
      <div className="settings-tabs" role="tablist" aria-label="Settings sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'on' : ''}
            onClick={() => setTab(t.id)}
          >{t.label}</button>
        ))}
      </div>
      {tab === 'features' && featuresPane}
      {tab === 'appearance' && appearancePane}
      {tab === 'header' && headerPane}
      {tab === 'views' && viewsPane}
    </div>
  )
}
