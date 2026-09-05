# Security Audit Report — AbyteDesk ERP

**Date:** 2026-09-05
**System:** AByte ERP (Node.js/Express + MariaDB, multi-tenant SaaS POS/ERP)
**Scope:** Authentication, authorization, injection surface, financial controls, infrastructure, data integrity
**Auditor:** Internal QA

---

## 1. Executive Summary

AbyteDesk ERP demonstrates a solid foundational security posture. Parameterized SQL throughout the codebase eliminates SQL injection risk. JWT-based authentication with a blacklist service, bcrypt password hashing, Helmet.js headers, and CORS configuration cover the most common web attack vectors. Role and permission middleware is consistently applied on protected routes.

Four open findings require remediation before a production hardening sign-off: an unauthenticated health endpoint, an optionally unguarded metrics endpoint, disabled SSL certificate verification under certain configurations, and systemic data-integrity gaps in concurrent financial writes (duplicate vouchers, dual-table stock divergence).

---

## 2. Authentication & Session Management

| Control | Status |
|---|---|
| Password hashing | bcryptjs — cost factor should be confirmed >= 12 for production |
| JWT signing | `jsonwebtoken` with `JWT_SECRET` from env — ensure >= 256-bit secret |
| Token revocation | Token blacklist service present; blacklist should be persisted (not in-memory) across restarts |
| Token payload | Carries `tenant_db`, `tenant_id`, `modules`, `branch_id` — minimal, appropriate |
| Login brute-force | Rate limiting applied globally; recommend dedicated stricter rate limit on `/api/auth/login` |

No token replay or session fixation issues identified. JWT expiry should be confirmed short (recommended <= 8 h for POS sessions).

---

## 3. Authorization & Access Control

| Control | Status |
|---|---|
| Role hierarchy | Admin (full bypass), Manager, Cashier — enforced via `requirePermission` middleware |
| Permission middleware | Applied per-route; HTTP method auto-maps to CRUD sub-key |
| Branch isolation | Non-admin `req.branchId` scoping enforced in controllers |
| Module gating | `requireModule` middleware guards billable features server-side |
| Refund role check | **FIXED (BUG-016)** — `refundSale` now restricted to Admin/Manager |

Authorization architecture is well-structured. Admin bypass is intentional and documented.

---

## 4. Input Validation & Injection Prevention

| Control | Status |
|---|---|
| SQL injection | All queries use parameterized MariaDB driver — no string-concatenated WHERE clauses found |
| Price tampering | **FIXED (BUG-002)** — `unit_price` now looked up server-side; client-supplied price is ignored |
| General input validation | Partial — field presence checked, but type/range validation is inconsistent across controllers |
| File upload surface | Not identified in scope — verify if applicable |

**Gap:** Type and range validation (e.g., negative quantities, out-of-range discount percentages beyond server-enforced caps) should be audited systematically across all POST/PUT endpoints.

---

## 5. Financial Integrity Controls

Post-fix state is significantly improved:

- `unit_price` is now fetched from the database on every sale line, preventing price manipulation from the client.
- Discount caps are enforced server-side.
- Refund operations require Admin or Manager role (BUG-016 fixed).

Remaining concern: see Section 7 (concurrency and dual-table stock).

---

## 6. Infrastructure & Network Security

| Control | Status |
|---|---|
| HTTP security headers | Helmet.js applied |
| CORS | Configured — verify origin whitelist is restrictive in production |
| Rate limiting | Applied on all routes |
| SSL to database | **OPEN (BUG-036)** — `rejectUnauthorized: false` when `DB_SSL_CA` is not set; disables certificate verification, enabling MITM against the DB connection |
| Health endpoint | **OPEN (BUG-030)** — `GET /api/health` returns memory usage and DB status without authentication |
| Metrics endpoint | **OPEN (BUG-037)** — `/api/metrics` is unprotected when `METRICS_TOKEN` env var is not configured |

**BUG-036** is the highest-infrastructure risk: any network-adjacent attacker on the DB segment can intercept or spoof DB traffic when `DB_SSL_CA` is absent.

---

## 7. Data Integrity

| Issue | Status |
|---|---|
| Voucher uniqueness under concurrency | **OPEN (BUG-004)** — duplicate voucher numbers possible when concurrent requests generate the same sequence value before either commits |
| Dual-table stock divergence | **OPEN (BUG-005)** — stock is maintained across two tables without an atomic guarantee; partial failures can leave tables inconsistent |

Both issues require database-level controls (unique constraints + retry logic for BUG-004; transactions or triggers for BUG-005).

---

## 8. Security Findings Summary

| ID | Severity | Status | Description |
|---|---|---|---|
| BUG-002 | High | Fixed | `unit_price` not validated server-side — price manipulation possible |
| BUG-016 | High | Fixed | `refundSale` had no role check — any user could issue refunds |
| BUG-036 | High | Open | SSL `rejectUnauthorized: false` when `DB_SSL_CA` not set — MITM risk |
| BUG-004 | Medium | Open | Duplicate voucher numbers possible under concurrent writes |
| BUG-005 | Medium | Open | Dual-table stock divergence — no atomic guarantee across both tables |
| BUG-030 | Low | Open | `GET /api/health` exposes memory + DB status without authentication |
| BUG-037 | Low | Open | `/api/metrics` unprotected when `METRICS_TOKEN` not configured |

---

## 9. Recommendations

1. **BUG-036 (High — SSL):** Require `DB_SSL_CA` in production; fail server startup if not set. Never ship with `rejectUnauthorized: false`.
2. **BUG-004 (Medium — Vouchers):** Add a `UNIQUE` constraint on the voucher number column and implement application-level retry on duplicate-key error.
3. **BUG-005 (Medium — Stock):** Wrap all stock-mutating operations in a single MariaDB transaction that writes both tables atomically; add an integrity check job for divergence detection.
4. **BUG-030 / BUG-037 (Low — Endpoints):** Add `authenticate` middleware to `/api/health` or return only a static `{ status: "ok" }` without system internals. Make `METRICS_TOKEN` required, not optional.
5. **bcrypt cost factor:** Confirm >= 12 in production config; document the target in `.env.example`.
6. **Token blacklist persistence:** Move the blacklist store to Redis or the database so revoked tokens remain invalid across server restarts.
7. **Input validation layer:** Adopt a schema validation library (e.g., `zod` or `joi`) and apply it uniformly on all mutation endpoints — especially quantity, discount, and monetary fields.
8. **Login rate limiting:** Apply a tighter, dedicated rate limiter on `/api/auth/login` (e.g., 10 req/15 min per IP) separate from the global limit.
