# dayapp-site

The landing page for [DayApp](https://github.com/faraz-35/dayapp) — a Vite + React + TS static
site in DayApp's own design tokens (always dark, one accent, serif-italic brand moments).

The hero's mini-DayApp is live React state: completing and capturing tasks writes a visible
`actions` log — the product's thesis, demonstrated.

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build   # typecheck + → dist/
```

## Deploy

The site is static; it deploys to Vercel zero-config (`vercel --prod` from this directory, or
import the repo on vercel.com). Media under `public/assets/` (demo reels + screenshots) is
copied from the DayApp repo — regenerate posters with ffmpeg if the reels are re-cut.
