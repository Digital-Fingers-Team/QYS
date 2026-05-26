# QYS Monorepo (Production-Ready Full Stack)

## Project overview
QYS was migrated from a static IndexedDB-based frontend into a production-oriented full-stack monorepo using Next.js + Express + PostgreSQL + Prisma.

## Tech stack
- Monorepo: pnpm workspaces, Turborepo
- Frontend: Next.js App Router, React, TypeScript, TailwindCSS
- Backend: Node.js, Express.js, TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Validation: Zod (shared package)

## Structure
```
root/
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   └── shared/
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

## Installation
```bash
pnpm install
```

## Workspace setup
```bash
pnpm dev
pnpm build
pnpm typecheck
```

## Environment variables
Copy example files:
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

## Database setup
1. Ensure PostgreSQL is running.
2. Set `DATABASE_URL` in `apps/api/.env`.

## Prisma commands
```bash
pnpm db:generate
pnpm db:migrate
pnpm --filter @qys/api prisma:seed
```

## Development commands
```bash
pnpm dev
```
- Web: http://localhost:3000
- API: http://localhost:4000

## Production build
```bash
pnpm build
pnpm --filter @qys/api start
pnpm --filter @qys/web start
```

## Railway deployment instructions
1. Create Railway project and add PostgreSQL plugin.
2. Set service for `apps/api` and another for `apps/web`.
3. Add env vars:
   - API: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `CORS_ORIGIN`
   - Web: `NEXT_PUBLIC_API_URL`
4. Build commands:
   - API: `pnpm install && pnpm --filter @qys/shared build && pnpm --filter @qys/api build`
   - Web: `pnpm install && pnpm --filter @qys/shared build && pnpm --filter @qys/web build`
5. Start commands:
   - API: `pnpm --filter @qys/api start`
   - Web: `pnpm --filter @qys/web start`
6. Run migrations in API release phase:
```bash
pnpm --filter @qys/api prisma:migrate
pnpm --filter @qys/api prisma:seed
```
