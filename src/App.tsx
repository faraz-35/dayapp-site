import type { ReactNode } from 'react'
import MiniDayApp from './MiniDayApp'

const GITHUB = 'https://github.com/faraz-35/dayapp'
const HERO_LINE = 'a live today list that journals itself'

const FEATURES: { label: string; title: string; body: ReactNode }[] = [
  {
    label: 'the list',
    title: 'Today · Daily · Backlog',
    body: (
      <>
        Drag between three sections. At midnight the comparisons just stop being true — unfinished
        Today falls to Backlog, daily habits reset, done rows retire. One idempotent sweep on
        launch; no cron anywhere.
      </>
    ),
  },
  {
    label: 'the journal',
    title: 'The log writes itself',
    body: (
      <>
        Every create, complete, move and edit appends to one timestamped log — that log{' '}
        <em>is</em> the journal. &ldquo;What did I do this week?&rdquo; is a SELECT.
      </>
    ),
  },
  {
    label: 'typed metadata',
    title: '!1 · #tag · @',
    body: (
      <>
        Type the axes right in the capture line: <code>!1</code> renders signal bars, <code>#tag</code>{' '}
        a stable color label, a bare <code>@</code> marks the task fully delegable. No popovers, no
        forms.
      </>
    ),
  },
  {
    label: 'identity',
    title: 'Goals, three horizons',
    body: (
      <>
        Timeless · long · short — statements of direction above the list, giving the daily{' '}
        <em>why</em> over the <em>when</em>. Achievements are kept, never swept.
      </>
    ),
  },
  {
    label: 'notes + journal',
    title: '##j · ##q — a typed bus',
    body: (
      <>
        Free-form notes with the same token grammar, per-note find and .txt export. The capture bar
        is also a bus: <code>##j</code> saves a line of reflection to the journal, <code>##q</code>{' '}
        a quote for the quiet fullscreen moment.
      </>
    ),
  },
  {
    label: 'time',
    title: 'One honest timer',
    body: (
      <>
        ▶/⏸ write open/close timestamps — the open row <em>is</em> the running timer, no separate
        state. Survives restarts, surfaces as a per-row cumulative and the day ledger's total.
      </>
    ),
  },
  {
    label: 'analytics',
    title: 'Synthesis, not bookkeeping',
    body: (
      <>
        Done, streak, missed habits, a month heatmap, project &amp; priority splits and a
        click-through day ledger — derived from write-time snapshots, so reassigning a task never
        rewrites the past.
      </>
    ),
  },
  {
    label: 'delegation',
    title: 'Agents as first-class users',
    body: (
      <>
        A bare <code>@</code> puts a row in the agent's queue; the task's details are the prompt.
        The CLI prints the 🤖 list, and a remote session can claim, work and complete tasks over
        SSH.
      </>
    ),
  },
  {
    label: 'everywhere',
    title: 'CLI + phone mirror',
    body: (
      <>
        The same binary is a headless client — <code>--list</code>, <code>--journal</code>,{' '}
        <code>--complete</code> over SSH. An Android mirror renders the list and feeds a capture
        inbox; the Mac stays the single writer.
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

export default function App() {
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
            <a className="btn-primary" href={GITHUB}>
              View the source ↗
            </a>
            <a className="btn-ghost" href="#watch">
              Watch the demo ↓
            </a>
          </div>
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
        title="One minute, the whole idea"
        sub={
          <>
            Filmed entirely inside the app's built-in <em>demo mode</em> — a disposable seeded
            database for showing DayApp to other people without ever exposing your real list.
          </>
        }
      >
        <video className="reel" controls preload="metadata" poster="/assets/poster-short.jpg" playsInline>
          <source src="/assets/demo-dayapp-short.mp4" type="video/mp4" />
        </video>
        <details className="full-tour">
          <summary>Prefer the full 5:42 tour? Capture, timers, notes, journal, goals, analytics, delegation — all of it.</summary>
          <video className="reel" controls preload="none" poster="/assets/poster-full.jpg" playsInline>
            <source src="/assets/demo-dayapp.mp4" type="video/mp4" />
          </video>
        </details>
        <div className="shots">
          <img src="/assets/demo-list.png" alt="DayApp's three sections — Today, Daily, Backlog with priority tiers" loading="lazy" />
          <img src="/assets/demo-notes.png" alt="Goals and notes above the three task sections" loading="lazy" />
        </div>
        <p className="shots-caption">
          The default window is 480&nbsp;px; it fullscreens happily. Everything above runs on the
          seeded demo data.
        </p>
      </Section>

      {/* ---------- features ---------- */}
      <Section
        eyebrow="what's inside"
        title="Small surface, deep model"
        sub={
          <>
            Every feature hangs off the same spine: state, plus a log that writes itself. Nothing
            here needs a background job — that constraint shaped all of it.
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
          <a className="btn-primary" href={GITHUB}>
            github.com/faraz-35/dayapp ↗
          </a>
        </div>
      </Section>

      {/* ---------- footer ---------- */}
      <footer className="wrap footer">
        <span>
          DayApp · built by Faraz Shah · <a href={GITHUB}>source</a>
        </span>
        <span className="footer-line">the log is the journal</span>
      </footer>
    </>
  )
}
