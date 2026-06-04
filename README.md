# QYS Monorepo (Production-Ready Full Stack)

## Project overview
QYS was migrated from a static IndexedDB-based frontend into a production-oriented full-stack monorepo using Next.js + Express with MongoDB.

## Tech stack
- Monorepo: pnpm workspaces, Turborepo
- Frontend: Next.js App Router, React, TypeScript, TailwindCSS
- Backend: Node.js, Express.js, TypeScript
- Database: MongoDB
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
Set `MONGODB_URL` in `apps/api/.env`. The API is MongoDB-only.

## Authentication and roles
Public signup always creates an active `USER` account. Users never choose roles during signup or login, but they must choose the youth center they are related to.

Official youth center accounts are created from the admin users page by an authorized management account. Assign the account a center, temporary password, and one of the supported roles:
- `DIRECTORATE_MANAGER`: can manage center/user accounts.
- `CENTER_MANAGER`: can access reports for the linked center and upload reports.
- `USER`: public normal user.

Admins can edit accounts, reset temporary passwords, and deactivate/reactivate accounts. Deactivated accounts cannot use existing JWTs because every protected API request reloads the account from the database.

Center managers use `/center` and can see only users/reports linked to their own `centerId`. When a center manager creates a user, the backend automatically assigns that user to the manager's center.

## Monthly Excel reports
The reports area now supports production monthly Excel aggregation:
- Center managers upload one strict Excel file per center/month from `/center/reports`.
- Directorate manager accounts upload on behalf of a selected center from `/admin/reports`.
- Accepted columns in the first worksheet are exactly: `event_name`, `month`, `revenues`, `expenses`.
- `month` must use `YYYY-MM`; financial fields must be non-negative numbers.
- Duplicate center/month uploads return a confirmation flow in the UI and can be replaced only after confirmation.
- The original Excel binary is not retained; the system stores upload metadata, SHA-256 hash, validation status, audit history, and parsed monthly report rows.
- Managers can download the official master workbook from the same reports page.

Optional API env:
- `EXCEL_MAX_UPLOAD_MB`: maximum `.xlsx` upload size in MB, defaults to `5` and is capped at `10`.
- `JWT_EXPIRES_IN`: bearer token lifetime, defaults to `8h`.
- `JWT_ISSUER` / `JWT_AUDIENCE`: enforced during JWT verification.
- `TRUST_PROXY`: set to `true` behind Railway or another trusted HTTPS proxy.

Security notes:
- Production must set `FRONTEND_URL` or `CORS_ORIGIN` to explicit HTTPS origins. Wildcards and localhost production CORS are rejected at startup.
- `JWT_SECRET` must be at least 32 characters and must not be a placeholder.
- Monthly report uploads accept `.xlsx` only; legacy `.xls` files are rejected.

## Database seed
```bash
pnpm db:seed
```

Seeded development credentials:
- Directorate manager: `admin@example.com` / `AdminDevPass!2026`
- Center manager: `center@example.com` / `CenterDevPass!2026`
- Public user: `user@example.com` / `UserDevPass!2026`

Override these with `SEED_ADMIN_PASSWORD`, `SEED_CENTER_PASSWORD`, and `SEED_USER_PASSWORD` before seeding shared environments.

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
1. Create Railway project and configure a MongoDB connection string.
2. Set service for `apps/api` and another for `apps/web`.
3. Add env vars:
   - API: `MONGODB_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_ISSUER`, `JWT_AUDIENCE`, `PORT`, `FRONTEND_URL`, `CORS_ORIGIN`, `TRUST_PROXY=true`
   - Web: `NEXT_PUBLIC_API_URL`
4. Build commands:
   - API: `pnpm install && pnpm run build:api`
   - Web: `pnpm install && pnpm --filter @qys/shared build && pnpm --filter @qys/web build`
5. Start commands:
   - API: `pnpm --filter @qys/api start`
   - Web: `pnpm --filter @qys/web start`
6. Seed optional sample data when needed:
```bash
pnpm --filter @qys/api db:seed
```
