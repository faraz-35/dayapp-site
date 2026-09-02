import { useState } from 'react'
import type { ReactNode } from 'react'
import { Analytics, track } from '@vercel/analytics/react'
import MiniDayApp from './MiniDayApp'

const GITHUB = 'https://github.com/faraz-35/dayapp'
const DMG_URL =
  'https://github.com/faraz-35/dayapp/releases/download/v0.2.0/DayApp_0.2.0_aarch64.dmg'

const FEATURES: { label: string; title: string; body: ReactNode }[] = [
  {
    label: 'the list',
    title: 'Today · Daily · Backlog',
    body: 'At midnight unfinished tasks fall to the Backlog and dailies reset. No scheduler — just a date check.',
  },
  {
    label: 'the notepad',
    title: 'Notes live here too',
    body: (
      <>
        A notepad above the list. Notes take the same <code>!1</code> and <code>#tag</code> marks,
        group by priority, export as .txt.
      </>
    ),
  },
  {
    label: 'typed metadata',
    title: '!1 · #tag · @',
    body: 'Priority, project, agent — typed into the line. No menus to open.',
  },
  {
    label: 'the journal',
    title: 'The log writes itself',
    body: 'Every add, finish and move is timestamped. That record is the journal; you never write it.',
  },
  {
    label: 'time',
    title: 'One honest timer',
    body: 'One timer at a time, totaled per task and per day. It survives restarts.',
  },
  {
    label: 'analytics',
    title: 'The week in review',
    body: 'Streaks, missed habits, a month heatmap, time by project — read straight off the log.',
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
  eyebrow: string
  title: string
  sub?: ReactNode
  children: ReactNode
}) {
  return (
    <section id={id} className="wrap section">
      <div className="eyebrow">{eyebrow}</div>
      <h2>{title}</h2>
      {sub && <p className="section-sub">{sub}</p>}
      {children}
    </section>
  )
}

type MediaTab = 'short' | 'full' | 'shots'

const MEDIA_TABS: { id: MediaTab; label: string; caption: string }[] = [
  { id: 'short', label: 'Short · 1:25', caption: 'The whole idea in one sitting.' },
  {
    id: 'full',
    label: 'Full tour · 5:42',
    caption: 'Capture, timers, notes, journal, goals, analytics, delegation — everything.',
  },
  {
    id: 'shots',
    label: 'Screenshots',
    caption: 'Fullscreen in demo mode — the default window is 480 px and stretches happily.',
  },
]

export default function App() {
  const [mediaTab, setMediaTab] = useState<MediaTab>('short')

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
        title="Watch it work — pick a format"
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
        {mediaTab === 'short' && (
          <video className="reel" controls preload="metadata" poster="/assets/poster-short.jpg" playsInline>
            <source src="/assets/demo-dayapp-short.mp4" type="video/mp4" />
          </video>
        )}
        {mediaTab === 'full' && (
          <video className="reel" controls preload="metadata" poster="/assets/poster-full.jpg" playsInline>
            <source src="/assets/demo-dayapp.mp4" type="video/mp4" />
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
      <Section eyebrow="what's inside" title="Everything reads one log">
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
