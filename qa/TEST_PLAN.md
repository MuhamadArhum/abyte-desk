# AbyteDesk ERP — QA Test Plan

**Version:** 1.0  
**Date:** 2026-09-05  
**Project:** AbyteDesk ERP (Multi-tenant SaaS POS/ERP)

---

## 1. Purpose & Scope

This document defines the QA strategy for AbyteDesk ERP — a multi-tenant SaaS system built on Node.js/Express, React/TypeScript, and MariaDB. It covers test types, environment requirements, per-module coverage targets, and pass/fail criteria.

**In scope:** All server-side API endpoints, frontend UI flows, and cross-module data integrity for the modules listed in Section 4.

---

## 2. Test Strategy

| Layer | Tooling | Goal |
|-------|---------|------|
| **Unit** | Jest (backend), Vitest (frontend) | Isolate business logic — controllers, services, utility functions. DB and logger are mocked. |
| **Integration** | Jest + Supertest | Test full HTTP request/response cycle with mocked DB pools. Verify middleware chains (auth, module guard, permission guard). |
| **End-to-End** | Playwright (planned) | Critical user journeys: login → sale → receipt, purchase order → stock update, payroll run. |
| **Manual / Exploratory** | Checklist-driven | Edge cases, UX validation, tenant isolation verification, role-based access spot checks. |

All backend tests follow the pattern: `jest.mock('../../config/database')` + `buildTestApp()` helper. Tests live in `tests/unit/` and `tests/integration/`.

---

## 3. Test Environment

| Component | Requirement |
|-----------|-------------|
| Runtime | Node.js 20+ |
| Database | MariaDB (local instance) — `abyte_master` + per-tenant DBs |
| Backend test runner | Jest + Supertest |
| Frontend test runner | Vitest |
| E2E runner | Playwright (planned) |
| CI | GitHub Actions (on push to `main`) |
| Env file | `.env` with `JWT_SECRET`, `DB_*`, `EMAIL_*`, `PORT=5000` |

Test databases are isolated from production. Migration service (`migrationService.js`) must be run against test DBs before each full suite execution.

---

## 4. Module Test Coverage Plan

| Module | Test Type | Priority | Status |
|--------|-----------|----------|--------|
| Auth (login, JWT, tenant lookup, Level-4 restriction) | Unit, Integration | Critical | Partial |
| Sales / POS (checkout, tax, discount, receipt) | Unit, Integration, E2E | Critical | Partial |
| Inventory (stock in/out, adjustments, low-stock alerts) | Unit, Integration | High | Partial |
| Purchase Orders (create, receive, supplier invoice) | Unit, Integration | High | Not started |
| Returns — Sales & Purchase | Unit, Integration | High | Not started |
| Cash Register (open/close, float, session summary) | Unit, Integration | High | Not started |
| Credit Sales (credit limit, aging, payment collection) | Unit, Integration | High | Not started |
| Stock Transfers (branch-to-branch, approval flow) | Unit, Integration | Medium | Not started |
| Accounting (journal entries, ledger, trial balance) | Unit, Integration | High | Not started |
| Reports (sales, profit, stock, HR reports) | Integration, Manual | Medium | Not started |
| HR / Payroll (employees, attendance, payroll run) | Unit, Integration | Medium | Not started |
| Deliveries (dispatch, tracking, delivery confirmation) | Integration, Manual | Medium | Not started |
| Quotations (create, convert to sale, expiry) | Unit, Integration | Low | Not started |
| Restaurant (tables, KOT, waiter app sync) | Integration, Manual | Medium | Not started |
| Multi-tenant isolation | Integration, Manual | Critical | Partial |
| Role & Permission Guards | Unit, Integration | Critical | Partial |

---

## 5. Risk Areas

- **Financial calculations** — Tax, discount, and payroll arithmetic must be validated against exact decimal precision. Rounding errors can silently corrupt ledger balances.
- **Stock integrity** — Concurrent sales or stock adjustments can produce negative stock or double-deductions. Requires transaction-level locking tests.
- **Race conditions / concurrent writes** — Multiple POS sessions writing to the same cash register or inventory row simultaneously.
- **Tenant isolation** — A query escaping its AsyncLocalStorage tenant context could read or write another tenant's data. This is the highest-severity class of bug.
- **JWT / auth edge cases** — Expired tokens, mismatched `tenant_db` in payload, Level-4 account restrictions bypassing module guards.
- **Migration consistency** — Schema migrations applied partially (e.g., network drop mid-run) can leave tenant DBs in inconsistent states.

---

## 6. Out of Scope

- Load / performance / stress testing
- Mobile app (waiter-app) automated UI testing
- Printer agent (Electron) automated testing
- Admin panel backend (separate service, separate test cycle)
- Browser compatibility matrix (target: latest Chrome/Edge only)

---

## 7. Pass/Fail Criteria

**A build passes QA when all of the following are true:**

- All existing unit and integration tests pass with exit code 0.
- No new test failures introduced by the changeset.
- Code coverage does not drop below **70%** on critical modules (Auth, Sales, Inventory, Accounting).
- No open **Critical** or **High** severity bugs related to financial accuracy, stock integrity, or tenant isolation.
- Manual checklist items for the affected module are signed off.
- E2E smoke suite (login → sale → logout) completes without error.

**A build fails QA if:**

- Any test file reports a failure or uncaught exception.
- A tenant isolation breach is detected (data leaking across tenant DBs).
- A financial calculation produces a result differing from expected by more than 0.01 of the base currency unit.
- A permission guard can be bypassed without a valid role/module subscription.
