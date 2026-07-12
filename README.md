# Dashy

Personal task and project management workspace. Responsive dashboard, keyboard-first search and quick capture, persistent client-side CRUD, and a Prisma schema for the full relational database model.

## Features

- Dashboard with reorderable pinned work, urgent/overdue signals, and a persistent focus timer
- Tasks grouped by Overdue / Today / Upcoming / No date / Completed, with one-click complete
- Command palette (`Ctrl+K`) that runs commands (new item, timer, focus mode, theme, lock, navigation) and searches items
- Quick capture (`Ctrl+Shift+Space`) with Zod-validated input
- Undo for delete and archive
- Settings: theme, app lock, JSON backup export/import, clear-data danger zone
- Installable PWA: add Dashy to your phone home screen or install it as a desktop app, with offline support for the app shell

## Install

Dashy is a Progressive Web App, so it can be installed like a native app:

- **Desktop (Chrome/Edge)**: open the site, then use the browser's "Install app" option (icon in the address bar, or the ⋮ menu), or use the "Install on this device" button in Settings.
- **Android (Chrome)**: open the site, tap the ⋮ menu, then "Install app" / "Add to Home screen".
- **iPhone/iPad (Safari)**: open the site, tap the Share icon, then "Add to Home Screen".

Once installed it runs in its own window/icon and the app shell keeps working offline via a service worker (`public/sw.js`). Icons live in `public/icons/`; regenerate them with `scripts/generate-icons.ps1` if the brand mark changes.

## Security

- App lock: optional passcode gate; only a salted PBKDF2-SHA-256 hash (310k iterations) is stored, verified with a constant-time compare, with attempt rate-limiting
- Hardened HTTP response headers in `next.config.ts`: CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS
- All external input validated with Zod (quick capture, backup imports)
- Known limitation: workspace data itself lives unencrypted in `localStorage` until the database + auth layer is wired up

## Stack

- Next.js 15 App Router
- React 19 and TypeScript
- Tailwind CSS
- Prisma with PostgreSQL or Neon
- Better Auth-ready environment
- Zustand, Zod, Framer Motion, Lucide, Sonner, Recharts

## Getting Started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Database

Set `DATABASE_URL` in `.env.local`, then run:

```bash
npm run db:generate
npm run db:push
```

The current UI stores draft workspace data in local storage so the app is usable before a database is connected. The Prisma schema is ready for the server actions and API routes that should replace local persistence module by module.

## Product Name

The app is named `Dashy` throughout the scaffold.
