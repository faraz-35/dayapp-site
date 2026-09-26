import { lazy, Suspense, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Analytics } from '@vercel/analytics/react'

// The demo ships as its own chunk — the landing page never parses or
// executes it on the critical path; the skeleton holds the window's height
// for the few ms until the chunk lands.
const MiniDayApp = lazy(() => import('./demo/DemoApp'))

function DemoSkeleton() {
  return (
    <div className="app-window demo-skeleton">
      <div className="win-header"><span className="win-title">Live @ Demo</span></div>
      <div className="win-body" />
    </div>
  )
}

const GITHUB = 'https://github.com/faraz-35/dayapp'
const INSTALL_CMD = 'curl -fsSL https://getdayapp.vercel.app/install.sh | sh'
const BUILD_CMD = [
  'git clone https://github.com/faraz-35/dayapp.git',
  'cd dayapp && npm install',
  'npm run tauri build',
].join('\n')
const SITE_TITLE = 'DayApp — a to-do list and notes app that journals itself'

function CopyIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M10 3H4.5A1.5 1.5 0 0 0 3 4.5V10" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="m3.2 8.6 3.2 3.2 6.4-7.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// A terminal block with a corner copy button. The button copies `copy` (the
// raw commands — display lines may carry comments the clipboard shouldn't),
// flips to a check for a beat, and owns its own state so several boxes on
// one page never desync.
function CodeBox({ copy, snug, children }: {
  copy: string
  snug?: boolean
  children: ReactNode
}) {
  const [copied, setCopied] = useState(false)
  const doCopy = () => {
    navigator.clipboard?.writeText(copy).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    }).catch(() => {})
  }
  return (
    <div className="codewrap">
      <div className={snug ? 'terminal snug' : 'terminal'}>{children}</div>
      <button
        className={copied ? 'copy-btn copied' : 'copy-btn'}
        onClick={doCopy}
        title="Copy"
        aria-label="Copy command"
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </div>
  )
}

const NAV: [string, string][] = [
  ['Demos', '#watch'],
  ['Features', '#inside'],
  ['Keybindings', '#keyboard'],
  ['GitHub', '#code'],
]

function SiteNav() {
  return (
    <nav className="site-nav">
      <div className="site-nav-inner">
        <a className="site-nav-brand" href="#top">DayApp</a>
        <div className="site-nav-links">
          {NAV.map(([label, href]) => (
            <a key={href} href={href}>{label}</a>
          ))}
        </div>
      </div>
    </nav>
  )
}

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
  ['⌘P', 'open the command palette — every toggle, view and action'],
  ['⌘F', 'search tasks; type # for projects, @ for agent tasks'],
  ['nn', 'focus the notes capture'],
  ['nt', 'focus the task capture — the task lands in Today'],
  ['nd', 'focus the task capture — the task lands in Daily'],
  ['nb', 'focus the task capture — the task lands in Backlog'],
  ['t1–9', 'jump to a Today task — digits 1–6 then act on it'],
  ['d1–9', 'jump to a Daily task'],
  ['b11–49', 'jump to a Backlog task'],
  ['n11–49', 'jump to a note'],
  ['e', 'edit the focused thing'],
  ['Enter', 'complete the focused task'],
  ['Esc', 'step back — close the open menu or edit, then clear the focus'],
  ['j / k', 'move down / up the rows — or scroll when nothing is focused'],
]

function Section({ id, title, sub, children }: {
  id?: string
  title: string
  sub?: ReactNode
  children: ReactNode
}) {
  return (
    <section id={id} className="wrap section">
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

type Route = 'home' | 'privacy' | 'terms'

function routeOf(): Route {
  if (location.hash.startsWith('#/privacy')) return 'privacy'
  if (location.hash.startsWith('#/terms')) return 'terms'
  return 'home'
}

function useRoute(): Route {
  const [route, setRoute] = useState<Route>(routeOf)
  useEffect(() => {
    let current = routeOf()
    const onHash = () => {
      const next = routeOf()
      if (next !== current) {
        current = next
        setRoute(next)
        window.scrollTo(0, 0)
      }
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return route
}

function Footer() {
  return (
    <footer className="wrap footer">
      <span>
        DayApp · built by <a href="https://faraz-35.vercel.app">Faraz Shah</a>
      </span>
      <span>
        <a href="#/privacy">privacy</a> · <a href="#/terms">terms</a>
      </span>
    </footer>
  )
}

function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="legal wrap">
      <a className="legal-back" href="#/">
        ← Back to DayApp
      </a>
      <h1>{title}</h1>
      {children}
    </div>
  )
}

function PrivacyPage() {
  return (
    <LegalPage title="Privacy">
      <p>DayApp is a local Mac app. This page says what it stores and what it sends.</p>

      <h3>The app</h3>
      <ul>
        <li>
          Everything stays on your Mac, in one SQLite file:{' '}
          <code>~/Library/Application Support/com.farazshah.dayapp/dayapp.db</code>
        </li>
        <li>No accounts, no telemetry, no crash reporting. The app makes no network requests on its own.</li>
        <li>
          The one exception is mobile sync, which is off until you turn it on. It reads and writes
          two files in a GitHub repo you choose, with a token you create. Requests go straight from
          your Mac to GitHub. There is no server of mine in between, because there is no server of
          mine.
        </li>
        <li>
          If something breaks, the log stays on your disk under{' '}
          <code>~/Library/Logs/com.farazshah.dayapp/</code>
        </li>
      </ul>

      <h3>This website</h3>
      <ul>
        <li>
          The site is static files on Vercel. It counts anonymous page visits with Vercel Analytics:
          no cookies, no ads, no cross-site tracking.
        </li>
        <li>
          The one-line install is a static script on this site. It downloads the app from GitHub
          Releases; nothing is collected on the way.
        </li>
      </ul>

      <h3>Contact</h3>
      <p>
        Questions about any of this: open an issue at <a href={GITHUB}>github.com/faraz-35/dayapp</a>{' '}
        or reach me through <a href="https://faraz-35.vercel.app">faraz-35.vercel.app</a>.
      </p>
    </LegalPage>
  )
}

function TermsPage() {
  return (
    <LegalPage title="Terms">
      <p>
        DayApp is free, open-source software under the MIT license. Here is what that means in
        plain words.
      </p>

      <h3>License</h3>
      <p>
        You can use, study, change and share DayApp freely. The full text is the{' '}
        <a href={`${GITHUB}/blob/main/LICENSE`}>LICENSE file</a> in the repo. The software is
        provided “as is”, without warranty of any kind. Its author is not liable for anything that
        goes wrong.
      </p>

      <h3>Your data</h3>
      <p>
        Everything lives in one file on your Mac. The app has a built-in backup command (command
        palette → Backups), but it only makes a copy when you ask. Keep backups of anything you
        would hate to lose.
      </p>

      <h3>Requirements</h3>
      <p>
        Apple Silicon Macs. The app is not signed with a paid Apple certificate. The one-line
        install downloads it in a way that skips the security dialog. If you download the .dmg from
        GitHub Releases instead, the first launch may ask you to allow it in System Settings →
        Privacy &amp; Security. The source is public — check it before you trust it; that is what
        open source is for.
      </p>

      <h3>Mobile sync</h3>
      <p>
        When you turn it on, you connect your own GitHub account and repo. GitHub&apos;s terms
        apply to that traffic.
      </p>

      <h3>Changes</h3>
      <p>If these terms change, the new version appears on this page.</p>
    </LegalPage>
  )
}

export default function App() {
  const [mediaTab, setMediaTab] = useState<MediaTab>('notes')
  const route = useRoute()

  useEffect(() => {
    document.title = route === 'home' ? SITE_TITLE : `${route === 'privacy' ? 'Privacy' : 'Terms'} · DayApp`
  }, [route])

  if (route === 'privacy') {
    return (
      <>
        <PrivacyPage />
        <Footer />
        <Analytics />
      </>
    )
  }

  if (route === 'terms') {
    return (
      <>
        <TermsPage />
        <Footer />
        <Analytics />
      </>
    )
  }

  return (
    <>
      {/* ---------- hero: one line, one screen ---------- */}
      <SiteNav />
      <header className="hero" id="top">
        <div className="hero-inner">
          <div className="fx wordmark">DayApp</div>
          <h1 className="fx d1">
            The most <span className="brace">{'{'}</span> Simple &amp; Powerful{' '}
            <span className="brace">{'}'}</span> Notes &amp; To-do app
          </h1>
          <div className="fx d2 hero-line">Notes · Tasks · Journal · Timers · Analytics</div>
          <div className="fx d2 hero-install">
            <div className="tlabel">Install with one simple command</div>
            <CodeBox snug copy={INSTALL_CMD}>
              <div className="tline"><span className="tp">$</span> {INSTALL_CMD}</div>
            </CodeBox>
          </div>
        </div>
      </header>

      {/* ---------- live demo: the second screen, full width ---------- */}
      <section className="demo-section">
        <div className="wrap">
          <h2>Interactive demo</h2>
          <Suspense fallback={<DemoSkeleton />}>
            <MiniDayApp />
          </Suspense>
        </div>
      </section>

      {/* ---------- videos ---------- */}
      <Section
        id="watch"
        title="Watch it work"
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
      <Section id="inside" title="What's inside">
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
      <Section id="keyboard" title="Keyboard-first">
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
      <Section id="code" title="GitHub">
        <CodeBox copy={BUILD_CMD}>
          <div className="tline"><span className="tp">$</span> git clone {GITHUB}.git</div>
          <div className="tline"><span className="tp">$</span> cd dayapp &amp;&amp; npm install</div>
          <div className="tline">
            <span className="tp">$</span> npm run tauri build<span className="tc">   # → DayApp.app</span>
          </div>
        </CodeBox>
        <div className="cta-row center">
          <a className="btn-ghost" href={GITHUB}>
            github.com/faraz-35/dayapp ↗
          </a>
        </div>
      </Section>

      {/* ---------- footer ---------- */}
      <Footer />
      <Analytics />
    </>
  )
}
