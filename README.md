# QYS Monorepo (Production-Ready Full Stack)

## Project overview
QYS was migrated from a static IndexedDB-based frontend into a production-oriented full-stack monorepo using Next.js + Express with MongoDB or PostgreSQL.

## Tech stack
- Monorepo: pnpm workspaces, Turborepo
- Frontend: Next.js App Router, React, TypeScript, TailwindCSS
- Backend: Node.js, Express.js, TypeScript
- Database: MongoDB (primary) or PostgreSQL (fallback)
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
Set one of these in `apps/api/.env`:
1. `DATABASE_URL` for PostgreSQL (if present, API uses PostgreSQL).
2. `MONGODB_URL` for MongoDB (used when `DATABASE_URL` is not set).

## Authentication and roles
Public signup always creates an active `USER` account. Users never choose roles during signup or login, but they must choose the youth center they are related to.

Official youth center accounts are created from the admin users page by an authorized management account. Assign the account a center, temporary password, and one of the supported roles:
- `SUPER_ADMIN`: full access.
- `MINISTRY_MANAGER`: management access except super-admin assignment.
- `DIRECTORATE_MANAGER`: can manage center/user accounts.
- `CENTER_MANAGER`: can access reports for the linked center and upload reports.
- `USER`: public normal user.

Admins can edit accounts, reset temporary passwords, and deactivate/reactivate accounts. Deactivated accounts cannot use existing JWTs because every protected API request reloads the account from the database.

Center managers use `/center` and can see only users/reports linked to their own `centerId`. When a center manager creates a user, the backend automatically assigns that user to the manager's center.

## Monthly Excel reports
The reports area now supports production monthly Excel aggregation:
- Center managers upload one strict Excel file per center/month from `/center/reports`.
- Ministry, directorate, and super-admin accounts upload on behalf of a selected center from `/admin/reports`.
- Accepted columns in the first worksheet are exactly: `center_name`, `month`, `revenues`, `expenses`, `seminars_count`.
- `month` must use `YYYY-MM`; financial fields must be non-negative numbers; `seminars_count` must be a non-negative integer.
- Duplicate center/month uploads return a confirmation flow in the UI and can be replaced only after confirmation.
- The original Excel binary is not retained; the system stores upload metadata, SHA-256 hash, validation status, audit history, and parsed monthly report rows.
- Managers can download the official master workbook from the same reports page.

Optional API env:
- `EXCEL_MAX_UPLOAD_MB`: maximum Excel upload size in MB, defaults to `10`.

## Prisma commands
```bash
pnpm db:generate
pnpm db:migrate
pnpm --filter @qys/api prisma:seed
```

After pulling auth/schema changes for PostgreSQL, run:
```bash
pnpm db:generate
pnpm db:migrate
pnpm --filter @qys/api prisma:seed
```

MongoDB deployments do not need Prisma migrations, but should still run the seed if you want the sample super admin and center manager accounts.

Seeded development credentials:
- Super admin: `admin@example.com` / `admin123`
- Center manager: `center@example.com` / `center123`
- Public user: `user@example.com` / `user123`

## Development commands
```bash
pnpm dev
```
- Web: http://localhost:3000
- API: http://localhost:4000

## Production build
```bash
pnpm build
pnpm run build:api
pnpm --filter @qys/api start
pnpm --filter @qys/web start
```

## Railway deployment instructions
1. Create Railway project and add PostgreSQL plugin.
2. Set service for `apps/api` and another for `apps/web`.
3. Add env vars:
   - API: `DATABASE_URL` or `MONGODB_URL`, `JWT_SECRET`, `PORT`, `CORS_ORIGIN`
   - Web: `NEXT_PUBLIC_API_URL`
4. Build commands:
   - API: `pnpm install && pnpm run build:api`
   - Web: `pnpm install && pnpm --filter @qys/shared build && pnpm --filter @qys/web build`
5. Start commands:
   - API: `pnpm --filter @qys/api start`
   - Web: `pnpm --filter @qys/web start`
6. Run migrations in API release phase:
```bash
pnpm --filter @qys/api prisma:migrate
pnpm --filter @qys/api prisma:seed
```
