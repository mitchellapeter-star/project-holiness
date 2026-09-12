# Project Holiness

Project Holiness is a private personal operating system for turning Christian conviction into consistent practice through A3 improvement, recurring disciplines, and a calling log.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/project-holiness run dev` — run the Project Holiness web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/project-holiness/src/App.tsx` — product shell, routes, UI state, and local persistence
- `artifacts/project-holiness/src/index.css` — visual theme, typography, motion, and responsive styling
- `artifacts/project-holiness/src/lib/supabase.ts` — optional Supabase auth client, enabled with Vite env vars
- `artifacts/project-holiness/src/lib/workspace-sync.ts` — Supabase workspace sync boundary
- `artifacts/project-holiness/supabase/schema.sql` — Supabase table and Row Level Security policies

## Architecture decisions

- The app now starts at a Supabase Auth login screen and routes authenticated users into the dashboard; localStorage is retained only as a development fallback when Supabase is not configured.
- The workspace is intentionally represented as one JSON payload for the MVP so Supabase connection setup stays small; Row Level Security still isolates each user's data.
- Fixed A3 statements remain non-editable while reflection fields and action items are user-managed.

## Product

Users can review progress, edit an A3 improvement reflection, manage action items, create and complete recurring disciplines, and keep a historical calling log. The UI is responsive and uses a calm field-journal visual language with green, parchment, and brass accents.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Supabase is optional for the preview. To enable secure accounts and cloud persistence, configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then run `supabase/schema.sql` in the Supabase SQL editor.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
