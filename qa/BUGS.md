# AbyteDesk ERP — Bug Register

_Last updated: 2026-09-11 — re-verified against current code; see qa/FINAL_QA_REPORT.md for the 2026-09-11 re-verification pass_

---

## P0 — BLOCKERS

---

### BUG-001
**Title:** Accounting endpoints crash at runtime — query non-existent tables and columns  
**Severity:** P0  
**Category:** Data Integrity / Broken Feature  
**Module:** Accounting  
**Status:** FIXED

**Steps to Reproduce:**
1. Navigate to Accounts → Cash Flow Statement
2. Navigate to Accounts → Account Statement
3. Navigate to Accounts → Payables Aging

**Expected:** Data displayed correctly  
**Actual:** SQL error on every call — `getCashFlowStatement` queries `receipt_voucher_lines` and `payment_voucher_lines` tables (do not exist); `getAccountStatement` queries columns `debit_amount`/`credit_amount` (schema uses `debit`/`credit`); `getPayablesAging` queries a `purchases` table (does not exist — should be `inv_purchase_vouchers`)

**Affected Files:** `controllers/accountingController.js` (getCashFlowStatement ~L1644, getAccountStatement ~L1805, getPayablesAging ~L1727)  
**Recommended Fix:** Fix column names and table references to match actual schema

---

### BUG-002
**Title:** Server-side unit_price not validated against product prices — any authenticated user can sell at any price  
**Severity:** P0  
**Category:** Financial Integrity / Security  
**Module:** POS / Sales  
**Status:** FIXED

**Steps to Reproduce:**
1. Log in as Cashier
2. POST /api/sales with valid items but unit_price: 0.01 for a product priced at 1000

**Expected:** 400 error — price does not match product price  
**Actual:** Sale recorded at client-supplied price; revenue permanently lost

**Affected Files:** `controllers/salesController.js` ~L227  
**Recommended Fix:** Server-side lookup of product price; validate client price within acceptable tolerance

---

### BUG-003
**Title:** Purchase return deducts stock without availability check — stock goes unconditionally negative  
**Severity:** P0  
**Category:** Inventory Integrity  
**Module:** Purchase Returns  
**Status:** FIXED

**Steps to Reproduce:**
1. Create a purchase voucher for 10 units of Product A
2. Sell 10 units (stock = 0)
3. Create a purchase return for 10 units of the same voucher

**Expected:** 400 error — insufficient stock to return  
**Actual:** `UPDATE inventory SET available_stock = available_stock - 10` executes unconditionally; stock = -10

**Affected Files:** `controllers/purchaseReturnController.js` L90-98  
**Recommended Fix:** Add SELECT...FOR UPDATE before deduction; add WHERE available_stock >= quantity_returned guard

---

### BUG-004
**Title:** CPV/CRV voucher numbers can duplicate — no DB-level uniqueness constraint  
**Severity:** P0  
**Category:** Financial Integrity  
**Module:** Accounting  
**Status:** FIXED (2026-09-11)

**Steps to Reproduce:**
1. Two concurrent POST /api/accounting/payment-vouchers requests
2. Both read MAX(voucher_number) simultaneously before either commits
3. Both compute same voucher number and both succeed

**Expected:** Unique voucher numbers  
**Actual:** Two vouchers with identical numbers; account balances double-counted

**Affected Files:** `controllers/accountingController.js` (createPaymentVoucher, createReceiptVoucher); `database/schema.sql` (payment_vouchers, receipt_vouchers — missing UNIQUE constraint)  
**Fix Applied (2026-09-11):** UNIQUE constraint on `voucher_number` was already added via migration v24 (`add_unique_constraints_voucher_numbers`) and confirmed present on the live DB, but the two controller functions had no retry logic, so a losing concurrent request surfaced as a raw 500 instead of getting a fresh number. Added `nextCPVNumber`/`nextCRVNumber` + a retry-on-`ER_DUP_ENTRY`/deadlock loop (up to 5 attempts), matching the existing `nextPVNumber()` pattern in `purchaseVoucherController.js`. Also added the `UNIQUE` keyword directly to `database/schema.sql` so fresh installs get it without relying on the migration.
**Verification:** Fired 5 truly concurrent CPV creations and 5 concurrent CRV creations against the running backend — all 10 succeeded with 10 unique voucher numbers, no duplicates, no errors. (A synthetic 20-way burst was also tried; it surfaced two unrelated pre-existing issues, logged as BUG-038 and BUG-039 below, rather than any duplicate-number leak.)

---

### BUG-005
**Title:** `products.stock_quantity` and `inventory.available_stock` can diverge permanently — no atomic dual-table update  
**Severity:** P0  
**Category:** Data Integrity  
**Module:** All inventory operations  
**Status:** OPEN

**Description:** Every stock mutation updates two tables sequentially. A crash or concurrent write between the two UPDATE statements permanently diverges the two stock columns. POS reads `products.stock_quantity`; inventory reports read `inventory.available_stock`. No reconciliation mechanism exists.

**Affected Files:** All inventory controllers  
**Recommended Fix:** Wrap both UPDATEs in a single transaction (already done in most places); add periodic reconciliation query

---

## P1 — CRITICAL

---

### BUG-006
**Title:** Tax and additional charges calculated on pre-discount subtotal — customers overcharged  
**Severity:** P1  
**Category:** Financial Calculation  
**Module:** POS / Sales  
**Status:** FIXED

**Description:** `taxAmt = round2(subtotal * taxRate)` — tax is on full subtotal before discount. If a customer gets 20% discount and 10% tax, they pay tax on the undiscounted amount. Correct: `taxAmt = round2((subtotal - discountAmt) * taxRate)`.

**Affected Files:** `controllers/salesController.js` L248-250

---

### BUG-007
**Title:** Bundle discount accepted from client without server-side verification  
**Severity:** P1  
**Category:** Financial Integrity / Security  
**Module:** POS / Sales  
**Status:** PARTIAL

**Description:** `applied_bundles[].discount_amount` taken directly from client request. An authenticated user can submit arbitrarily large bundle discounts to make net_amount approach 0.

**Affected Files:** `controllers/salesController.js` L253

---

### BUG-008
**Title:** Deleting a PENDING sale incorrectly restores stock that was never deducted  
**Severity:** P1  
**Category:** Inventory Integrity  
**Module:** POS / Sales  
**Status:** FIXED

**Description:** `deleteSale` calls `batchUpdateStock(conn, items, '+')` for ALL sale statuses including `pending`. But pending sales never deduct stock (stock deduction happens only on `completeSale`). Deleting a pending sale adds phantom stock.

**Affected Files:** `controllers/salesController.js` L713-751

---

### BUG-009
**Title:** `refundSale` allows refunding PENDING sales — adds phantom stock  
**Severity:** P1  
**Category:** Inventory Integrity  
**Module:** POS / Sales  
**Status:** FIXED

**Description:** `refundSale` only blocks re-refunding (`status === 'refunded'`). A pending sale can be refunded; stock is restored even though it was never deducted.

**Affected Files:** `controllers/salesController.js` L1005-1006

---

### BUG-010
**Title:** Return controller does not restore variant_inventory or product_variants stock  
**Severity:** P1  
**Category:** Inventory Integrity  
**Module:** Returns  
**Status:** FIXED

**Description:** Return stock restoration only updates `inventory` and `products` tables. `variant_inventory.available_stock` and `product_variants.stock_quantity` are never restored. Every variant-item return permanently understates variant stock.

**Affected Files:** `controllers/returnController.js` L89-96

---

### BUG-011
**Title:** Cash register expected balance formula omits total_cash_in and total_cash_out  
**Severity:** P1  
**Category:** Financial Calculation  
**Module:** Cash Register  
**Status:** FIXED

**Description:** `expected = opening_balance + cash_sales - totalExpenses`. Missing: `+ total_cash_in - total_cash_out`. Every petty cash movement creates an unexplained discrepancy at shift closing.

**Affected Files:** `controllers/registerController.js` L144-151

---

### BUG-012
**Title:** Stock transfer cancel has no transaction — race with concurrent approve  
**Severity:** P1  
**Category:** Data Integrity  
**Module:** Stock Transfers  
**Status:** FIXED

**Description:** `cancel` reads transfer status then updates it in two separate queries with no transaction. A concurrent `approve` that runs between the two can complete the transfer (deducting stock) while `cancel` then marks it cancelled — stock is gone but transfer shows cancelled.

**Affected Files:** `controllers/stockTransferController.js` L182-195

---

### BUG-013
**Title:** Stock adjustment: `inventory` table not locked before write — concurrent POS sales overwritten  
**Severity:** P1  
**Category:** Inventory Integrity  
**Module:** Stock Adjustments  
**Status:** FIXED (was fixed 2026-09-05 in commit 6348279; this doc had not been updated — corrected 2026-09-11)

**Description:** `products` is locked with FOR UPDATE but `inventory` is not. Concurrent POS sale deducting inventory runs between the adjustment's SELECT and UPDATE on inventory, setting it to an absolute value that overwrites the sale's deduction.

**Affected Files:** `controllers/stockAdjustmentController.js` L111-155
**Verification (2026-09-11):** `SELECT avg_cost FROM inventory WHERE product_id = ? FOR UPDATE` confirmed present before the inventory UPDATE (L151).

---

### BUG-014
**Title:** Trial balance excludes non-journalized CPV/CRV transactions  
**Severity:** P1  
**Category:** Financial Integrity  
**Module:** Accounting  
**Status:** FIXED (was fixed 2026-09-05 in commit 6348279; this doc had not been updated — corrected 2026-09-11)

**Description:** Trial balance only aggregates `journal_entry_lines`. Payment/receipt vouchers that update `accounts.current_balance` directly (without a journal entry) are excluded, causing the trial balance to not balance.

**Affected Files:** `controllers/accountingController.js` (~L592)
**Verification (2026-09-11):** `getTrialBalance` / `getTrialBalance6Col` confirmed to `UNION ALL` journal-entry lines with non-journalized CPV/CRV direct-balance movements.

---

### BUG-015
**Title:** branch_id hardcoded to NULL on every sale INSERT — branch isolation broken  
**Severity:** P1  
**Category:** Data Integrity  
**Module:** POS / Sales  
**Status:** FIXED

**Description:** `INSERT INTO sales` passes `null` for branch_id unconditionally. All sales records are branch-unscoped regardless of the logged-in user's branch. Branch-level reporting is permanently broken.

**Affected Files:** `controllers/salesController.js` L333

---

### BUG-016
**Title:** refundSale has no role authorization check — cashiers can self-authorize refunds  
**Severity:** P1  
**Category:** Security / Authorization  
**Module:** POS / Sales  
**Status:** FIXED

**Description:** `deleteSale` checks Admin role; `refundSale` has no role check. Any cashier with `sales.pos` permission can refund any sale, enabling fraud.

**Affected Files:** `controllers/salesController.js` L991

---

## P2 — HIGH

---

### BUG-017
**Title:** Daily and date-range reports include refunded/cancelled sales — inflated revenue  
**Severity:** P2  
**Status:** FIXED  
**Module:** Reports  
**Description:** `dailyReport` and `dateRangeReport` lack `WHERE status = 'completed'` filter. Revenue figures are overstated.  
**Affected Files:** `controllers/reportController.js` L17-78

---

### BUG-018
**Title:** Inventory report uses selling price for stock valuation instead of cost price  
**Severity:** P2  
**Status:** FIXED  
**Module:** Reports  
**Description:** `stock_value = p.price * available_stock` uses selling price. Should use `avg_cost` from inventory table.  
**Affected Files:** `controllers/reportController.js` L133-148

---

### BUG-019
**Title:** Dashboard reports use server timezone (UTC) instead of tenant timezone (UTC+5)  
**Severity:** P2  
**Status:** OPEN  
**Module:** Dashboard / Reports  
**Description:** "Today's" transactions include yesterday's last 5 hours and miss today's first 5 hours for Pakistani businesses.  
**Affected Files:** `controllers/reportController.js` (~L170)

---

### BUG-020
**Title:** Cashier can bypass 50% discount cap via bundle discounts  
**Severity:** P2  
**Status:** OPEN  
**Module:** POS / Sales  
**Description:** Explicit discount is checked against 50% cap, but bundle discounts are not. Combined they can exceed 50%.  
**Affected Files:** `controllers/salesController.js` L256-267

---

### BUG-021
**Title:** Return controller allows zero-quantity returns — creates ghost records  
**Severity:** P2  
**Status:** FIXED  
**Module:** Returns  
**Description:** `returnQty = item.quantity || item.quantity_returned || 0` — if both are 0, a zero-quantity return record is inserted, polluting return tracking.  
**Affected Files:** `controllers/returnController.js` L60-61

---

### BUG-022
**Title:** Refund amount calculation uses unrounded floating-point arithmetic  
**Severity:** P2  
**Status:** FIXED  
**Module:** Returns  
**Description:** `refund_price = unit_price * returnQty` is unrounded. Accumulated floating-point noise in totalRefund stored in DB.  
**Affected Files:** `controllers/returnController.js` L71-72

---

### BUG-023
**Title:** Cash register update misses non-cash/non-card payment methods  
**Severity:** P2  
**Status:** OPEN  
**Module:** POS / Cash Register  
**Description:** Register only updated for `'cash'` and `'card'` payment types. `split`, `mobile_wallet`, etc. silently skip the register.  
**Affected Files:** `controllers/salesController.js` L377-387

---

### BUG-024
**Title:** creditSaleController accepts paid_amount > total_amount, creating negative balance_due  
**Severity:** P2  
**Status:** FIXED  
**Module:** Credit Sales  
**Description:** No validation that `paidAmt <= totalAmt`. Negative `balance_due` blocks all future payments.  
**Affected Files:** `controllers/creditSaleController.js` L154-157

---

### BUG-025
**Title:** Credit sale payment amounts accumulate floating-point drift — fully paid sales stay 'partial'  
**Severity:** P2  
**Status:** FIXED  
**Module:** Credit Sales  
**Description:** Multiple partial payments accumulate floating-point errors in `balance_due`. Status stays 'partial' for fully paid debts.  
**Affected Files:** `controllers/creditSaleController.js` L237-239

---

### BUG-026
**Title:** `overdue=false` query parameter still applies overdue filter (truthy string bug)  
**Severity:** P2  
**Status:** FIXED  
**Module:** Credit Sales  
**Description:** `if (overdue)` tests string truthiness. `"false"` is truthy; overdue filter always applied.  
**Affected Files:** `controllers/creditSaleController.js` L52-55

---

### BUG-027
**Title:** Customer create: customer insert and address insert not in same transaction  
**Severity:** P2  
**Status:** FIXED  
**Module:** Customers  
**Description:** Customer created without transaction. Server crash between INSERT customers and INSERT customer_addresses leaves customer with no address.  
**Affected Files:** `controllers/customerController.js` L118-131

---

### BUG-028
**Title:** Soft-deleted customers shown in all queries  
**Severity:** P2  
**Status:** FIXED  
**Module:** Customers  
**Description:** `deleted_at` column exists but `WHERE deleted_at IS NULL` never applied.  
**Affected Files:** `controllers/customerController.js`

---

### BUG-029
**Title:** Inventory report: low_stock threshold hardcoded to 10 — ignores store_settings  
**Severity:** P2  
**Status:** FIXED  
**Module:** Reports / Inventory  
**Description:** `available_stock < 10` hardcoded. `store_settings.low_stock_threshold` is ignored.  
**Affected Files:** `controllers/reportController.js` L143

---

### BUG-030
**Title:** Health endpoint publicly exposes memory usage, DB status, and uptime  
**Severity:** P2 (Security)  
**Status:** FIXED (was fixed 2026-09-05 in commit 6348279; this doc had not been updated — corrected 2026-09-11)  
**Module:** Security  
**Description:** `GET /api/health` requires no authentication; exposes internal metrics.  
**Affected Files:** `server.js` L236
**Verification (2026-09-11):** `app.get('/api/health', authenticate, ...)` confirmed at server.js:314. (`/api/ping` and `/api/ready` remain intentionally public/unauthenticated liveness probes — no metrics exposed.)

---

### BUG-031
**Title:** Schema missing UNIQUE constraint on suppliers.supplier_name — duplicates possible under concurrency  
**Severity:** P2  
**Status:** OPEN  
**Module:** Suppliers  
**Description:** Application-layer uniqueness check is subject to TOCTOU race. Two concurrent inserts create duplicate supplier names.  
**Affected Files:** `database/schema.sql`

---

### BUG-032
**Title:** credit_sales table has redundant balance and balance_due columns — can diverge  
**Severity:** P2  
**Status:** OPEN  
**Module:** Credit Sales / DB Schema  
**Description:** Both `balance` and `balance_due` exist; no constraint ensures they agree.  
**Affected Files:** `database/schema.sql`

---

## P3 — MEDIUM

---

### BUG-033
**Title:** opening_balance and closing_balance accept non-numeric strings → NaN stored in DB  
**Severity:** P3  
**Status:** FIXED  
**Module:** Cash Register  
**Description:** String like "abc" passes bounds check; stored as NaN; all shift calculations become NaN.  
**Affected Files:** `controllers/registerController.js` L73, L115

---

### BUG-034
**Title:** Printers table defined twice in schema.sql  
**Severity:** P3  
**Status:** OPEN  
**Module:** Schema  
**Affected Files:** `database/schema.sql` (lines ~288 and ~1304)

---

### BUG-035
**Title:** Token number generation has no lock — duplicate tokens on concurrent orders  
**Severity:** P3 (was P1 in audit; reduced as kitchen tokens are non-financial)  
**Status:** OPEN  
**Module:** POS  
**Affected Files:** `controllers/salesController.js` L295-299

---

### BUG-036
**Title:** SSL/TLS disabled (`rejectUnauthorized: false`) when DB_SSL_CA not configured  
**Severity:** P3 (Low for LAN deployment)  
**Status:** OPEN  
**Module:** Security  
**Affected Files:** `config/database.js` L27-31

---

### BUG-037
**Title:** /api/metrics endpoint unprotected when METRICS_TOKEN env var not set  
**Severity:** P3  
**Status:** OPEN  
**Module:** Security  
**Affected Files:** `services/metricsService.js` L85-89

---

### BUG-038
**Title:** DB connection pool (limit 10) exhausts under concurrent load, causing legitimate users to be logged out ("Token has been revoked")  
**Severity:** P2  
**Category:** Reliability / Availability  
**Module:** Backend Infrastructure  
**Status:** FIXED (2026-09-12)

**Steps to Reproduce:**
1. Fire ~20 simultaneous authenticated requests (e.g. concurrent voucher creation, or several cashiers hitting POS at once)
2. Pool (`connectionLimit: 10`, `acquireTimeout: 30000`) saturates
3. `tokenBlacklist.isBlacklisted()` (`services/tokenBlacklist.js`) cannot acquire a connection within 30s, its query fails
4. Its catch block is fail-closed ("treat as blacklisted for safety") → `authenticate` middleware returns 401 "Token has been revoked. Please login again."

**Expected:** Under load, requests should queue briefly or fail with a retriable 503, not silently log the user out.
**Actual:** Legitimate, still-valid sessions get a false 401 that looks identical to an intentional logout — confusing for end users and would repeat any time real concurrent load (multi-cashier POS, batch operations) exceeds the pool.

**Affected Files:** `config/database.js` L36-44 (`connectionLimit: 10`, `acquireTimeout: 30000`); `services/tokenBlacklist.js` L78-83 (fail-closed on DB error)
**Fix Applied (2026-09-12):**
- `config/database.js`: `connectionLimit` raised 10 → 25 (env-overridable via `DB_POOL_LIMIT`), `acquireTimeout` cut 30000ms → 8000ms (env-overridable via `DB_POOL_ACQUIRE_TIMEOUT`) so a saturated pool fails fast instead of stalling each request for 30s.
- `services/tokenBlacklist.js`: added a 15s positive ("confirmed not blacklisted") in-memory cache in front of the DB check, so a burst of requests on the same token doesn't hit the pool once per request. On a DB error, a result verified clean within the last 60s is reused instead of failing closed immediately — only a token with no recent clean verification still fails closed. The cache entry for a token is deleted the instant it's actually blacklisted (logout), so revocation still takes effect immediately; a periodic sweep in `cleanExpired()` prevents unbounded cache growth.
**Verification:** Re-ran the same 20-simultaneous-request burst that originally surfaced this — **false-401 count: 0** (was 7/20). Remaining failures under that synthetic burst are plain duplicate-key retries exhausting (`errno 1062`), not pool/auth related. At realistic concurrency (5 simultaneous requests) — 0 failures. Full backend Jest suite (120/120) still passes.
**Note:** Surfaced only under an artificial 20-simultaneous-identical-request burst while stress-testing the BUG-004 fix — not hit at realistic concurrency (5 simultaneous requests). Not blocking for LAN/small-deployment use, but worth tuning before higher-concurrency production use.

---

### BUG-039
**Title:** E2E test harness (`main-app/e2e`) could not actually run — wrong hardcoded password + SPA navigation wait bug
**Severity:** P2 (Test Infrastructure)
**Category:** Test Infrastructure
**Module:** E2E / QA
**Status:** FIXED (2026-09-11)

**Description:** `global-setup.ts` hardcoded the password `admin123`, while the seeded admin account's password is `12345678` (and `tests/helpers/auth.ts` already correctly read `TEST_PASSWORD` from env) — so the Playwright global setup's login always failed, and every spec depending on `auth-state.json` would have failed too. Separately, both `global-setup.ts` and `helpers/auth.ts` used `page.waitForURL()` to detect a successful login, which waits for a real navigation `load` event; this app's React Router client-side redirect never fires one, so even a successful login timed out.

**Affected Files:** `main-app/e2e/global-setup.ts`, `main-app/e2e/tests/helpers/auth.ts`
**Fix Applied:** `global-setup.ts` now reads `TEST_EMAIL`/`TEST_PASSWORD` from env (same convention as `helpers/auth.ts`, default password corrected). Both files now detect login success by polling `window.location.href` via `page.waitForFunction()` instead of `waitForURL()`.
**Verification:** Full suite run after the fix — **67/67 Playwright E2E tests passed** (see qa/FINAL_QA_REPORT.md).

---
