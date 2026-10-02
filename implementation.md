# Payslip Generation Portal — Production Implementation Specification

## 1. Objective

Build a production-ready web application for managing employee records, preparing monthly payroll data, generating individual payslips as PDFs, and emailing payslips to one employee or a selected group/all eligible employees.

Use the uploaded `Basic_Payslip_Required_Fields_Template.xlsx` as the reference for payslip fields and layout. Do not hardcode the sample employee names or IDs from the spreadsheet. Import them as data only if an authorized administrator explicitly uploads the spreadsheet.

## 2. Required stack and implementation approach

- Use the existing repository's framework and conventions where practical. If the repository is empty, use **Next.js (App Router) + TypeScript** for the application.
- Use **Neon PostgreSQL** through `DATABASE_URL`.
- Use a maintained ORM (prefer Drizzle ORM if the project already uses it; otherwise Prisma is acceptable). Keep schema changes in migrations.
- Use server-side PDF generation with a maintained library such as `@react-pdf/renderer` or PDFKit.
- Use SMTP for email delivery.
- Use JWT authentication stored only in an **HttpOnly cookie**. Never expose the JWT to client-side JavaScript, localStorage, sessionStorage, or URL parameters.
- Use a maintainable, modular architecture. Avoid giant files; keep modules focused and ideally below 500 lines.
- TypeScript strict mode; validate all external input at runtime (Zod or equivalent).
- Follow the repository's existing package manager, linting, formatting, and test conventions.

Before implementation, inspect the repository and report its framework, existing conventions, and any assumptions. Then implement the feature end-to-end rather than only producing a scaffold.

## 3. Roles and access control

Implement server-enforced RBAC with exactly these roles:

### Super Admin
- Manage application settings and company details.
- Create, update, deactivate, and assign roles to Admin accounts.
- View and manage all employees, payroll periods, payroll records, payslips, email batches, and audit events.
- Configure email settings that are safe to expose in the admin UI. SMTP secrets must remain environment-only.
- Perform all Admin and User capabilities.

### Admin
- Create, edit, deactivate, and view employee records.
- Create and manage payroll periods and payroll entries.
- Validate, finalize, and generate payslips.
- Email a payslip to one employee or send a batch to selected employees / all eligible employees.
- View delivery status and retry failed emails.
- Cannot create Super Admins, change their own role, or change global security settings.

### User (Employee)
- View only their own profile and payslips.
- Download only their own payslip PDFs.
- Access only records linked to their authenticated employee account.
- Cannot browse other employees, payroll data, email batches, or admin endpoints.

Enforce authorization in every server action, route handler, API endpoint, and file/PDF download. Hiding UI controls is not authorization. Deny by default. Prevent IDOR by resolving employee ownership from the authenticated session, not a client-supplied employee ID.

Bootstrap the first Super Admin securely through a one-time CLI/script or documented deployment procedure. Do not create a default public admin account or hardcoded password. Prevent accidental creation of additional Super Admins except through an explicitly authorized process.

## 4. Authentication and session security

- Login with email and password; store passwords using **Argon2id** (preferred) or bcrypt with an appropriate cost factor. Never store plaintext passwords.
- JWT must be signed using `JWT_SECRET`, with an explicit algorithm allowlist (e.g. HS256), issuer, audience, subject, issued-at, and expiration claims.
- `JWT_EXPIRY=7d` is the requested default, but make session duration configurable and support revocation. Consider a shorter access/session lifetime for payroll data; document the chosen trade-off.
- Set the session cookie with `HttpOnly`, `Secure` in production, `SameSite=Lax` (or stricter if compatible), `Path=/`, and an appropriate `Max-Age`/`Expires`.
- Cookie name should be a secure, non-obvious application constant such as `__Host-session` in production. The `__Host-` prefix requires `Secure`, `Path=/`, and no `Domain`.
- Never return the JWT in JSON or expose it in client state.
- Validate `Origin`/`Host` for state-changing requests and implement CSRF protection appropriate to cookie authentication. SameSite alone is not the entire CSRF strategy.
- Implement login rate limiting, generic login errors, account deactivation checks, logout (clear cookie and revoke session), and session invalidation on password/role changes.
- Do not put sensitive personal or payroll data in JWT claims. Use a session identifier and minimal identity/authorization claims.
- Add password reset only if implemented securely: single-use, expiring, hashed reset tokens; generic responses; rate limits; audit events.
- Never log passwords, JWTs, cookies, SMTP credentials, PAN, UAN, ESI numbers, or salary details.

## 5. Environment configuration

Use the existing `.env` values. Add missing values with validation; never commit real secrets.

```dotenv
NODE_ENV=development
DATABASE_URL=
JWT_SECRET=
JWT_EXPIRY=7d

# SMTP
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
SMTP_SECURE=
```

Requirements:
- Validate environment variables at startup and fail fast with a clear message when required production configuration is missing.
- `JWT_SECRET` must be a cryptographically random secret with sufficient entropy. Do not use a placeholder in production.
- Support SMTP TLS correctly: implicit TLS for providers/ports that require it, or STARTTLS where appropriate. Do not infer security solely from the port.
- Keep `.env` out of version control; provide `.env.example` with empty placeholders.
- Never send server-only environment variables to the browser.
- Use Neon’s pooled connection string for normal application traffic when appropriate, and a direct connection string for migration tooling if required by the selected ORM/provider. Follow Neon’s current connection guidance and configure SSL securely.
- Do not print environment values in logs or error messages.

## 6. Employee data model

Create an employee profile linked optionally/appropriately to a login user. Include:

- Employee ID / employee number (unique; examples in the reference sheet are data, not constants)
- Full name
- Work email (unique where applicable; validate and normalize)
- Personal/contact email only if there is a clear business need
- Phone number (optional)
- Designation
- Department
- Date of joining
- Employment status (active, inactive, separated)
- PAN (optional, access restricted)
- UAN (optional, access restricted)
- ESI number (optional, access restricted)
- Created/updated timestamps and actor IDs

Keep authentication users separate from employee profiles. An employee may exist before portal access is provisioned. Enforce unique constraints and soft-deactivation where historical payroll records must be retained.

Collect only fields needed for payroll. Restrict sensitive identifiers to authorized roles and avoid displaying them in broad employee lists.

## 7. Company and payroll configuration

Store company/employer name and address in a company settings table, not repeated as editable arbitrary values on every employee. If multiple legal entities are needed, model company entities explicitly and associate employees/payroll periods with the relevant entity.

Support payroll periods by month/year with a unique constraint. Each payroll record must reference an employee and payroll period. Prevent duplicate payroll records for the same employee and period unless a documented revision/version workflow is used.

Payroll fields based on the spreadsheet:

### Payslip/company details
- Company / Employer Name
- Company Address
- Payslip / Wage Month
- Payslip Number (unique, generated server-side)
- Employee Name
- Employee ID / Employee Number
- Designation
- Department
- Date of Joining

### Attendance
- Total Working Days
- Paid Days
- LOP / Absent Days

### Earnings
- Basic Salary
- HRA
- Special Allowance
- Other Allowances
- Overtime (optional)
- Bonus / Incentive (optional; the sample layout says “Not needed”, so make this configurable and omit it by default)
- Gross Earnings

### Deductions
- Employee PF (optional/as applicable)
- Employee ESI (optional/as applicable)
- Professional Tax (optional/as applicable)
- TDS (optional/as applicable)
- Salary Advance / Loan (optional/as applicable)
- Other Deductions (optional/as applicable)
- Total Deductions

### Final salary and identifiers
- Net Salary / Net Pay
- Amount in Words (generated from final net pay)
- PAN (optional/as applicable)
- UAN (optional/as applicable)
- ESI Number (optional/as applicable)

Use `NUMERIC/DECIMAL` for monetary values, never floating-point types. Define currency (default INR) and display formatting centrally. Store money in a consistent precision and rounding strategy. Do not assume statutory rates or calculate PF/ESI/TDS/PT automatically unless the business supplies approved rules and effective dates.

## 8. Payroll calculation and validation

- Calculate gross earnings from the configured earning components.
- Calculate total deductions from deduction components.
- Calculate net pay as gross earnings minus total deductions.
- Calculate or validate attendance fields consistently. Validate non-negative values and sensible relationships (e.g. paid days and LOP days must not exceed total working days, subject to explicitly configured payroll rules).
- Server is authoritative: recalculate totals on the server; never trust totals supplied by the browser.
- Use decimal-safe arithmetic and a documented rounding policy.
- Block finalization if mandatory fields are missing, values are invalid, or net pay is negative unless an explicitly approved exception workflow exists.
- Store a calculation snapshot and the finalized payslip data so later employee/company profile edits do not silently alter historical payslips.
- Once finalized, payroll should be immutable. Corrections must create a new revision/void-and-reissue record with actor, timestamp, reason, and audit history.
- Require explicit confirmation before finalizing a payroll period or sending a bulk email.
- Do not represent the generated payslip as legally compliant by default. Make statutory fields/rules configurable and require review by the employer/payroll professional.

## 9. Payslip PDF generation

- Create a professional, printable PDF matching the sections in the reference workbook: Company Details, Payslip Details, Employee Details, Attendance, Earnings, Deductions, Final Salary, and Statutory/Identification.
- Use clear tables, consistent currency formatting, payroll month, unique payslip number, and amount in words.
- Omit optional fields when not applicable; do not print `undefined`, `null`, or empty placeholder values.
- Handle long company names, addresses, employee names, and large amounts without clipping.
- Generate PDFs server-side only, from finalized database snapshots.
- Set appropriate response headers and prevent public caching (`Cache-Control: private, no-store`).
- PDF access must pass the same authentication and authorization checks as the record.
- Do not expose permanent public PDF URLs. If files are stored, use private object storage and short-lived access mechanisms; otherwise generate on demand and avoid persisting unnecessary copies.
- Add tests for PDF content, calculations, missing optional values, and layout edge cases.

## 10. Email sending: individual and bulk

Support:
1. Send one finalized payslip to one employee.
2. Send to a manually selected group.
3. Send to all eligible employees for a selected finalized payroll period.

Rules:
- Only active employees with valid work email addresses and a finalized payslip for the selected period are eligible.
- Never send a payslip to an address supplied ad hoc by the browser. Resolve recipient email from the employee record; require a controlled, audited correction process for address changes.
- Attach the correct employee’s PDF only. Prevent cross-employee attachment/recipient mix-ups.
- For bulk sends, show a preview/count and require confirmation.
- Use a background job/queue for batches; do not send hundreds of emails in a single web request.
- Create an email batch and one delivery record per employee/payslip. Track queued, sending, sent, failed, and retrying states, timestamps, attempt count, provider response (sanitized), and actor.
- Use bounded retries with exponential backoff for transient errors. Do not retry permanent recipient/configuration failures indefinitely.
- Make sending idempotent: prevent duplicate sends caused by retries, double-clicks, or repeated requests. Provide an explicit audited “resend” action.
- Rate-limit outbound mail and respect SMTP provider limits. Process batches in chunks.
- Do not expose other recipients in `To`/`CC`; send separate messages per employee. Never send all employee addresses in one message.
- Do not mark an email as delivered merely because SMTP accepted it; use a status such as “sent/accepted by SMTP” unless delivery events are actually available.
- Email subject/body should be configurable, professional, and avoid exposing salary figures in the subject. Attach PDF; do not include salary details in email body.
- Keep email logs free of attachment contents, tokens, and unnecessary personal data.
- Provide admin UI to view batch progress, failures, and safely retry failed deliveries.

If a queue is needed, use a durable database-backed job system or Redis-backed queue if Redis is introduced and operated reliably. Document how workers run in development and production. Do not add Redis solely by habit if a simpler durable design fits the repository.

## 11. Suggested database entities

Adapt names to the existing project, but model the equivalent of:

- `users`: id, email, password_hash, role, status, employee_id (nullable), last_login_at, created_at, updated_at
- `employees`: id, employee_number, full_name, work_email, designation, department, date_of_joining, status, pan, uan, esi_number, timestamps
- `company_settings` or `companies`: name, address, currency, payslip configuration
- `payroll_periods`: id, year, month, status, created_by, finalized_at, timestamps
- `payroll_records`: id, employee_id, payroll_period_id, payslip_number, all earning/deduction components, attendance, totals, amount_in_words, snapshot JSON/version, status, revision, timestamps
- `email_batches`: id, payroll_period_id, initiated_by, status, total_count, sent_count, failed_count, timestamps
- `email_deliveries`: id, batch_id, payroll_record_id, recipient snapshot, status, attempts, last_error_sanitized, sent_at, timestamps; add an idempotency key/unique constraints
- `sessions` or `revoked_tokens`: session ID/token identifier, user ID, expiry, revoked_at (depending on chosen JWT revocation design)
- `audit_logs`: actor, action, target type/id, timestamp, request correlation ID, safe metadata

Use foreign keys, indexes for common queries, unique constraints, and transactions for finalization and batch creation. Define deletion behavior deliberately; preserve payroll/audit history. Never cascade-delete finalized payroll history when an employee is deactivated.

## 12. Main screens

### Authentication
- Login
- Logout
- Password change/reset if included

### Super Admin
- Dashboard
- Admin/user management and role assignment
- Company settings
- Audit log
- System/email configuration status (never reveal secrets)

### Admin
- Dashboard with payroll-period status and email delivery summaries
- Employee list, search, filters, create/edit/deactivate
- Employee detail
- Payroll periods
- Payroll entry/editing with clear earnings/deductions sections
- Import employees/payroll from validated CSV/XLSX (optional but useful; preview before import, validate rows, report errors; never execute formulas/macros)
- Payroll validation and finalization
- Payslip preview/PDF
- Individual send, selected bulk send, all eligible send
- Email batch history and retry failed items

### User
- Own profile (restricted fields)
- Payslip history by month/year
- View/download own PDF

Ensure responsive, accessible UI with clear loading, empty, validation, and error states. Do not show payroll data in client-side logs or analytics.

## 13. API / server actions

Design consistent endpoints or server actions for:
- Login/logout/current session
- Employee CRUD and search (Admin/Super Admin)
- Payroll period CRUD/status transitions
- Payroll record CRUD, calculation preview, validation, finalize, revision/void
- Generate/download payslip PDF
- Create individual/bulk email batch
- Email batch status and delivery detail
- Retry failed delivery
- User management and role assignment (Super Admin)
- Audit log (authorized roles)

For every operation:
- Validate input and output schemas.
- Authenticate and authorize on the server.
- Scope queries to the authorized user/tenant/company.
- Use parameterized ORM queries.
- Return safe, consistent errors; never return stack traces or secrets.
- Apply pagination and limits to list endpoints.
- Add request IDs and structured logging with sensitive-field redaction.

## 14. Security and privacy checklist

- [x] RBAC enforced server-side on every route/action.
- [x] HttpOnly cookie; Secure in production; appropriate SameSite; no JWT in browser storage.
- [x] CSRF and origin validation for cookie-authenticated mutations.
- [x] Login and email endpoints rate-limited.
- [x] Password hashing and secure reset flow (if included). Password reset is not included.
- [x] Session revocation and role-change invalidation.
- [x] No IDOR in employee, payroll, PDF, or email endpoints.
- [x] Sensitive PAN/UAN/ESI data masked in lists and access-restricted.
- [x] Secrets and personal/payroll data redacted from logs.
- [x] SQL injection protection through ORM/parameterized queries.
- [x] Security headers and a restrictive Content Security Policy where compatible.
- [ ] Dependency audit and lockfile committed. The lockfile is in the repo. A high Prisma CLI finding in `deepmerge-ts` remains; do not force-upgrade Prisma to clear it.
- [ ] Backups and tested restore procedure for Neon. The restore steps are in the README. A restore has not been rehearsed.
- [ ] Database least-privilege credentials and TLS. Production database URLs that are set must include `sslmode=require`. A least-privilege database role has not been verified.
- [x] No public payslip files or predictable unauthenticated URLs.
- [x] Audit events for sensitive actions.
- [x] Production errors do not leak internals.

## 15. Audit logging

Record at minimum:
- Login success/failure (avoid storing passwords or tokens)
- User creation, role changes, deactivation, password reset
- Employee create/update/deactivation and sensitive-field changes
- Payroll creation, edits, finalization, revision, void
- PDF access/download where appropriate
- Email batch creation, individual send, retry, and result
- Company/configuration changes

Audit records should be append-only for application users. Restrict access to Super Admin (and narrowly authorized operational roles). Avoid storing full payroll payloads or sensitive identifiers in audit metadata.

## 16. Testing requirements

Implement automated tests for:
- Authentication, cookie flags, logout, expiry/revocation
- Role permissions and forbidden access
- Employee ownership and IDOR attempts
- Payroll calculations, decimal rounding, boundary cases
- Required-field validation and finalization rules
- Historical snapshot immutability
- PDF generation and authorization
- Email recipient/attachment mapping
- Bulk-send idempotency, retries, partial failures, and rate limiting
- CSV/XLSX import validation if included
- Database constraints and migrations

Add integration tests for critical flows and end-to-end tests for:
1. Super Admin creates an Admin.
2. Admin creates employee records and a payroll period.
3. Admin enters payroll data, previews calculations, and finalizes.
4. Admin generates/downloads a payslip.
5. Admin sends one payslip.
6. Admin sends a batch and sees per-recipient status.
7. Employee logs in and can access only their own payslips.
8. Employee cannot access another employee’s PDF or payroll record.
9. Deactivated users cannot authenticate or use existing sessions.

Use test SMTP/mock transport in automated tests. Never send real payslips from tests.

## 17. Deployment and operations

- Provide migrations and a clear migration command.
- Provide `.env.example`, setup instructions, and production deployment instructions.
- Include health/readiness checks that do not disclose secrets or personal data.
- Ensure database migrations are run as a controlled deployment step, not concurrently by every app instance.
- If using a worker, document and configure it as a separate production process with restart policy and graceful shutdown.
- Configure structured logs, log rotation, monitoring, and alerts for failed email batches and job backlog.
- Configure Neon backups/PITR according to the selected plan and document restore testing.
- Document secret rotation for JWT and SMTP credentials. JWT secret rotation should account for existing sessions.
- Do not use development mode, debug logging, or permissive CORS in production.
- Include a deployment checklist and rollback strategy.

## 18. Implementation milestones

1. **Status: Completed.** Inspect repository and establish conventions.
2. **Status: Completed.** Define schema, migrations, seed/bootstrap process, and environment validation. Migration files are in the repo. Apply them with `npm run db:migrate` after `DIRECT_URL` is set. Create the first Super Admin with `npm run bootstrap:super-admin`.
3. **Status: Completed.** Implement authentication, session revocation, and RBAC.
4. **Status: Completed.** Implement employee and company management. Admins can create, search, edit, and deactivate employees. Sensitive identifiers stay off the list. Super Admins edit company settings. Portal logins are created from Users.
5. **Status: Completed.** Implement payroll periods, payroll entry, calculations, validation, and finalization. Staff can create a month, add active employees, preview and save drafts, and finalize a period. Totals are recalculated on the server. Finalized payslips are immutable snapshots. Corrections use void-and-reissue. A missed employee after finalization needs a new period. Apply migrations and create the first Super Admin before anyone can sign in and use payroll.
6. **Status: Completed.** Implement PDF generation from immutable snapshots. A finalized or voided payslip downloads on demand from its snapshot. Drafts have no PDF. Staff can download any payslip; an employee can download only their own. Responses use `Cache-Control: private, no-store`. Downloads are audited without salary figures.
7. **Status: Completed.** Implement individual and bulk email delivery with durable status tracking. Staff can queue one payslip, a selected group, or every eligible employee in a finalized period. Each message goes to that employee’s work email with only their PDF attached. A database queue sends in chunks of 10 via `npm run email:work`. Failed sends can be retried; a sent payslip is emailed again only through an explicit resend.
8. **Status: Completed.** Implement role-specific UI and dashboards. Employees see their own finalized and voided payslips, can download those PDFs, and see a restricted profile. Admins see payroll-period and email summaries without salary figures. Super Admins manage logins, read the audit log, and see whether mail is configured without revealing secrets.
9. **Status: Completed.** Security headers and the remaining privacy controls are in place. Responses send a Content-Security-Policy that allows the theme script, plus `nosniff`, frame denial, and HSTS in production. `unsafe-eval` and websocket sources are limited to development. Each request gets an `x-request-id`. `GET /health` and `GET /health/ready` are public; readiness returns only `ok` or `unavailable`. Email sends, resends, and retries are limited to 30 actions per 15 minutes per person. Failure logs record the error name only. Employee lists omit PAN, UAN, and ESI.
10. **Status: Completed.** Automated tests cover payroll rounding and boundaries, snapshot copies, cookie flags, the content security policy, employee-list fields, email planning, PDF rendering, and access rules. `npm test` (25 tests), typecheck, lint, and the production build passed. `prisma validate` passed, and `prisma migrate deploy` reported no pending migrations. Tests do not sign in against a database, so the nine end-to-end flows in section 16 are not automated. CSV/XLSX import remains out of scope.
11. **Status: Completed.** The README replaces the starter text with setup, a one-time migration step, Super Admin bootstrap, the email worker, health checks, secret rotation, a Neon restore rehearsal, a deployment checklist, and rollback. The restore rehearsal is documented and has not been performed. The app is not claimed production-ready under section 19 until that rehearsal is done and the Prisma CLI audit finding is accepted or cleared without a Prisma 8 upgrade.

## 19. Definition of done

Do not claim production-ready until:
- The complete core workflows work end-to-end.
- Migrations apply cleanly to a fresh database.
- Typecheck, lint, tests, and production build pass.
- Authorization and IDOR tests pass.
- Email batches handle partial failures and retries without accidental duplicate sends.
- PDF data matches finalized database values.
- Secrets are environment-only and cookies have correct production flags.
- Deployment, backup/restore, and rollback instructions exist.
- Any unresolved security or payroll-rule assumptions are explicitly documented.

## 20. Important implementation constraints

- Do not invent payroll statutory rules, tax rates, or deductions.
- Do not silently modify finalized historical payslips.
- Do not send one employee’s payslip to another employee.
- Do not expose JWTs to JavaScript or store them in localStorage/sessionStorage.
- Do not trust client-provided roles, employee IDs, totals, recipients, or PDF paths.
- Do not create default credentials or commit secrets.
- Do not use public storage for payslip PDFs.
- Keep the implementation maintainable, typed, tested, and documented.
