# Business MIS — Engineering Development Plan (Revision 3, Release 1)

Stack: React + Tailwind (Vite) · Node.js 22 + Express 5 (TypeScript) · PostgreSQL 16. Shared DB, separate staff auth realm, `mis.*` + `core.tenants`.

## 0. Status legend
✅ built and tested here · 🟡 built, not covered by automated tests · ⬜ planned (not built)

## 1. Database (`db/migrations`, `api/src/bootstrap.ts`)
| ID | Task | Status |
|---|---|---|
| DB-1 | Migration runner (ordered SQL, `schema_migrations`, one transaction per file) | ✅ |
| DB-2 | `mis.roles`, `mis.staff` (status machine, lockout columns, `perm_version`, `is_super` check) | ✅ |
| DB-3 | `mis.modules/permissions/role_permissions` (data_scope own/all) synced from code manifests | ✅ |
| DB-4 | `mis.sessions` (hashed token, 12 h absolute, 30 min idle) | ✅ |
| DB-5 | `mis.audit_log` with trigger blocking UPDATE/DELETE | ✅ |
| DB-6 | `core.tenants` (client record), unique `upper(tax_id)`, trigram name index, `(owner, status)` index | ✅ |
| DB-7 | `mis.client_assignments` (one open assignment per client, history) | ✅ |
| DB-8 | Seed: manifests, template roles (Manager, Sales Executive), super admin from env (refuses a second) | ✅ |
| DB-9 | Separate DB roles/grants (`mis_app` without access to POS tables; POS role without `mis.*`) and RLS on POS tables | ⬜ |
| DB-10 | Partitioning/retention for `audit_log` | ⬜ |
| DB-11 | Staff profile avatar URL | ✅ |

## 2. API (`api/src`)
| ID | Task | Status |
|---|---|---|
| API-1 | Express app, security headers, JSON limit, CSRF header guard, error middleware (zod → 422 field errors, envelope `{success,message,data}`) | ✅ |
| API-2 | Auth: login (generic error, timing-equalised, lockout 5/15 min), logout, `/me`, forced password change, Argon2id | ✅ |
| API-3 | Session middleware + `need(permission)` + scope resolution (`own`/`all`); super bypass | ✅ |
| API-4 | Roles: list, create, set grants (validated, no escalation, system role locked), delete (blocked when in use) | ✅ |
| API-5 | Staff: create under role (temp password shown once, escalation guard), list, suspend/reactivate/deactivate (self, last-super, owns-clients guards; sessions revoked) | ✅ |
| API-6 | Clients: create (tenant shell + assignment, duplicate → 409 without leak), list (scope, search, status, pagination), get (scope → 404), reassign (transactional, history) | ✅ |
| API-7 | Append-only audit writes, actor/target snapshots, scoped activity API, search, date filters, pagination | ✅ |
| API-8 | MFA (TOTP), password reset by email, invite links, rate limiting per IP, idempotency keys, client update/status change | ⬜ |
| API-9 | Self-only profile updates with unique-email validation, HTTPS avatar URLs, profile audit events, and strong confirmed password changes | ✅ |

## 3. UI (`web/src`)
| ID | Task | Status |
|---|---|---|
| UI-1 | Sign-in, forced password change | 🟡 |
| UI-2 | Shell: sidebar generated from the user's permissions, user/role header, sign-out | 🟡 |
| UI-3 | Clients: search (debounced), status filter, status pills, pagination, empty/loading/error states, New client form with field errors, Reassign dialog | 🟡 |
| UI-4 | Staff: list with status, add staff (one-time temp password dialog), suspend/reactivate/deactivate | 🟡 |
| UI-5 | Roles & access: role list, keyboard-accessible module tabs, scrollable permission switches, per-module bulk actions, "own/all" scope, create/delete role, audited saves | 🟡 |
| UI-6 | Keyboard shortcuts, command palette, theme picker, mobile polish, i18n | ⬜ |
| UI-7 | Activity log: permission-gated, self-scoped for staff, global for super admin, localized timestamps and filters | ✅ |
| UI-8 | Clients dashboard: scoped summary metrics, permission-aware shortcuts, latest 10 activity events, post-login landing view | ✅ |
| UI-9 | Profile details and avatar editor, audited updates, and confirmed current-password change form | ✅ |

## 4. Verification
| Layer | Result |
|---|---|
| Type safety | `tsc --noEmit` clean (API and web) |
| Integration tests (Vitest + Supertest, real PostgreSQL) | 12 tests: CSRF, generic login errors + lockout, forced password change, audit immutability and scope, client scoping + reassignment, duplicate tax ID, validation errors, escalation, grant validation, self/role-in-use protection, suspension revokes session |
| Web production build | succeeds |
| Not done | browser E2E (Playwright), load/performance tests, security scan, DB-grant isolation tests |

## 5. Run
```
createdb mis_dev; export DATABASE_URL=postgres://postgres:postgres@localhost:5432/mis_dev
cd api && npm i && npm run migrate && SUPER_EMAIL=you@example.com SUPER_PASSWORD='<set-a-unique-strong-password>' npm run seed && npm run dev
cd web && npm i && npm run dev        # http://localhost:5173 (proxies /api to :3001)
cd api && npm test                    # needs a `mis_test` database
```
First super-admin sign-in forces a password change.
