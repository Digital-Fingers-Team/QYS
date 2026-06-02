# QYS Security Audit

Date: 2026-06-02

## Summary

This pass hardened the `apps/api` and `apps/web` applications against authorization bypass, unsafe input, upload abuse, Excel-based attacks, weak JWT handling, permissive CORS, missing security headers, error leakage, leaked example secrets, and known vulnerable dependencies.

## High Severity

- Production CORS could fall back to `*`.
  - Fixed by requiring explicit production `FRONTEND_URL` or `CORS_ORIGIN`, removing wildcard behavior, and restricting methods/headers.
- Uploaded Excel files were insufficiently inspected.
  - Fixed by accepting `.xlsx` only, enforcing MIME/extension/magic checks, inspecting ZIP central directory structure, rejecting macro/executable entries, limiting entry count/uncompressed size/compression ratio, and generating random server-side filenames.
- JWT verification did not enforce algorithm, issuer, audience, or strict bearer format.
  - Fixed by requiring strict `Bearer` syntax, `HS256`, `iss`, `aud`, `sub`, shorter default expiry, and stronger secret validation.
- Example environment file contained a real MongoDB connection string.
  - Fixed by replacing it with placeholders. Rotate the exposed MongoDB credential outside this repository.

## Medium Severity

- Zod schemas allowed unknown fields and several free-form status strings.
  - Fixed with strict schemas, enum statuses, length limits, URL protocol validation, and text normalization/control-character stripping.
- Route params and unexpected query/body data were loosely handled.
  - Fixed with strict positive integer param validation plus query/body guards.
- API exposed duplicate unprefixed routes.
  - Fixed by serving application routes under `/api` only.
- Error handler returned arbitrary exception messages.
  - Fixed by returning detailed errors only for explicit `ApiError`, Zod, Multer, and JSON syntax cases.
- Missing rate limits and login/upload throttles.
  - Fixed with global, auth, and upload rate limits.
- Missing HTTP hardening headers.
  - Fixed with Helmet on API and Next.js headers for CSP, HSTS, frame denial, content sniffing, referrer policy, and permissions policy.
- Dependency audit found vulnerable `postcss` and `uuid` transitives.
  - Fixed in the lockfile with pnpm audit overrides; `pnpm audit` now reports no known vulnerabilities.

## Low Severity

- Browser token storage used `localStorage`.
  - Reduced persistence to `sessionStorage`; remaining risk is documented below.
- Audit logs included email addresses/user names.
  - Changed privileged action logs to use account IDs and actor IDs.
- Seed credentials were short and documented.
  - Replaced with longer dev-only defaults and env override support.

## Remaining Risks

- Bearer JWTs are still available to JavaScript. CSP, React escaping, strict validation, and `sessionStorage` reduce risk, but HttpOnly secure cookies with CSRF tokens would be stronger.
- No full ESLint setup exists for `apps/web`; `next lint` prompts interactively. Typecheck, build, tests, and audit were run instead.
- The real MongoDB credential previously present in `.env.example` must be rotated in MongoDB/Railway.
- pnpm emits a warning that root `pnpm.overrides` is ignored, but that generated override format is what produced the clean lockfile/audit in this workspace. Keep the lockfile committed and re-run `pnpm audit` after dependency changes.

## Verification

- `pnpm --filter @qys/api test`: passed.
- `pnpm typecheck`: passed.
- `pnpm build`: passed.
- `pnpm audit`: passed, no known vulnerabilities.
- `pnpm lint`: not completed because `apps/web` has no ESLint config and `next lint` opens an interactive setup prompt.
