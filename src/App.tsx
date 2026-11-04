import { lazy, Suspense, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Analytics } from '@vercel/analytics/react'
import { MoonIcon, SunIcon, themeIsLight, toggleLight, useTheme } from './themes'

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
const INSTALL_CMD_MAC = 'curl -fsSL https://getdayapp.vercel.app/install.sh | sh'
// The Windows installer under a version-proof name. release.yml uploads this
// stable-named copy beside the versioned one; the link survives every bump.
const WIN_SETUP_URL =
  'https://github.com/faraz-35/dayapp/releases/latest/download/DayApp-setup.exe'
const BUILD_CMD = [
  'git clone https://github.com/faraz-35/dayapp.git',
  'cd dayapp && npm install',
  'npm run tauri build',
].join('\n')
const SITE_TITLE = 'DayApp — a hyper-minimal tasks, notes and goals superapp'

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

function ChevronIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <polyline points="4.5 6.25 8 9.75 11.5 6.25" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function StarIcon({ size = 13 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
      <path d="M8 1.5 L9.6 5.8 L14.2 6 L10.6 8.8 L11.8 13.3 L8 10.7 L4.2 13.3 L5.4 8.8 L1.8 6 L6.4 5.8 Z" fill="currentColor" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
      <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
      <path d="M3.6 3.6l8.8 8.8M12.4 3.6l-8.8 8.8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path d="M8 2.5v7.6M4.7 7l3.3 3.3L11.3 7M3 13.5h10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
      <circle cx="7" cy="7" r="4.3" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="m10.3 10.3 3 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 16 16" width="19" height="19" aria-hidden="true">
      <path d="M8 1.7 13 3.5v3.9c0 3.2-2 5.5-5 6.9-3-1.4-5-3.7-5-6.9V3.5Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M8 5v3.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="10.4" r="0.9" fill="currentColor" />
    </svg>
  )
}

// The three window-control glyphs on the drawn Windows dialog's title bar.
function WinChrome() {
  return (
    <span className="dl-win-chrome" aria-hidden="true">
      <svg viewBox="0 0 10 10" width="10" height="10"><path d="M1.5 5h7" stroke="currentColor" strokeWidth="1.1" /></svg>
      <svg viewBox="0 0 10 10" width="10" height="10"><rect x="1.8" y="1.8" width="6.4" height="6.4" fill="none" stroke="currentColor" strokeWidth="1.1" /></svg>
      <svg viewBox="0 0 10 10" width="10" height="10"><path d="m2 2 6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.1" /></svg>
    </span>
  )
}

// The repo's live star count — one fetch, module-cached, shared by the Star
// button. null until it lands (or forever when the API is rate-limited or
// unreachable; the count segment just never renders).
const STARS_PROMISE: Promise<number | null> =
  fetch('https://api.github.com/repos/faraz-35/dayapp')
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (j && typeof j.stargazers_count === 'number' ? j.stargazers_count : null))
    .catch(() => null)

function useGitHubStars(): number | null {
  const [stars, setStars] = useState<number | null>(null)
  useEffect(() => { STARS_PROMISE.then(setStars) }, [])
  return stars
}

// The repo's star CTA. GitHub lets no site star a repo in-place — the star
// needs the visitor's GitHub login, so every star button on every static
// site is a link to the repo underneath (the iframe buttons too; their
// "Star" is an <a> to the repo). This one does the same thing in the site's
// own look, with the live count beside the verb.
function StarButton() {
  const stars = useGitHubStars()
  return (
    // new tab — the visitor leaves the pitch page for GitHub and should come
    // back to it, not lose it
    <a className="btn-star" href={GITHUB} target="_blank" rel="noopener noreferrer" title="Star DayApp on GitHub">
      {stars != null && (
        <span className="star-count"><StarIcon /><span>{stars}</span></span>
      )}
      <span className="star-label">
        {stars == null && <StarIcon />} Star on GitHub
      </span>
    </a>
  )
}

// A terminal block with a corner copy button. The button copies `copy` (the
// raw commands — display lines may carry comments the clipboard shouldn't),
// flips to a check for a beat, and owns its own state so several boxes on
// one page never desync.
function CodeBox({ copy, children }: {
  copy: string
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
      <div className="terminal">{children}</div>
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

// ---- download flow ---------------------------------------------------------
// The non-developer's install door, and the hero's only install surface. One
// accent button under the headline; clicking it opens the steps modal. On
// Windows the click really downloads the installer and the modal walks
// through four plain steps, including a clickable drawing of the SmartScreen
// dialog (clicking More info reveals Run anyway — the exact two clicks the
// real dialog asks for). On macOS/Linux the button keeps its honest verb
// ("Install on…") and the modal teaches Terminal itself, because a
// browser-downloaded Mac app hits the "damaged" dialog with no escape — the
// copyable one-liner lives inside the modal. The depicted OS chrome is drawn
// with its own fixed colors on purpose: it is a picture of a window, not
// site chrome. Everything around it rides the tokens.

type DlOS = 'windows' | 'macos' | 'linux'

const OS_NAMES: Record<DlOS, string> = { windows: 'Windows', macos: 'macOS', linux: 'Linux' }

function detectOS(): DlOS {
  const ua = navigator.userAgent
  if (/windows/i.test(ua)) return 'windows'
  if (/mac/i.test(ua)) return 'macos'
  if (/linux/i.test(ua)) return 'linux'
  return 'macos'
}

// The drawn Terminal window — the picture of what success looks like after
// the paste: the installer's output and the green check. The copyable
// command itself lives in the real CodeBox beside it.
function TermFig({ out }: { out: string }) {
  return (
    <div className="dl-term">
      <div className="dl-term-bar">
        <span className="dl-dot r" /><span className="dl-dot y" /><span className="dl-dot g" />
        <span className="dl-term-title">Terminal</span>
      </div>
      <pre className="dl-term-body">
        {'  downloading DayApp … done\n  '}{out}
        <span className="dl-ok"> ✓</span>
      </pre>
    </div>
  )
}

// The steps modal — floats over the whole page (backdrop click, Esc, or the
// × all close it; the page scroll locks underneath). It portals to <body>:
// the hero's .fx entrance animation keeps a transform on its subtree even at
// rest, and a transform ancestor makes position:fixed size to that ancestor —
// the modal would be a 200px strip instead of full-screen. Its platform tabs
// are reading state — a Mac visitor may peek at the Windows steps without the
// button underneath changing its mind about their machine — so the tab lives
// here, seeded from the detected OS. The head (title, tabs, ×) stays pinned
// while the steps scroll under it.
function DlModal({ initialTab, onClose }: { initialTab: DlOS; onClose: () => void }) {
  const [tab, setTab] = useState<DlOS>(initialTab)
  const [ss, setSs] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])
  return createPortal(
    <div className="dl-modal" onClick={onClose}>
      <div
        className="dl-modal-card"
        role="dialog"
        aria-modal="true"
        aria-label="Install DayApp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dl-card-head">
          <div className="dl-title">Install DayApp on {OS_NAMES[tab]}</div>
          <div className="install-tabs" role="tablist" aria-label="instructions platform">
            {(Object.keys(OS_NAMES) as DlOS[]).map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                className={'install-tab' + (tab === k ? ' active' : '')}
                onClick={() => setTab(k)}
              >
                {OS_NAMES[k]}
              </button>
            ))}
          </div>
          <button className="dl-modal-close" onClick={onClose} title="Close" aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className="dl-modal-body">
      {tab === 'windows' && (
        <div className="dl-panel" role="tabpanel">
          <div className="dl-step">
            <div className="dl-num">1</div>
            <div className="dl-body">
              <div className="dl-step-title">Wait for the download to finish</div>
              <p>DayApp-setup.exe lands in your Downloads folder.</p>
              <div className="dl-fig">
                <div className="dl-filepill"><DownloadIcon /><span>DayApp-setup.exe</span><span className="dl-ok"><CheckIcon /></span></div>
              </div>
            </div>
          </div>
          <div className="dl-step">
            <div className="dl-num">2</div>
            <div className="dl-body">
              <div className="dl-step-title">Double-click the file</div>
              <p>Find it in Downloads, or straight in your browser’s download bar. The setup wizard has nothing to configure — just click <b>Install</b>.</p>
              <div className="dl-fig">
                <div className="dl-win">
                  <div className="dl-win-bar"><span>DayApp Setup</span><WinChrome /></div>
                  <div className="dl-win-body">
                    <div className="dl-win-h">Welcome to DayApp Setup</div>
                    <p>Everything is set up for you — no options to choose.</p>
                    <div className="dl-win-actions"><span className="dl-graybtn">Close</span><span className="dl-bluebtn">Install</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="dl-step">
            <div className="dl-num">3</div>
            <div className="dl-body">
              <div className="dl-step-title">If a blue warning appears — that’s normal</div>
              <p>DayApp doesn’t have a paid security certificate yet, so Windows asks before running any new app. Two clicks and you’re through:</p>
              <div className="dl-fig">
                <div className="dl-ss">
                  <div className="dl-ss-head"><ShieldIcon />Windows protected your PC</div>
                  <p className="dl-ss-body">Microsoft Defender SmartScreen prevented an unrecognized app from starting. Running this app might put your PC at risk.</p>
                  <div className="dl-ss-actions">
                    {ss ? (
                      <span className="dl-runany">Run anyway</span>
                    ) : (
                      <button className="dl-ss-more" onClick={() => setSs(true)}>More info</button>
                    )}
                    <span className="dl-ss-gray">Don’t run</span>
                  </div>
                </div>
                <div className="dl-figcap">
                  {ss
                    ? <>Now <span className="dl-hot">Run anyway</span> lights up — click it, and DayApp installs.</>
                    : <>Click <b>More info</b> in the dialog above — try it.</>}
                </div>
              </div>
            </div>
          </div>
          <div className="dl-step">
            <div className="dl-num">4</div>
            <div className="dl-body">
              <div className="dl-step-title">Done — DayApp opens</div>
              <p>Next time, find it in your Start menu.</p>
              <div className="dl-fig">
                <div className="dl-appdone"><span className="dl-apptile">d</span><span>DayApp</span><CheckIcon /></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'macos' && (
        <div className="dl-panel" role="tabpanel">
          <div className="dl-step">
            <div className="dl-num">1</div>
            <div className="dl-body">
              <div className="dl-step-title">Open Terminal</div>
              <p>Press <b>⌘-Space</b>, type <b>Terminal</b>, press <b>Enter</b>.</p>
              <div className="dl-fig">
                <div className="dl-spot">
                  <div className="dl-spot-bar"><SearchIcon /><span>Terminal</span><span className="dl-caret" /></div>
                  <div className="dl-spot-row"><span className="dl-term-ic">&gt;_</span><span>Terminal</span><span className="dl-spot-kind">Application</span></div>
                </div>
              </div>
            </div>
          </div>
          <div className="dl-step">
            <div className="dl-num">2</div>
            <div className="dl-body">
              <div className="dl-step-title">Paste one line, press Enter</div>
              <p>Copy this, paste it into the Terminal window, press Enter. It downloads DayApp and puts it in Applications.</p>
              <CodeBox copy={INSTALL_CMD_MAC}>
                <div className="tline"><span className="tp">$</span> {INSTALL_CMD_MAC}</div>
              </CodeBox>
              <div className="dl-fig"><TermFig out="DayApp is in Applications." /></div>
            </div>
          </div>
          <p className="dl-why">Why a command instead of a download? Apple shows Mac apps without a paid certificate a “damaged” warning that can’t be clicked through — the command installs cleanly and avoids it.</p>
        </div>
      )}

      {tab === 'linux' && (
        <div className="dl-panel" role="tabpanel">
          <div className="dl-step">
            <div className="dl-num">1</div>
            <div className="dl-body">
              <div className="dl-step-title">Paste one line in a terminal</div>
              <p>Open a terminal (Ctrl-Alt-T on Ubuntu), paste this, press Enter.</p>
              <CodeBox copy={INSTALL_CMD_MAC}>
                <div className="tline"><span className="tp">$</span> {INSTALL_CMD_MAC}</div>
              </CodeBox>
              <div className="dl-fig"><TermFig out="DayApp installed." /></div>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

// One flow: the accent button, the saved bubble after a Windows download,
// and the steps modal floating over the page. Mounted in the hero and at
// #code — each instance keeps its own open state. The button speaks the
// visitor's detected machine for the flow's whole life; only the modal's
// reading tabs move.
function DownloadFlow() {
  const [os] = useState<DlOS>(detectOS)
  const [open, setOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [saved, setSaved] = useState(false)

  const isWin = os === 'windows'
  const go = () => {
    setOpen(true)
    if (!isWin || downloading) return
    setDownloading(true)
    const a = document.createElement('a')
    a.href = WIN_SETUP_URL
    a.click()
    setTimeout(() => {
      setDownloading(false)
      setSaved(true)
    }, 900)
  }

  return (
    <div className="dl-flow">
      <button className="dl-btn" onClick={go} disabled={downloading}>
        <DownloadIcon />
        {downloading
          ? 'Downloading DayApp-setup.exe…'
          : isWin ? 'Download for Windows' : `Install on ${OS_NAMES[os]}`}
      </button>
      {saved && (
        <div className="dl-bubble" aria-live="polite">
          <CheckIcon /><b>DayApp-setup.exe</b><span>saved to your Downloads folder</span>
        </div>
      )}
      {open && <DlModal initialTab={os} onClose={() => setOpen(false)} />}
    </div>
  )
}

const NAV: [string, string][] = [
  ['Demos', '#watch'],
  ['Features', '#inside'],
  ['Keybindings', '#keyboard'],
  ['GitHub', '#code'],
]

// The nav: the logo (the app's own icon), the section links, the theme
// toggle. Under 640px the links fold into the hamburger's sheet.
function SiteNav() {
  const theme = useTheme()
  const [menu, setMenu] = useState(false)
  return (
    <nav className="site-nav">
      <div className="site-nav-inner">
        <a className="site-nav-brand" href="#top" aria-label="DayApp">
          <img src="/assets/logo.svg" alt="" />
        </a>
        <div className="site-nav-right">
          <div className="site-nav-links">
            {NAV.map(([label, href]) => (
              <a key={href} href={href}>{label}</a>
            ))}
          </div>
          <button
            className="nav-btn"
            onClick={toggleLight}
            title={themeIsLight(theme) ? 'Switch to dark mode' : 'Switch to light mode'}
            aria-label="Toggle light mode"
          >
            {themeIsLight(theme) ? <SunIcon /> : <MoonIcon />}
          </button>
          <button
            className="nav-btn nav-menu-btn"
            onClick={() => setMenu(!menu)}
            title={menu ? 'Close menu' : 'Menu'}
            aria-label={menu ? 'Close menu' : 'Open menu'}
            aria-expanded={menu}
          >
            {menu ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>
      {menu && (
        <>
          <div className="nav-sheet-backdrop" onClick={() => setMenu(false)} />
          <div className="nav-sheet">
            {NAV.map(([label, href]) => (
              <a key={href} href={href} onClick={() => setMenu(false)}>{label}</a>
            ))}
          </div>
        </>
      )}
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
    label: 'goals',
    title: 'Goals, not just tasks',
    body: 'Write down where you’re headed — short term, long term, or timeless. Goals sit at the top of the app, so your daily list always has its why.',
  },
  {
    label: 'analytics',
    title: 'See what you did',
    body: 'An analytics page shows what you completed last week or last month, your streak, missed habits, and where your time went.',
  },
  {
    label: 'journal',
    title: 'A one-line journal',
    body: (
      <>
        Type <code>##j</code> before a line in the notes bar and it’s saved as a journal entry with
        its date. The Journal page keeps every entry so you can read them back later.
      </>
    ),
  },
  {
    label: 'settings',
    title: 'Make it yours',
    body: 'Every feature is a switch in Settings — timer, journal, priorities, themes. The app starts minimal, and you turn on only what you use.',
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
        Apple Silicon Macs, and Linux on x86_64 — the one-line install detects your platform and
        downloads the right build. On Linux it needs the WebKit runtime (webkit2gtk-4.1); the
        installer prints the exact command if it is missing. The macOS app is not signed with a
        paid Apple certificate. The install downloads it in a way that skips the security dialog.
        If you download the .dmg from GitHub Releases instead, the first launch may ask you to
        allow it in System Settings → Privacy &amp; Security. The source is public — check it
        before you trust it; that is what open source is for.
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
  const [allKeys, setAllKeys] = useState(false)
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
          <h1 className="fx d1">A hyper-minimal tasks, notes and goals superapp</h1>
          <div className="fx d2 hero-install">
            <DownloadFlow />
            <StarButton />
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
      <Section id="inside" title="Features">
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
      <Section id="keyboard" title="Keybindings">
        <div className={allKeys ? 'kb-card' : 'kb-card kb-cut'}>
          {KEYS.map(([keys, what], i) => (
            <div className="kb-row" key={keys} hidden={!allKeys && i >= 5}>
              <span className="kb-keys">{keys}</span>
              <span className="kb-what">{what}</span>
            </div>
          ))}
        </div>
        <button
          className={allKeys ? 'kb-more open' : 'kb-more'}
          onClick={() => setAllKeys(!allKeys)}
          aria-expanded={allKeys}
          aria-label={allKeys ? 'Show fewer keybindings' : 'Show all keybindings'}
        >
          <ChevronIcon />
        </button>
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
          <StarButton />
          <a className="btn-ghost" href={GITHUB}>
            github.com/faraz-35/dayapp ↗
          </a>
        </div>
        <div className="dl-code-cta">
          <DownloadFlow />
        </div>
      </Section>

      {/* ---------- footer ---------- */}
      <Footer />
      <Analytics />
    </>
  )
}
