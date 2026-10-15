/* The demo's settings page (⌘P → Open Settings, or the gear): what exists at
   all (Features), which icon buttons mount in the window header (Header),
   and the look (Appearance — the theme ladder over the two resting fills).
   The app's SettingsView language — group cards, real switches, theme
   ladder cards, counts in titles, section rows that go inert while Tasks is
   off — at demo scope. A theme pick dresses the window only; the page
   around it answers to the nav toggle. Mouse-first like the analytics
   page: no grammar wiring, free-mode scrolling works. */

import { THEMES, type ThemeColors } from '../themes'

export type FeatureKey = 'tasks' | 'today' | 'daily' | 'backlog' | 'notes'
export type HeaderBtn = 'journal' | 'quotes' | 'analytics' | 'settings' | 'theme'

export type Features = Record<FeatureKey, boolean>
export type HeaderBtns = Record<HeaderBtn, boolean>

const FEATURES: { key: FeatureKey; label: string; hint: string; needsTasks?: boolean }[] = [
  { key: 'tasks', label: 'Tasks', hint: 'capture + all three sections' },
  { key: 'today', label: 'Today', hint: 'section', needsTasks: true },
  { key: 'daily', label: 'Daily', hint: 'section', needsTasks: true },
  { key: 'backlog', label: 'Backlog', hint: 'section', needsTasks: true },
  { key: 'notes', label: 'Notes', hint: 'the notepad surface' },
]

const HEADER_BUTTONS: { key: HeaderBtn; label: string; hint: string }[] = [
  { key: 'journal', label: 'Journal', hint: 'the prose icon' },
  { key: 'quotes', label: 'Quotes', hint: 'the quote icon' },
  { key: 'analytics', label: 'Analytics', hint: 'the chart icon' },
  { key: 'theme', label: 'Theme cycle', hint: 'the moon/sun icon' },
  { key: 'settings', label: 'Settings', hint: 'the gear icon' },
]

// The strip's shade order — the app's editor ladder, so a theme reads at a
// glance the same way here as in the app.
const COLOR_KEYS: (keyof ThemeColors)[] = [
  'bg', 'bgElev', 'bgSoft', 'bgHover', 'border', 'text', 'textDim', 'textFaint', 'accent', 'done', 'danger',
]

function Switch({ on }: { on: boolean }) {
  return <span className={'set-sw' + (on ? ' on' : '')} />
}

/** A switch row: the whole row is the click target; the switch is its state.
 *  `dep` dims the row inert (a section row while Tasks is off) and the hint
 *  says why. */
function ToggleRow({ label, hint, on, dep, depHint, onToggle }: {
  label: string
  hint: string
  on: boolean
  dep?: boolean
  depHint?: string
  onToggle(): void
}) {
  return (
    <div
      className={'set-row' + (dep ? ' dep' : '')}
      role="switch"
      aria-checked={on}
      aria-disabled={dep || undefined}
      onClick={dep ? undefined : onToggle}
    >
      <span className="set-row-text">
        <span className="set-name">{label}</span>
        <span className="set-hint">{dep ? depHint : hint}</span>
      </span>
      <Switch on={on} />
    </div>
  )
}

export default function DemoSettings({ features, onToggleFeature, notesCard, tasksCard, onSetCard, headerBtns, onToggleHeaderBtn, themeId, onSetTheme }: {
  features: Features
  onToggleFeature(key: FeatureKey): void
  notesCard: boolean
  tasksCard: boolean
  onSetCard(surface: 'notes' | 'tasks', card: boolean): void
  headerBtns: HeaderBtns
  onToggleHeaderBtn(btn: HeaderBtn): void
  themeId: string
  onSetTheme(id: string): void
}) {
  const onCount = FEATURES.filter((f) => features[f.key]).length
  const shown = HEADER_BUTTONS.filter((b) => headerBtns[b.key]).length
  const tasksOff = !features.tasks
  return (
    <div className="settings">
      <div className="an-card">
        <div className="an-card-title">
          Features
          <span className="set-count">{onCount} of {FEATURES.length} on</span>
        </div>
        <div className="set-rows">
          {FEATURES.map(({ key, label, hint, needsTasks }) => (
            <ToggleRow
              key={key}
              label={label}
              hint={hint}
              on={features[key]}
              dep={!!needsTasks && tasksOff}
              depHint="needs Tasks — it's off in Features"
              onToggle={() => onToggleFeature(key)}
            />
          ))}
        </div>
      </div>

      <div className="an-card">
        <div className="an-card-title">
          Header
          <span className="set-count">{shown} of {HEADER_BUTTONS.length} shown</span>
        </div>
        <div className="set-rows">
          {HEADER_BUTTONS.map(({ key, label, hint }) => (
            <ToggleRow
              key={key}
              label={label}
              hint={hint}
              on={headerBtns[key]}
              onToggle={() => onToggleHeaderBtn(key)}
            />
          ))}
        </div>
      </div>

      <div className="an-card">
        <div className="an-card-title">
          Appearance
          <span className="set-count">{THEMES.length} themes</span>
        </div>
        <div className="set-rows">
          {([['notes', 'Notes background', 'the fill behind each note'],
             ['tasks', 'Tasks background', 'the fill behind each row']] as const).map(
            ([key, label, hint]) => {
              const card = key === 'notes' ? notesCard : tasksCard
              return (
                <div className="set-row" key={key}>
                  <span className="set-row-text">
                    <span className="set-name">{label}</span>
                    <span className="set-hint">{hint}</span>
                  </span>
                  <span className={'set-swatch' + (card ? ' filled' : ' empty')} />
                  <span className="set-seg" role="radiogroup" aria-label={label}>
                    <button className={card ? 'on' : ''} onClick={() => onSetCard(key, true)}>Card</button>
                    <button className={!card ? 'on' : ''} onClick={() => onSetCard(key, false)}>Bare</button>
                  </span>
                </div>
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
      </div>
    </div>
  )
}
