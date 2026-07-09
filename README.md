# Dashy

Dashy is a premium personal operating system for founders, developers, students, freelancers, creators, NGOs, and teams.

This scaffold creates a production-minded Next.js foundation with a responsive dashboard, keyboard-first search and quick capture, persistent client-side CRUD interactions, and a Prisma schema for the full relational database model.

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
