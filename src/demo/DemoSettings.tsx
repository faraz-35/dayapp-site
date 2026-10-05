/* The demo's settings page (⌘P → Open Settings, or the gear): what exists at
   all (Features), the resting fill behind notes and rows (UI), and which icon
   buttons mount in the window header (Header). The app's SettingsView
   language — analytics cards of rows, hover tint, On/Off at the right,
   Card/Bare pills — at demo scope. Mouse-first like the analytics page: no
   grammar wiring, free-mode scrolling works. */

export type FeatureKey = 'tasks' | 'today' | 'daily' | 'backlog' | 'notes'
export type HeaderBtn = 'journal' | 'quotes' | 'analytics' | 'settings'

export type Features = Record<FeatureKey, boolean>
export type HeaderBtns = Record<HeaderBtn, boolean>

const FEATURES: { key: FeatureKey; label: string; hint: string }[] = [
  { key: 'tasks', label: 'Tasks', hint: 'capture + all three sections' },
  { key: 'today', label: 'Today', hint: 'section' },
  { key: 'daily', label: 'Daily', hint: 'section' },
  { key: 'backlog', label: 'Backlog', hint: 'section' },
  { key: 'notes', label: 'Notes', hint: 'the notepad surface' },
]

const HEADER_BUTTONS: { key: HeaderBtn; label: string; hint: string }[] = [
  { key: 'journal', label: 'Journal', hint: 'the prose icon' },
  { key: 'quotes', label: 'Quotes', hint: 'the quote icon' },
  { key: 'analytics', label: 'Analytics', hint: 'the chart icon' },
  { key: 'settings', label: 'Settings', hint: 'the gear icon' },
]

export default function DemoSettings({ features, onToggleFeature, notesCard, tasksCard, onSetCard, headerBtns, onToggleHeaderBtn }: {
  features: Features
  onToggleFeature(key: FeatureKey): void
  notesCard: boolean
  tasksCard: boolean
  onSetCard(surface: 'notes' | 'tasks', card: boolean): void
  headerBtns: HeaderBtns
  onToggleHeaderBtn(btn: HeaderBtn): void
}) {
  return (
    <div className="settings">
      <div className="an-card">
        <div className="an-card-title">Features</div>
        <div className="settings-rows">
          {FEATURES.map(({ key, label, hint }) => (
            <div className="settings-row" key={key}>
              <button className="settings-main" onClick={() => onToggleFeature(key)}>
                <span className="settings-name">{label}</span>
                <span className="settings-hint">{hint}</span>
              </button>
              <span className={'settings-state' + (features[key] ? ' on' : '')}>
                {features[key] ? 'On' : 'Off'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="an-card">
        <div className="an-card-title">UI</div>
        <div className="settings-rows">
          {([['notes', 'Notes background', 'the soft card behind each note'],
             ['tasks', 'Tasks background', 'the soft card behind each row']] as const).map(
            ([key, label, hint]) => {
              const card = key === 'notes' ? notesCard : tasksCard
              return (
                <div className="settings-row" key={key}>
                  <div className="settings-main">
                    <span className="settings-name">{label}</span>
                    <span className="settings-hint">{hint}</span>
                  </div>
                  <button className={'pill' + (card ? ' active' : '')} onClick={() => onSetCard(key, true)}>Card</button>
                  <button className={'pill' + (!card ? ' active' : '')} onClick={() => onSetCard(key, false)}>Bare</button>
                </div>
              )
            },
          )}
        </div>
      </div>

      <div className="an-card">
        <div className="an-card-title">Header</div>
        <div className="settings-rows">
          {HEADER_BUTTONS.map(({ key, label, hint }) => (
            <div className="settings-row" key={key}>
              <button className="settings-main" onClick={() => onToggleHeaderBtn(key)}>
                <span className="settings-name">{label}</span>
                <span className="settings-hint">{hint}</span>
              </button>
              <span className={'settings-state' + (headerBtns[key] ? ' on' : '')}>
                {headerBtns[key] ? 'On' : 'Off'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
