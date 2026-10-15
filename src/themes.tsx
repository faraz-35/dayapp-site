// The site's theme system — the app's model ported whole: a theme is the
// token ladder re-valued, applyTheme writes the custom properties onto an
// element, and everything under it re-skins in one paint. Two scopes: the
// page's theme (the nav toggle's, persisted, system-defaulted) and the demo
// window's own (its Settings → Appearance + cycle button, session-only).
//
// A theme carries eleven color shades. The derived values — the accent's
// rgb triplet, the nav's translucent bg, the scrims, the shadows, the
// terminal fill — are computed from those eleven and never stored, so a
// theme is eleven colors and nothing else. Dark is the site's shipped
// ladder; Light, Nord and Rosé Pine are the app's own themes verbatim.

import { useSyncExternalStore } from 'react'

export interface ThemeColors {
  bg: string
  bgSoft: string
  bgElev: string
  bgHover: string
  border: string
  text: string
  textDim: string
  textFaint: string
  accent: string
  done: string
  danger: string
}

export interface Theme {
  id: string
  name: string
  colors: ThemeColors
}

const DARK: Theme = {
  id: 'dark',
  name: 'Dark',
  colors: {
    bg: '#0e0f11',
    bgSoft: '#121316',
    bgElev: '#16181c',
    bgHover: '#1c1f24',
    border: '#23262d',
    text: '#e6e7ea',
    textDim: '#8a8f98',
    textFaint: '#5c6068',
    accent: '#7b8cff',
    done: '#3a3f48',
    danger: '#e5484d',
  },
}

const LIGHT: Theme = {
  id: 'light',
  name: 'Light',
  colors: {
    bg: '#f7f7f8',
    bgSoft: '#f0f0f2',
    bgElev: '#ffffff',
    bgHover: '#e9e9ed',
    border: '#d9dade',
    text: '#212327',
    textDim: '#5d6167',
    textFaint: '#90949b',
    accent: '#5061f5',
    done: '#b3b7bf',
    danger: '#d7383f',
  },
}

// The app's own custom themes (settings.json, verbatim).
const NORD: Theme = {
  id: 'nord',
  name: 'Nord',
  colors: {
    bg: '#2e3440',
    bgSoft: '#353b48',
    bgElev: '#3b4252',
    bgHover: '#434c5e',
    border: '#4c566a',
    text: '#eceff4',
    textDim: '#b9c2cc',
    textFaint: '#8f98a8',
    accent: '#88c0d0',
    done: '#4c566a',
    danger: '#bf616a',
  },
}

const ROSE_PINE: Theme = {
  id: 'rose-pine',
  name: 'Rosé Pine',
  colors: {
    bg: '#191724',
    bgSoft: '#1c1b26',
    bgElev: '#1f1d2e',
    bgHover: '#26233a',
    border: '#403d52',
    text: '#e0def4',
    textDim: '#908caa',
    textFaint: '#6e6a86',
    accent: '#ebbcba',
    done: '#403d52',
    danger: '#eb6f92',
  },
}

// Editor/ladder order — Settings renders the shades in this order and the
// header's cycle button walks it.
export const THEMES: Theme[] = [DARK, LIGHT, NORD, ROSE_PINE]

// ---- Mode ------------------------------------------------------------------

// Relative luminance (WCAG). Only a light/dark read — the scrims, shadows
// and the toggle's sun/moon glyph just need to know which side of the
// divide a color is on.
function luminance(hex: string): number {
  const m = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// Day skins wear the sun, night skins the moon — the same divide the
// scrims and shadows ride below.
export function themeIsLight(theme: Theme): boolean {
  return luminance(theme.colors.bg) > 0.5
}

// The active theme's slot within its own mode's ladder — the cycle button's
// subscript, shown only while the mode holds more than one theme.
export function themeModeSlot(theme: Theme, all: Theme[]): { index: number; count: number } {
  const same = all.filter((t) => themeIsLight(t) === themeIsLight(theme))
  return { index: same.findIndex((t) => t.id === theme.id) + 1, count: same.length }
}

// ---- Application -----------------------------------------------------------

function rgbTriple(hex: string): string {
  const m = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16)).join(', ')
}

// Writes the ladder + the derived layer onto `root` — the document element
// for the page's theme, the demo window's own element for its
// session-scoped one (custom properties inherit; the window overrides).
export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement) {
  const c = theme.colors
  const r = root.style
  r.setProperty('--bg', c.bg)
  r.setProperty('--bg-soft', c.bgSoft)
  r.setProperty('--bg-elev', c.bgElev)
  r.setProperty('--bg-hover', c.bgHover)
  r.setProperty('--border', c.border)
  r.setProperty('--text', c.text)
  r.setProperty('--text-dim', c.textDim)
  r.setProperty('--text-faint', c.textFaint)
  r.setProperty('--accent', c.accent)
  r.setProperty('--done', c.done)
  r.setProperty('--danger', c.danger)
  // the derived layer — computed from the eleven, never stored
  r.setProperty('--accent-rgb', rgbTriple(c.accent))
  r.setProperty('--bg-rgb', rgbTriple(c.bg))
  r.setProperty('--on-accent', luminance(c.accent) > 0.5 ? '#0e0f11' : '#ffffff')
  const light = themeIsLight(theme)
  r.setProperty('--scrim', light ? 'rgba(15, 18, 24, 0.3)' : 'rgba(0, 0, 0, 0.4)')
  r.setProperty('--track', light ? 'rgba(22, 25, 31, 0.08)' : 'rgba(255, 255, 255, 0.05)')
  r.setProperty('--terminal', light ? '#eef0f3' : '#0b0c0e')
  r.setProperty('--border-strong', light ? '#c4c7cf' : '#2e323b')
  r.setProperty('--project-l', light ? '40%' : '68%')
  r.setProperty(
    '--shadow-win',
    light ? '0 24px 70px rgba(25, 30, 40, 0.16)' : '0 24px 70px rgba(0, 0, 0, 0.5)',
  )
  r.setProperty(
    '--shadow-pop',
    light ? '0 16px 48px rgba(25, 30, 40, 0.2)' : '0 16px 48px rgba(0, 0, 0, 0.6)',
  )
  r.setProperty(
    '--shadow-menu',
    light ? '0 8px 24px rgba(25, 30, 40, 0.16)' : '0 8px 24px rgba(0, 0, 0, 0.5)',
  )
  r.setProperty('color-scheme', light ? 'light' : 'dark')
  if (root === document.documentElement) {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', c.bg)
  }
}

// ---- Store -----------------------------------------------------------------
// One theme for the page — the nav toggle writes it, every reader
// subscribes. The demo window keeps its own session-scoped copy (its
// settings govern the window, never the page). With no stored choice the
// page follows the system; an explicit pick wins from then on.

const KEY = 'dayapp-site-theme'

function systemTheme(): Theme {
  return matchMedia('(prefers-color-scheme: light)').matches ? LIGHT : DARK
}

// The demo window's default: the system's answer at mount.
export function systemThemeId(): string {
  return systemTheme().id
}

export function themeById(id: string | null): Theme {
  return (id && THEMES.find((t) => t.id === id)) || systemTheme()
}

let current: Theme = themeById(localStorage.getItem(KEY))
const listeners = new Set<() => void>()

// System flips reach the page only while it still follows the system — an
// explicit pick is a decision the OS doesn't override.
matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
  if (localStorage.getItem(KEY)) return
  current = systemTheme()
  applyTheme(current)
  listeners.forEach((cb) => cb())
})

export function useTheme(): Theme {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
  )
}

export function activateTheme(id: string) {
  current = themeById(id)
  localStorage.setItem(KEY, current.id)
  applyTheme(current)
  listeners.forEach((cb) => cb())
}

// Called once before render: first paint already wears the effective theme.
export function initTheme() {
  applyTheme(current)
}

// The nav toggle's one job: cross the mode divide. The full ladder lives in
// the demo's Appearance card and the window's cycle button.
export function toggleLight() {
  activateTheme(themeIsLight(current) ? 'dark' : 'light')
}

// ---- Glyphs ----------------------------------------------------------------
// The theme doors' two faces, the app's icon family (16-box, 1.7 stroke,
// round caps): night wears the moon, day the sun.

export function MoonIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        d="M13.2 9.3A5.6 5.6 0 1 1 6.7 2.8a4.4 4.4 0 0 0 6.5 6.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function SunIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <circle cx="8" cy="8" r="2.7" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M8 1.7v1.8M8 12.5v1.8M1.7 8h1.8M12.5 8h1.8M3.6 3.6l1.3 1.3M11.1 11.1l1.3 1.3M12.4 3.6l-1.3 1.3M4.9 11.1l-1.3 1.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}
