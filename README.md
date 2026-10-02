# Payslip portal

Staff prepare monthly payroll, finalize immutable payslips, download PDFs, and email each employee their own payslip. Employees sign in and download only their own finalized or voided payslips.

The app does not calculate PF, ESI, TDS, or professional tax. Those amounts are entered. Net pay is the sum of the entered earnings minus the entered deductions, rounded half-up to two decimal places. Amounts in words use the Indian crore and lakh system.

Password reset and CSV/XLSX import are not included. Employee portal logins are created by a Super Admin from Users, and an employee login is bound to that employee’s work email.

## Requirements

- Node.js 20 or newer and npm
- A Neon Postgres database

## Setup

```powershell
npm install
copy .env.example .env
```

Fill in `.env`. Do not commit it.

- `DATABASE_URL` is the pooled Neon connection (hostname contains `-pooler`) used by the app.
- `DIRECT_URL` is the direct Neon connection (same credentials, hostname without `-pooler`) used only by migrations.
- Production database URLs must include `sslmode=require`.
- `JWT_SECRET` must be a random value of at least 32 characters. Production rejects placeholders and secrets with fewer than 8 distinct characters.
- Leave the SMTP fields empty until email is needed. If any SMTP field is set, all of them are required, including `SMTP_SECURE` (`true` or `false`). Do not infer TLS from the port.

Apply migrations once, from one machine, after `DIRECT_URL` is set:

```powershell
npm run db:migrate
```

Do not run migrations from every app instance.

Create the first Super Admin. The password is one-time and is not stored in `.env`:

```powershell
npm run bootstrap:super-admin -- --email you@company.com --password "<one-time>"
```

Start the app:

```powershell
npm run dev
```

Open http://localhost:3000 and sign in. Further staff and employee logins are created under Users.

## Email worker

Queued payslip mail is not sent by the web process. Run:

```powershell
npm run email:work
```

Each run sends at most 10 messages, then exits. It prints counts only. If SMTP is not configured, it leaves the queue untouched and exits 0. `SIGINT` or `SIGTERM` finishes the current chunk, disconnects from the database, and exits.

In production, run that command about once a minute under a process manager with a restart policy. A failed SMTP login stops the chunk and leaves the remaining mail queued.

## Production

```powershell
npm run build
npm start
```

Run `npm run db:migrate` once as a deploy step before starting the new version. Then run the web process and the email worker as separate processes.

Checks:

- `GET /health` returns `{ "status": "ok" }` and does not use the database.
- `GET /health/ready` runs `SELECT 1`. It returns `{ "status": "ok" }`, or `{ "status": "unavailable" }` with HTTP 503. It does not return SQL errors or secrets.

Responses send a restrictive Content-Security-Policy, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and, in production, `Strict-Transport-Security`. The `X-Powered-By` header is disabled. Session and CSRF cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` with the `__Host-` prefix in production. The session JWT stays in that cookie. It is not placed in JavaScript or browser storage.

There is no permissive CORS configuration. Do not run `next dev` or debug logging in production.

## Roles

- **Super Admin** manages company settings, users, and the audit log, and can run payroll.
- **Admin** manages employees and payroll. Admin cannot manage users, company settings, or the audit log.
- **User** sees their own profile and their own finalized or voided payslips.

Hiding a link is not authorization. Every action checks the role from the database.

## Secret rotation

- **JWT.** Set a new `JWT_SECRET` and restart the app. Existing sessions stop working because tokens are signed with that secret. Users sign in again. Revoking sessions in the database is still required when a person’s role or access changes.
- **SMTP.** Update `SMTP_USER` and `SMTP_PASSWORD` (and any other SMTP field that changed) and restart both the app and the email worker. Queued messages stay queued. Addresses already stored on a delivery row are not rewritten.

## Backups and restore

Use Neon’s backup and point-in-time restore for the selected plan. This repository does not run a restore, and a restore has not been rehearsed here.

Operator rehearsal, on a non-production branch or project:

1. Note the current time and confirm a recent backup or PITR window exists.
2. Restore to a new Neon branch or project. Do not overwrite the live database for the rehearsal.
3. Point a disposable `DATABASE_URL` and `DIRECT_URL` at the restored database.
4. Sign in and confirm a known finalized payslip, its PDF, and its email status match what you expect.
5. Discard the rehearsal branch. Do not copy rehearsal secrets back into production.

## Deployment checklist

- `npm test`, `npx tsc --noEmit`, `npm run lint`, and `npm run build` pass.
- `DATABASE_URL` and `DIRECT_URL` use TLS (`sslmode=require`).
- `npm run db:migrate` has been run once for this release.
- A Super Admin exists, and bootstrap passwords are not left in the environment.
- `JWT_SECRET` is unique to this environment.
- SMTP is set only if email will be sent, and the worker is scheduled.
- `/health` and `/health/ready` succeed against the new instance.
- Production is not started with `next dev`.

## Rollback

Keep the previous build. If the new version misbehaves and the migration did not change data, stop the new processes, start the previous build, and leave the database as it is. Do not run a down migration after people have saved payroll.

If a bad migration has already written data, restore the database from Neon PITR to a time before the migration, then start the previous build against that restored database. Schedule a maintenance window. Payslips finalized after the restore point are not in that database.

## Known limits

Prisma is pinned to 6.19.3. `npm audit` reports a high finding in the Prisma CLI transitive dependency `deepmerge-ts` via `@prisma/config`. That package is used by the CLI, not by the running portal. Do not upgrade to a Prisma 8 release candidate to clear it, and do not run `npm audit fix --force`.

Automated tests cover payroll rounding, snapshot copies, cookie flags, security headers, email planning, PDF rendering, and access rules. They do not sign in against a database. The nine end-to-end flows in `implementation.md` still need a database and a Super Admin.
