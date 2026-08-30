import { useState } from 'react'
import type { ReactNode } from 'react'
import MiniDayApp from './MiniDayApp'

const GITHUB = 'https://github.com/faraz-35/dayapp'
const RELEASE = 'https://github.com/faraz-35/dayapp/releases/tag/v0.1.2'
const DMG_URL =
  'https://github.com/faraz-35/dayapp/releases/download/v0.1.2/DayApp_0.1.2_aarch64.dmg'
const HERO_LINE = 'a live today list that journals itself'

const FEATURES: { label: string; title: string; body: ReactNode }[] = [
  {
    label: 'the list',
    title: 'Today · Daily · Backlog',
    body: (
      <>
        Drag tasks between three sections. At midnight the unfinished Today tasks drop into the
        Backlog, daily habits reset, and finished rows disappear. No scheduler does this. The app
        checks the date whenever it draws the list.
      </>
    ),
  },
  {
    label: 'the journal',
    title: 'The log writes itself',
    body: (
      <>
        Every task you add, finish, or move is written down with its time. That record{' '}
        <em>is</em> the journal; you never write it yourself. &ldquo;What did I do this week?&rdquo;{' '}
        is one query.
      </>
    ),
  },
  {
    label: 'typed metadata',
    title: '!1 · #tag · @',
    body: (
      <>
        Details go in the task line as you type: <code>!1</code> sets a priority, <code>#tag</code>{' '}
        files it under a project, <code>@</code> marks it for your agent. There are no menus to
        open; the line you typed is the whole input.
      </>
    ),
  },
  {
    label: 'identity',
    title: 'Goals, three horizons',
    body: (
      <>
        Goals sit above the list: timeless, long term, short term. They are the reason the daily
        work happens. Achieve one and it is kept, dated with the month you hit it, not deleted.
      </>
    ),
  },
  {
    label: 'notes + journal',
    title: '##j and ##q',
    body: (
      <>
        Free-form notes with per-note search and a .txt export. The notes box also takes two{' '}
        shortcuts: <code>##j</code> saves a line of reflection to the journal, <code>##q</code>{' '}
        saves a quote the app will show you later.
      </>
    ),
  },
  {
    label: 'time',
    title: 'One honest timer',
    body: (
      <>
        One timer runs at a time. Press ▶ to start it, ⏸ to stop it, and the app totals the time
        per task and per day. Quit mid-task and the clock picks up where it left off on the next
        launch.
      </>
    ),
  },
  {
    label: 'analytics',
    title: 'The week in review',
    body: (
      <>
        A page of answers: what you finished, your streak, missed habits, a month heatmap, and
        time split by project and priority. Change a task's project later and its history stays
        exactly as it was.
      </>
    ),
  },
  {
    label: 'delegation',
    title: 'Hand work to an agent',
    body: (
      <>
        A task marked <code>@</code> goes into the agent queue, and the task's own notes are its
        instructions. From a terminal, an AI session can claim a task, do the work, and check it
        off over SSH.
      </>
    ),
  },
  {
    label: 'everywhere',
    title: 'Terminal and phone',
    body: (
      <>
        The same binary is also a terminal client: <code>--list</code>, <code>--complete</code>,{' '}
        <code>--journal</code> over SSH. An Android app mirrors the list and sends quick captures
        back to the Mac, which stays the only place that writes.
      </>
    ),
  },
]

const KEYS: [string, string][] = [
  ['⌘P', 'the command palette — every toggle, view and action'],
  ['⌘F', 'search; a leading # flips to projects, @ to the agent filter'],
  ['nn · nt · nd · nb', 'focus the capture field of any section'],
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
      {/* ---------- hero ---------- */}
      <header className="hero">
        <div className="wrap hero-inner">
          <div className="fx d0 wordmark">DayApp</div>
          <h1 className="fx d1">{HERO_LINE}</h1>
          <p className="fx d2 hero-sub">
            A native macOS daily-action tool where the timestamped action log <em>is</em> the
            journal — for free. One accent, one window, one SQLite file.
            <br />
            No cron · no cloud · no accounts. Open source on GitHub.
          </p>
          <div className="fx d3 cta-row">
            <a className="btn-primary" href={DMG_URL}>
              Download for Mac ↧
            </a>
            <a className="btn-ghost" href={GITHUB}>
              View the source ↗
            </a>
            <a className="btn-ghost" href="#watch">
              Watch the demo ↓
            </a>
          </div>
          <p className="fx d4 cta-note">
            v0.1.2 · Apple Silicon · unsigned build. On first launch, right-click the app and
            choose Open. <a href={RELEASE}>Release notes</a>
          </p>
        </div>
      </header>

      {/* ---------- live demo ---------- */}
      <Section
        eyebrow="live, in your browser"
        title="Don't read about it — use it"
        sub={
          <>
            This is real React state, not a video. Complete the circles, capture a task, watch the
            log on the right write the journal for you. <code>↺</code> resets the demo.
          </>
        }
      >
        <MiniDayApp />
      </Section>

      {/* ---------- the thesis ---------- */}
      <div className="quote-band">
        <p>
          Several behaviours that sound like features
          <br />
          are just queries over timestamped state.
        </p>
        <span>daily resets · the midnight sweep · reminders · the week in review — none of it is scheduled; all of it is derived</span>
      </div>

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
      <Section
        eyebrow="what's inside"
        title="Everything reads one log"
        sub={
          <>
            Every feature below writes to or reads from the same timestamped record. You use the
            app, it takes the notes; there is no configuration and no background process. The rest
            is questions you can ask.
          </>
        }
      >
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
        sub={
          <>
            One thing is focused at a time; addresses are typed directly and digits act on whatever
            is focused — no modes, no menus. Drag-and-drop exists; <code>j</code>/<code>k</code>,{' '}
            <code>Enter</code> and <code>e</code> are just faster.
          </>
        }
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
        sub={
          <>
            There's no team, no telemetry, no roadmap committee — the app you build from source is
            the app that runs every day. Your data is one SQLite file you can open, query, and
            snapshot. Fork it, steal the ideas, or build your day around it.
          </>
        }
      >
        <div className="terminal">
          <div className="tline"><span className="tp">$</span> git clone {GITHUB}.git</div>
          <div className="tline"><span className="tp">$</span> cd dayapp &&amp; npm install</div>
          <div className="tline">
            <span className="tp">$</span> npm run tauri build<span className="tc">   # → DayApp.app</span>
          </div>
        </div>
        <div className="cta-row center">
          <a className="btn-primary" href={DMG_URL}>
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
    </>
  )
}
