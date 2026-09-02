import { useState } from 'react'
import type { ReactNode } from 'react'
import { Analytics, track } from '@vercel/analytics/react'
import MiniDayApp from './MiniDayApp'

const GITHUB = 'https://github.com/faraz-35/dayapp'
const DMG_URL =
  'https://github.com/faraz-35/dayapp/releases/download/v0.2.0/DayApp_0.2.0_aarch64.dmg'

const FEATURES: { label: string; title: string; body: ReactNode }[] = [
  {
    label: 'tasks',
    title: 'Today · Daily · Backlog',
    body: 'Three lists: what you’ll do today, what you do every day, and what’s saved for later. Don’t finish something? It waits in the Backlog.',
  },
  {
    label: 'notes',
    title: 'A notepad built in',
    body: (
      <>
        Keep ideas, checklists and pasted text right above your tasks — one window instead of two
        apps. Notes take the same priority and project tags as tasks.
      </>
    ),
  },
  {
    label: 'input',
    title: 'Organize as you type',
    body: (
      <>
        Type <code>!1</code> to make something high priority, <code>#work</code> to file it under a
        project, <code>@</code> to hand it to your AI agent. No menus, no forms.
      </>
    ),
  },
  {
    label: 'journal',
    title: 'The journal writes itself',
    body: 'Everything you add, finish or move is logged with its time, automatically. So “what did I do this week?” is already answered.',
  },
  {
    label: 'timer',
    title: 'A timer on every task',
    body: 'Start one to see how long things really take. Time adds up per task and per day — and it keeps running if you close the app.',
  },
  {
    label: 'analytics',
    title: 'See what you did',
    body: 'An analytics page shows what you completed last week or last month, your streak, missed habits, and where your time went.',
  },
]

const KEYS: [string, string][] = [
  ['⌘P', 'the command palette — every toggle, view and action'],
  ['⌘F', 'search; a leading # flips to projects, @ to the agent filter'],
  ['nn', 'focus the notes capture; nt · nd · nb focus the task capture, routed'],
  ['t1–9 · b41–49', 'address a row directly — digits 1–6 act on it'],
  ['e · Enter', 'edit · complete'],
  ['j / k', 'walk the rows — or scroll, when nothing is focused'],
]

function Section({ id, eyebrow, title, sub, children }: {
  id?: string
  eyebrow?: string
  title: string
  sub?: ReactNode
  children: ReactNode
}) {
  return (
    <section id={id} className="wrap section">
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h2>{title}</h2>
      {sub && <p className="section-sub">{sub}</p>}
      {children}
    </section>
  )
}

type MediaTab = 'notes' | 'tasks' | 'analytics' | 'shots'

const MEDIA_TABS: { id: MediaTab; label: string; caption: string }[] = [
  {
    id: 'notes',
    label: 'Notes · 2:01',
    caption: 'Create a note, edit it, hide it — first with the mouse, then with the keyboard.',
  },
  {
    id: 'tasks',
    label: 'Tasks · 1:59',
    caption: 'Create, time, link, complete and delete tasks — mouse first, then keys only.',
  },
  {
    id: 'analytics',
    label: 'Analytics · 0:43',
    caption: 'The week on one page — pick a day, filter by project or priority.',
  },
  {
    id: 'shots',
    label: 'Screenshots',
    caption: 'Fullscreen in demo mode — the default window is 480 px and stretches happily.',
  },
]

export default function App() {
  const [mediaTab, setMediaTab] = useState<MediaTab>('notes')

  return (
    <>
      {/* ---------- hero: one line, one screen ---------- */}
      <header className="hero">
        <div className="hero-inner">
          <div className="fx wordmark">DayApp</div>
          <h1 className="fx d1">
            The most <span className="brace">{'{'}</span> Simple &amp; Powerful{' '}
            <span className="brace">{'}'}</span> Notes &amp; To-do app
          </h1>
          <div className="fx d2 cta-row">
            <a className="btn-primary" href={DMG_URL} onClick={() => track('download_dmg')}>
              Download for Mac ↧
            </a>
            <a className="btn-ghost" href={GITHUB}>
              View the source ↗
            </a>
          </div>
          <div className="fx d3 hero-meta">Apple Silicon (M1 or later)</div>
        </div>
      </header>

      {/* ---------- live demo: the second screen, full width ---------- */}
      <section className="demo-section">
        <h2>Working demo</h2>
        <MiniDayApp />
      </section>

      {/* ---------- videos ---------- */}
      <Section
        id="watch"
        eyebrow="on film"
        title="Watch it work — pick a demo"
        sub={
          <>
            Filmed entirely inside the app's built-in <em>demo mode</em> — a disposable seeded
            database for showing DayApp to other people without ever exposing your real list.
          </>
        }
      >
        <div className="media-tabs" role="tablist" aria-label="demo format">
          {MEDIA_TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={mediaTab === t.id}
              className={'media-tab' + (mediaTab === t.id ? ' active' : '')}
              onClick={() => setMediaTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {mediaTab === 'notes' && (
          <video className="reel" controls preload="metadata" poster="/assets/poster-notes.jpg" playsInline>
            <source src="/assets/demo-notes.mp4" type="video/mp4" />
          </video>
        )}
        {mediaTab === 'tasks' && (
          <video className="reel" controls preload="metadata" poster="/assets/poster-tasks.jpg" playsInline>
            <source src="/assets/demo-tasks.mp4" type="video/mp4" />
          </video>
        )}
        {mediaTab === 'analytics' && (
          <video className="reel" controls preload="metadata" poster="/assets/poster-analytics.jpg" playsInline>
            <source src="/assets/demo-analytics.mp4" type="video/mp4" />
          </video>
        )}
        {mediaTab === 'shots' && (
          <div className="shots">
            <img src="/assets/demo-list.png" alt="DayApp's three sections — Today, Daily, Backlog with priority tiers" />
            <img src="/assets/demo-notes.png" alt="Goals and notes above the three task sections" />
          </div>
        )}
        <p className="media-caption">{MEDIA_TABS.find((t) => t.id === mediaTab)?.caption}</p>
      </Section>

      {/* ---------- features ---------- */}
      <Section title="What's inside">
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <div className="feature-card" key={f.label}>
              <div className="feature-label">{f.label}</div>
              <div className="feature-title">{f.title}</div>
              <p className="feature-body">{f.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ---------- keyboard ---------- */}
      <Section
        eyebrow="the grammar"
        title="Keyboard-first, not keyboard-everything"
        sub="One thing focused at a time; digits act on it — no modes, no menus."
      >
        <div className="kb-card">
          {KEYS.map(([keys, what]) => (
            <div className="kb-row" key={keys}>
              <span className="kb-keys">{keys}</span>
              <span className="kb-what">{what}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ---------- open source ---------- */}
      <Section
        eyebrow="built in the open"
        title="One person's daily tool, yours to fork"
        sub="No team, no telemetry. Your data is one SQLite file — open it, query it, snapshot it."
      >
        <div className="tlabel">Install with Homebrew</div>
        <div className="terminal">
          <div className="tline"><span className="tp">$</span> brew tap faraz-35/tap</div>
          <div className="tline">
            <span className="tp">$</span> brew trust faraz-35/tap
            <span className="tc">   # one-time — Homebrew 6 only runs trusted taps</span>
          </div>
          <div className="tline"><span className="tp">$</span> brew install --cask dayapp</div>
        </div>

        <div className="tlabel">Or build from source</div>
        <div className="terminal">
          <div className="tline"><span className="tp">$</span> git clone {GITHUB}.git</div>
          <div className="tline"><span className="tp">$</span> cd dayapp &&amp; npm install</div>
          <div className="tline">
            <span className="tp">$</span> npm run tauri build<span className="tc">   # → DayApp.app</span>
          </div>
        </div>
        <div className="cta-row center">
          <a className="btn-primary" href={DMG_URL} onClick={() => track('download_dmg')}>
            Download .dmg ↧
          </a>
          <a className="btn-ghost" href={GITHUB}>
            github.com/faraz-35/dayapp ↗
          </a>
        </div>
        <p className="install-note">
          Installing from the .dmg above: the first open may warn that the app “can’t be verified” —
          it isn’t signed with a paid Apple developer certificate. Allow it in System Settings →
          Privacy &amp; Security → Open Anyway. Homebrew installs skip this.
        </p>
      </Section>

      {/* ---------- footer ---------- */}
      <footer className="wrap footer">
        <span>
          DayApp · built by Faraz Shah · MIT · <a href={GITHUB}>source</a>
        </span>
        <span className="footer-line">the log is the journal</span>
      </footer>
      <Analytics />
    </>
  )
}
