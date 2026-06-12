# QYS Platform

QYS is a full-stack youth and sports management platform for the Qalyubia directorate, youth centers, and normal users. It is built as a pnpm monorepo with a Next.js web app, an Express API, MongoDB, shared TypeScript validation, Excel report processing, chat, dark mode, and a role-aware AI assistant.

## Tech Stack

- Monorepo: pnpm workspaces, Turborepo
- Web: Next.js App Router, React, TypeScript, TailwindCSS, Leaflet
- API: Node.js, Express, TypeScript, MongoDB, Mongoose
- Shared package: Zod schemas and shared types
- Files: ExcelJS for monthly report templates/imports
- AI assistant: OpenRouter first, then Grok/xAI, Gemini, then OpenAI when configured

## Repository Structure

```text
apps/
  api/      Express API, database models, seed script, tests
  web/      Next.js frontend
packages/
  shared/   Shared schemas and types
```

## Main Features

- Arabic RTL interface with light/dark theme support.
- Role-based dashboards for directorate admins, center managers, and normal users.
- Admin pages for users, centers, map, ideas, challenges, complaints, reports, chat, and settings.
- Center pages for reports, map, ideas, users, challenges, complaints, chat, and settings.
- Normal user pages for dashboard, centers, map, ideas, challenges, complaints, and settings.
- Admin user management separates normal users from center accounts with a responsive modal flow.
- Ideas, challenges, and complaints use detail overlays for admin actions.
- Chat shows the sender's own messages on the right and supports admin/center conversations.
- Floating AI assistant understands the current page, role, UI layout, and platform workflows.
- Monthly Excel report upload, validation, summary, replacement flow, and template download.
- Mobile sidebar, responsive tables, responsive overlays, and phone-friendly assistant panel.

## Setup

Install dependencies:

```bash
pnpm install
```

Copy environment files:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

On Windows PowerShell, use:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
```

Start development:

```bash
pnpm dev
```

Default URLs:

- Web: `http://localhost:3000`
- API: `http://localhost:4000`

If the web app gets stuck on `جاري التحميل...` after frontend changes, restart the Next dev server. For a clean restart:

```bash
pnpm --filter @qys/web dev:clean
```

## Environment Variables

Required API variables in `apps/api/.env`:

```env
PORT=4000
NODE_ENV=development
MONGODB_URL=mongodb+srv://<user>:<password>@<cluster>/<database>?retryWrites=true&w=majority
JWT_SECRET=replace_with_at_least_32_random_characters
JWT_EXPIRES_IN=8h
JWT_ISSUER=qys-api
JWT_AUDIENCE=qys-web
CORS_ORIGIN=http://localhost:3000
FRONTEND_URL=http://localhost:3000
TRUST_PROXY=false
```

Web variable in `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

Optional API variables:

- `EXCEL_MAX_UPLOAD_MB`: maximum `.xlsx` upload size in MB. Defaults to `5` and is capped at `10`.
- `JSON_BODY_LIMIT`: Express JSON body limit. Defaults to `100kb`.
- `SEED_ADMIN_PASSWORD`, `SEED_CENTER_PASSWORD`, `SEED_USER_PASSWORD`: override seeded passwords.
- `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`: preferred AI provider.
- `XAI_API_KEY` or `GROK_API_KEY`, `GROK_MODEL`: Grok/xAI fallback.
- `GEMINI_API_KEY` or `GOOGLE_API_KEY`, `GEMINI_MODEL`: Gemini fallback.
- `OPENAI_API_KEY`, `OPENAI_MODEL`: OpenAI fallback.

Never commit real secrets. If a key is exposed in chat, screenshots, git, or logs, rotate it from the provider dashboard.

## Database Seed

Seed development data:

```bash
pnpm db:seed
```

Default development accounts:

- Directorate manager: `admin@example.com` / `AdminDevPass!2026`
- Center manager: `center@example.com` / `CenterDevPass!2026`
- Normal user: `user@example.com` / `UserDevPass!2026`

Use seed password overrides before seeding any shared environment.

## Roles and Access

`DIRECTORATE_MANAGER`

- Uses `/admin`.
- Manages accounts, centers, map, ideas, challenges, complaints, reports, chat, and settings.
- Can create normal user accounts and center manager accounts.
- Can upload or replace reports for any center.

`CENTER_MANAGER`

- Uses `/center`.
- Sees center-scoped reports, users, ideas, challenges, complaints, map, chat, and settings.
- Can upload reports only for the linked center.
- Can create normal users linked to the manager's center.

`USER`

- Uses `/dashboard`.
- Can browse centers/map, submit ideas and complaints, join challenges, and update settings.
- The Facebook link is only shown in the normal-user sidebar.

Deactivated accounts cannot continue using existing JWTs because protected API requests reload the user from MongoDB.

## Monthly Excel Reports

The monthly report template uses Arabic column headers:

- `اسم الفعالية`
- `الشهر`
- `الإيرادات`
- `المصروفات`

Rules:

- Uploads must be `.xlsx`.
- `الشهر` must use `YYYY-MM`.
- Revenue and expense values must be non-negative numbers.
- Center managers upload one file per center/month from `/center/reports`.
- Directorate managers can upload on behalf of a selected center from `/admin/reports`.
- Duplicate center/month uploads use a confirmation flow before replacement.
- The API stores metadata, SHA-256 hash, validation status, audit history, and parsed rows.

The parser still accepts the older English headers for compatibility, but the official downloaded template is Arabic.

## AI Assistant

The assistant is available as a floating button inside authenticated pages. The frontend sends the current path, user role, and recent chat history to the API. The API builds a role-aware prompt with real platform context, including:

- What pages each role can open.
- What controls and overlays exist in the UI.
- How reports, ideas, challenges, complaints, chat, settings, and account management work.
- The current page path so answers can refer to visible buttons and expected results.

Provider order:

1. OpenRouter
2. Grok/xAI
3. Gemini
4. OpenAI

If no provider is configured, or a provider returns an error, the assistant falls back to guided platform help.

## Useful Commands

```bash
pnpm --filter @qys/shared build
pnpm --filter @qys/api typecheck
pnpm --filter @qys/api test
pnpm --filter @qys/api build
pnpm --filter @qys/web typecheck
pnpm --filter @qys/web build
pnpm build
```

Validate and format the center account workbook:

```bash
pnpm --filter @qys/api generate:center-accounts
```

## Production Build

```bash
pnpm build
pnpm --filter @qys/api start
pnpm --filter @qys/web start
```

Production notes:

- Set `NODE_ENV=production`.
- Use a strong `JWT_SECRET` with at least 32 characters.
- Set `FRONTEND_URL` and `CORS_ORIGIN` to real HTTPS origins.
- Do not allow wildcard or localhost CORS in production.
- Set `TRUST_PROXY=true` behind Railway or another trusted HTTPS proxy.
- Configure only the AI provider keys you actually use.

## Railway Deployment

1. Create a Railway project and MongoDB connection string.
2. Create one service for `apps/api` and one for `apps/web`.
3. API env vars: `MONGODB_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_ISSUER`, `JWT_AUDIENCE`, `PORT`, `FRONTEND_URL`, `CORS_ORIGIN`, `TRUST_PROXY=true`, and optional AI provider keys.
4. Web env vars: `NEXT_PUBLIC_API_URL`.
5. API build command:

```bash
pnpm install && pnpm run build:api
```

6. Web build command:

```bash
pnpm install && pnpm --filter @qys/shared build && pnpm --filter @qys/web build
```

7. API start command:

```bash
pnpm --filter @qys/api start
```

8. Web start command:

```bash
pnpm --filter @qys/web start
```

9. Seed optional sample data when needed:

```bash
pnpm --filter @qys/api db:seed
```

## Troubleshooting

- `POST http://localhost:4000/api/... ERR_CONNECTION_REFUSED`: start the API or check that it is listening on port `4000`.
- Login stays on loading: restart the web dev server, especially after changing Next config, CSP, fonts, or environment variables.
- Font looks wrong: confirm the current CSP allows `https://fonts.googleapis.com` and `https://fonts.gstatic.com`.
- Assistant gives guided help only: verify the relevant AI key/model env vars and restart the API.
- Reports upload fails: confirm the file is `.xlsx`, the first worksheet uses the Arabic headers above, and the month is `YYYY-MM`.
