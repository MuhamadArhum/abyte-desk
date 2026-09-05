# AbyteDesk ERP — Final Verification Report

_Report Date: 2026-09-05_
_Version: v1.0.5 (post-fix session)_
_Auditors: 6 independent parallel AI auditors + synthesis_
_Methodology: Red-team first — assume broken, try to prove it_

---

## 1. Executive Summary

A final independent verification was performed on AbyteDesk ERP after the previous QA session. Six parallel audit agents independently examined all backend controllers, database schema, test suite, security posture, and ERP business logic.

**The system is NOT production ready.**

| Category | Finding |
|----------|---------|
| Previous bugs verified | 37 total |
| Previously claimed FIXED, confirmed fixed | 13 |
| Previously claimed FIXED, NOT actually fixed | 2 (BUG-015, BUG-017 partial) |
| Partially fixed (gaps remain) | 8 |
| Still open (unchanged) | 14 |
| **New bugs discovered** | **36** |
| Fixed during this session | 8 |
| Remaining open after this session | 65 (31 new + known open) |
| **P0 remaining** | **3** |
| **P1 remaining** | **15** |

---

## 2. System Overview

AbyteDesk ERP is a Node.js + Express + MariaDB single-tenant POS/ERP with React frontend.

| Component | State |
|-----------|-------|
| Core POS (createSale) | Functional, regression in completeSale fixed |
| Purchase Vouchers | Functional but missing validation and no-branch-scope |
| Purchase Returns | Stock correctly guarded; **no journal entry created** |
| Sales Returns | Functional |
| Cash Register | Partially functional (split/mobile_wallet payments untracked) |
| Accounting (CPV/CRV) | Partially functional; trial balance broken; CRV group delete had sign bug (fixed) |
| Supplier Balance | **Not implemented** — no balance column in suppliers table |
| Reports | Dashboard fixed; productReport fixed; payables aging incorrect |
| Auth/Security | JWT auth solid; module gating is a passthrough stub |
| Automated Tests | 120 tests passing across 7 files (45 controllers untested) |

---

## 3. Previous QA Issues Reviewed

All 37 bugs from the previous QA session (BUG-001 through BUG-037) were independently verified by code inspection. Results are detailed in FINAL_REGRESSION_MATRIX.md.

---

## 4. Previous Fixes Verification

### 4.1 Fixes Confirmed Correct

**BUG-001** (P0): accountingController.js now correctly references `receipt_vouchers`, `payment_vouchers`, `inv_purchase_vouchers` and correct column names. Runtime crash eliminated.

**BUG-006** (P1): `createSale` computes tax on `subtotal - discount - bundleDiscount` base. Correct.

**BUG-008/009** (P1): Pending sale deletion no longer restores stock; refundSale blocks pending sales.

**BUG-010** (P1): `variant_inventory` and `product_variants` both restored on return. Correct.

**BUG-011** (P1): Cash register expected balance now includes `+totalCashIn -totalCashOut`. Correct.

**BUG-012** (P1): Stock transfer cancel uses `FOR UPDATE` inside transaction. Race condition resolved.

**BUG-016** (P1): refundSale gated to Admin/Manager. Correct.

**BUG-018** (P2): Inventory report uses `avg_cost` for valuation. Correct.

**BUG-022** (P2): Refund amounts rounded per line. Correct.

**BUG-027** (P2): Customer + address inserts wrapped in single transaction. Correct.

**BUG-029** (P2): Low-stock threshold reads from `store_settings`. Correct.

**BUG-033** (P3): `isNaN(parseFloat(...))` validation added for register balances. Correct.

### 4.2 Fixes Claimed But NOT Implemented

**BUG-015** (P1 — CRITICAL): `authenticate` middleware SELECT query did not include `branch_id`. `req.user.branch_id` was always `undefined`, meaning `branch_id` was stored as `NULL` on every sale, and every non-admin query was effectively unscoped. **Fixed this session** — `branch_id` added to the SELECT.

**BUG-017** (P2): `dailyReport` and `dateRangeReport` were correctly fixed. However the dashboard `dashboardSummary` query used `status IN ('completed', 'refunded')`, including refunded revenue. **Fixed this session** — changed to `status = 'completed'`.

---

## 5. Regression Testing

The existing automated test suite (120 tests, 7 files) was run after all fixes. **All 120 tests pass.**

However, the automated suite provides very limited regression coverage:
- 45 controllers are in production; only 7 have any tests
- `salesCalculations.test.js` tests a local copy of logic, not the actual controller functions
- Stock deduction direction (add vs subtract) is never asserted
- No tests for accounting, credit sales, purchase vouchers, HR, or any financial calculation

Passing tests cannot be equated with correctness.

---

## 6. Sales Verification

### createSale
- Price validation: ✅ Server-side price lookup enforced. Minor gap: tolerance of max(0.02, 0.1%) is exploitable for small amounts.
- Tax calculation: ✅ Correctly applied on post-discount base.
- Branch isolation: ✅ Fixed (BUG-015) — branch_id now populated.
- Stock deduction: ✅ `batchValidateStock` uses `FOR UPDATE`.
- Pending status: ✅ Stock deducted only on complete, not on create.

### completeSale
- **REGRESSION FOUND AND FIXED**: Tax was recalculated on pre-discount `subTotal`, producing higher totals than `createSale` for the same cart. Fixed this session — taxable base now uses `subTotal - discount - bundleDiscount`.

### updateSaleItems
- **OPEN (FV-002)**: Trusts client-supplied `total_amount` if provided, bypassing server recalculation entirely. P2.

### refundSale
- ✅ Role gated (Admin/Manager only).
- ✅ Blocked on non-completed sales.

### deleteSale
- **OPEN (FV-003)**: No branch filter — Admins can delete sales from any branch. P2.

---

## 7. Purchase Verification

### Purchase Voucher Create
- Stock increase: ✅ Updates both `inventory` and `products` inside transaction.
- avg_cost race: ✅ Fixed this session — `FOR UPDATE` added to inventory SELECT.
- Item validation: **OPEN (FV-029)** — zero/negative quantity and negative price accepted without error.
- Branch isolation: **OPEN (FV-030)** — no `branch_id` column on `inv_purchase_vouchers`.
- PV number uniqueness: ⚠️ UNIQUE constraint added via migration v24; application-level TOCTOU still causes 500s under concurrency (FV-028 still open).
- Floating-point rounding: **OPEN (FV-033)** — intermediate calculations not rounded before journal entry creation.

### Purchase Order Receive
- **OPEN (FV-032)** — P1: Receiving stock via PO does not update `avg_cost`, `cost_price`, or `stock_layers`. Weighted-average cost is permanently wrong for any stock received via PO instead of direct purchase voucher.

---

## 8. Inventory Audit

**Inventory reconciliation formula tested manually:**
```
Opening Stock + Purchases - Sales + Sales Returns - Purchase Returns + Stock Adjustments = Expected
```

Gaps found:
- **BUG-005 (OPEN)**: `inventoryController.updateStock` writes to `inventory` and `products` in two separate unguarded queries — divergence possible on crash.
- **BUG-013 (OPEN)**: Stock adjustment locks `products` but not `inventory` row — concurrent POS sale can overwrite.
- **FV-032 (OPEN)**: PO receive doesn't update `avg_cost` — cost basis wrong after any PO receipt.
- **FV-034 (OPEN)**: `inventory.available_stock` is `INT` but purchase voucher items are `DECIMAL(10,3)` — fractional quantities silently truncated on receipt.

Inventory reconciliation: **PARTIAL FAIL**

---

## 9. Customer Balance Audit

Customer balance formula:
```
Opening Balance + Credit Sales - Payments - Returns = Expected Balance
```

Findings:
- Credit sales create records in `credit_sales` with `balance_due`. ✅
- Payments reduce `balance_due` with proper float-rounding (BUG-025 fixed). ✅
- `overdue` filter correctly handled (BUG-026 fixed). ✅
- **OPEN (FV-004)**: No guard preventing two `credit_sale` records for the same `sale_id` — receivable can be double-counted.
- **OPEN**: `getById` for customers doesn't filter `deleted_at IS NULL` (BUG-028 partial).

Customer balance: **CONDITIONAL PASS** (mostly correct, duplicate record edge case open)

---

## 10. Supplier Balance Audit

**Supplier balance formula:**
```
Opening Balance + Credit Purchases - Payments - Purchase Returns = Expected
```

Critical finding: **Supplier balance is not tracked at all.**

- `suppliers` table has no `balance` or `current_balance` column.
- `supplierController.addPayment` inserts into `supplier_payments` but updates no balance.
- Purchase voucher creates journal entries against `accounts.current_balance` (payable account) — but this is disconnected from the supplier record.
- Purchase returns create no journal entry at all (FV-027).
- Supplier payment creates no journal entry (FV-031).

**Supplier balance reconciliation: FAIL**

---

## 11. Payment Verification

- Cash payments: ✅ Register updated for `cash` and `card`.
- Split/mobile_wallet: **OPEN (BUG-023)** — register never updated; these payments are invisible to shift reconciliation.
- Credit sales payments: ✅ balance_due correctly reduced with float rounding.
- Overpayment prevention: ✅ BUG-024 fixed.

---

## 12. Returns Verification

### Sales Returns
- Stock restored: ✅ (including variants — BUG-010 fixed).
- Zero-quantity blocked: ✅ (BUG-021 fixed).
- Refund amount rounded: ✅ (BUG-022 fixed).
- totalRefund accumulation rounding: **OPEN (FV-009)** — P3 minor drift possible.
- Pending sale refund blocked: ✅ (BUG-009 fixed).

### Purchase Returns
- Stock availability checked (FOR UPDATE): ✅ (BUG-003 core fixed).
- Negative quantity guard: ✅ Fixed this session — stock-inflate exploit closed.
- Original PO quantity cap: **OPEN** — can return more than originally purchased.
- Journal entry: **OPEN (FV-027) — P0** — payable never reduced.

---

## 13. Expense Verification

- Expenses created/deleted: functionally correct.
- Branch scope: **OPEN (FV-013)** — shift expenses query sums all branches, not just the current register's branch.
- Expense date range: bounded by `opened_at` but no upper bound (open registers accumulate all time).

---

## 14. Financial Calculation Audit

| Calculation | Status |
|-------------|--------|
| Sale subtotal | ✅ Correct |
| Discount | ✅ Correct |
| Tax on post-discount base (createSale) | ✅ Fixed |
| Tax on post-discount base (completeSale) | ✅ Fixed this session |
| Tax on post-discount base (updateSaleItems) | ⚠️ Still trusts client total |
| Purchase voucher total | ⚠️ Unrounded intermediates |
| Refund amount | ✅ Rounded |
| Credit sale balance_due | ✅ Rounded |
| Cash register expected balance | ✅ Fixed (BUG-011) |
| Supplier payable | ❌ Not tracked |

---

## 15. Profit Verification

Profit calculation in `createSale` uses cost from stock layers (FIFO consumption logic). However:
- PO receive doesn't update avg_cost → cost basis wrong for PO-received stock.
- Weighted-average cost race on concurrent purchase vouchers → avg_cost can be wrong.

Profit figures are unreliable when stock was received via PO or concurrent purchase vouchers.

---

## 16. Reports Verification

| Report | Status |
|--------|--------|
| Daily Sales Report | ✅ status='completed' filter present |
| Date Range Report | ✅ status='completed' filter present |
| Dashboard Summary | ✅ Fixed this session (was including refunded) |
| Product Report | ✅ Fixed this session (was missing status filter) |
| Inventory Report | ✅ Uses avg_cost for valuation |
| Low-Stock Report | ✅ Uses store_settings threshold |
| Customer Report | ✅ |
| Payables Aging | ❌ Always shows full invoice amount; ignores payments |
| Trial Balance | ❌ Excludes non-journalized CPV/CRV (BUG-014) |
| Cash Flow Statement | ✅ Table references fixed (BUG-001) |
| Account Statement | ✅ Column references fixed (BUG-001) |

---

## 17. Data Integrity Audit

| Check | Result |
|-------|--------|
| Invoice number uniqueness (sales) | ✅ Named lock + transaction |
| CPV/CRV voucher uniqueness | ⚠️ UNIQUE constraint added via migration; TOCTOU still causes 500s |
| PV number uniqueness | ⚠️ UNIQUE constraint in schema; TOCTOU race causes 500s |
| Supplier name uniqueness | ⚠️ UNIQUE constraint added via migration v24 |
| Duplicate credit_sale per sale | ❌ No guard (FV-004) |
| stock_quantity ↔ available_stock divergence | ❌ No reconciliation (BUG-005) |
| Fractional quantity truncation | ❌ INT column truncates DECIMAL values |
| Orphan stock layers on PV delete | ❌ No FK (FV-022) |
| Supplier balance tracked | ❌ Not implemented |
| Payable reduced on purchase return | ❌ No journal entry |
| Payable reduced on supplier payment | ❌ No journal entry |

---

## 18. Authentication & Authorization

| Control | Status |
|---------|--------|
| JWT verification | ✅ HS256 with secret |
| Token blacklist on logout | ✅ SHA-256 hash, fails-closed |
| User re-fetched from DB per request | ✅ Role changes take immediate effect |
| branch_id populated on req.user | ✅ Fixed this session |
| Role authorization (Admin/Manager/Cashier) | ✅ |
| requirePermission per-route | ✅ DB-backed with cache |
| requireModule plan gating | ❌ No-op stub — all module gating bypassed via direct API |
| Password reset flow | ✅ Secure (random token, hashed, 1-hour TTL, email-safe) |
| Soft-deleted customer accessible by ID | ❌ BUG-028 partial |
| Admin can delete cross-branch sales | ❌ No branch filter on DELETE |

---

## 19. Security Red-Team

| Attack Vector | Result |
|---------------|--------|
| SQL injection (main paths) | ✅ All queries parameterized |
| SQL injection (inventoryReport itemsLedger) | ❌ Date params via string concat (FV-036, P3, auth-required) |
| JWT tampering | ✅ DB re-fetch validates identity |
| Price manipulation | ✅ Server-side price lookup (minor tolerance gap) |
| Unauthorized refund | ✅ Fixed (BUG-016) |
| Module bypass via direct API | ❌ requireModule is passthrough |
| IDOR (deleted customer by ID) | ❌ BUG-028 |
| Cross-branch IDOR (purchase data) | ❌ No branch filter on purchase vouchers |
| /api/health exposure | ❌ Public, exposes memory/uptime |
| /api/metrics without METRICS_TOKEN | ❌ Fully public |
| Hardcoded secrets | ✅ None found |
| Agent token unbounded buffer | ❌ FV-015 |
| SSL/TLS | ❌ rejectUnauthorized: false on missing CA |

---

## 20. Offline Verification

AbyteDesk ERP v1.0.5 is a web application with server-side DB. No offline-first mode is active in this build. The `client-app/` directory contains a PWA shell but is not the primary deployment. Offline functionality: **N/A**.

---

## 21. Backup / Restore

`backupController.js` implements `mysqldump`-based full DB backup. Basic functionality present. Not regression-tested in this audit.

---

## 22. Import / Export

Product import (CSV) and inventory export are present in controllers. Not regression-tested in this audit.

---

## 23. Performance

| Area | Finding |
|------|---------|
| sales.customer_id | No index — full scan on customer history |
| credit_payments.credit_sale_id | No index in schema.sql (migration adds it for existing DBs only) |
| Trial balance query | Full join without date-range pushdown |
| Dashboard query | Single aggregated query — acceptable |
| Unbounded queries | getAll endpoints have pagination params |

---

## 24. UI / UX Regression

Not browser-testable in this environment. Key risk: `completeSale` tax regression (fixed) would have shown wrong totals in restaurant/table-service mode. Post-fix, calculations align with `createSale`.

---

## 25. Automated Test Results

```
Test Suites: 7 passed, 7 total
Tests:       120 passed, 120 total
Time:        3.623s
```

**Coverage assessment:** Critically insufficient. 45 controllers; 7 test files. Core revenue path (`salesController.createSale`), accounting, credit sales, purchase vouchers, and HR payroll have zero test coverage.

---

## 26. Real Business Simulation

Simulated 10-day business scenario (code-level trace, not live DB):

| Day | Operation | Verified |
|-----|-----------|---------|
| 1 | Opening stock | ✅ |
| 2 | Purchase (via PV) | ✅ stock + avg_cost updated |
| 3 | Purchase (via PO receive) | ❌ avg_cost NOT updated |
| 4 | Cash sale | ✅ stock deducted, revenue recorded |
| 5 | Credit sale | ✅ balance_due created |
| 6 | Customer payment | ✅ balance_due reduced |
| 7 | Sales return | ✅ stock restored, refund rounded |
| 8 | Purchase return | ✅ stock deducted; ❌ payable NOT reduced |
| 9 | Supplier payment | ❌ payment recorded; ❌ payable NOT reduced |
| 10 | Reports | ⚠️ Trial balance wrong; payables aging wrong |

Final reconciliation: **FAIL on supplier side.** Cash, inventory, and customer receivables reconcile (with noted caveats). Supplier payables do not reconcile at all.

---

## 27. Newly Discovered Bugs

36 new bugs were found. See FINAL_REGRESSION_MATRIX.md for full details.

**Top 5 by business impact:**

1. **FV-026 (P0)**: No supplier balance column — supplier outstanding payables are untrackable from the supplier record.
2. **FV-027 (P0)**: Purchase returns create no journal entry — accounts payable permanently overstated.
3. **FV-031 (P1)**: Supplier payments create no journal entry — payable never decremented when paid.
4. **FV-032 (P1)**: PO receive does not update avg_cost — COGS is wrong for all PO-received stock.
5. **FV-010 (P1, FIXED)**: deleteReceiptVoucherGroup had inverted sign — revenue accounts corrupted on CRV group delete.

---

## 28. Bugs Fixed During Final Verification

| Bug | Description | Fix |
|-----|-------------|-----|
| BUG-015 | branch_id never populated in req.user | Added branch_id to authenticate middleware SELECT |
| BUG-017 (partial) | Dashboard included refunded sales in revenue | Changed dashboard query to status='completed' |
| FV-001 | completeSale taxed on pre-discount base (regression) | Fixed taxable base calculation to match createSale |
| FV-010 | deleteReceiptVoucherGroup corrupted revenue account (wrong sign) | Corrected sign reversal to match deleteReceiptVoucher |
| FV-012 | productReport included cancelled/refunded sales | Added status='completed' filter |
| FV-025 | Purchase voucher avg_cost race (no FOR UPDATE) | Added FOR UPDATE to inventory SELECT |
| BUG-003 (extension) | Purchase return accepted negative quantity — stock inflate exploit | Added qty <= 0 guard |
| BUG-004/031 (partial) | No UNIQUE constraints on voucher_number / supplier_name | Added migration v24 with UNIQUE KEY constraints |

---

## 29. Remaining Risks

### P0 — Blockers
1. **BUG-005**: `products.stock_quantity` and `inventory.available_stock` can diverge permanently on crash between two unguarded writes in `inventoryController.updateStock`.
2. **FV-026**: Supplier balance not tracked — the ERP has no payables ledger at the supplier level.
3. **FV-027**: Purchase returns never reduce accounts payable — payable is permanently overstated.

### P1 — Critical
1. **BUG-004**: UNIQUE constraint prevents silent duplicates; TOCTOU still causes unexplained 500s under concurrent voucher creation.
2. **BUG-013**: Stock adjustment overwrites `inventory.available_stock` with stale absolute value under concurrency.
3. **BUG-014**: Trial balance excludes all direct-balance CPV/CRV transactions — accounting reports are wrong.
4. **BUG-019**: Dashboard date boundaries use UTC — wrong day boundaries for UTC+5 users.
5. **BUG-023**: Split and mobile_wallet payments never update the cash register.
6. **FV-006**: Stock transfer creation doesn't lock stock — over-commitment possible.
7. **FV-028**: nextPVNumber TOCTOU causes duplicate PV numbers and 500 errors under concurrent load.
8. **FV-029**: Purchase voucher accepts zero/negative quantities and prices.
9. **FV-030**: Purchase vouchers and orders have no branch_id — all branches see all procurement.
10. **FV-031**: Supplier payments create no journal entry — payable never decremented.
11. **FV-032**: PO receive doesn't update avg_cost — COGS permanently wrong for PO-received stock.
12. **FV-015**: Agent token endpoint reads unbounded buffer.

---

## 30. Final Score

| Category | Weight | Score | Notes |
|----------|--------|-------|-------|
| Functional Correctness | 20 | 12 | Core POS functional after fixes; purchase module gaps; completeSale regression fixed |
| ERP Business Logic | 20 | 6 | Supplier balance missing; purchase return/payment no journal; PO receive broken |
| Financial Accuracy | 15 | 7 | Sales tax fixed; trial balance wrong; payables aging wrong; supplier untracked |
| Data Integrity | 15 | 7 | UNIQUE constraints added; stock divergence open; fractional truncation; orphan FK |
| Security | 10 | 6 | JWT solid; module gate no-op; SQL injection in itemsLedger (auth-required); SSL disabled |
| Offline/Reliability | 5 | 3 | N/A for primary web app; basic server stability OK |
| Performance | 5 | 3 | Missing indexes on high-traffic columns; acceptable for LAN scale |
| UX/Accessibility | 5 | 3 | Functional calculations correct after fixes; some forms accept invalid input |
| Automated Regression Coverage | 5 | 1 | 45 controllers, 7 test files; core paths untested; test-the-copy bug |
| **TOTAL** | **100** | **48** | |

---

## 31. Production Readiness Decision

### Verdict: 🔴 NOT PRODUCTION READY

The system fails the minimum production gates:
- **3 P0 issues unresolved** (supplier balance not tracked, purchase return no journal, stock divergence)
- **12+ P1 issues unresolved** (trial balance broken, purchase voucher/order gaps, supplier payment no journal, etc.)
- Supplier payables reconciliation: **FAIL**
- Trial balance: **FAIL**
- Financial reconciliation (supplier side): **FAIL**

---

```
========================================
ABYTEDESK ERP FINAL VERDICT
========================================

Final Score: 48/100

P0 Issues: 3 (unresolved after this session)
P1 Issues: 12 (unresolved after this session)
P2 Issues: 18 (unresolved after this session)
P3 Issues: 7 (unresolved after this session)

Previous Bugs Verified: 37/37 independently checked
Bugs Fixed This Session: 8 (including 2 found NOT actually fixed)

Critical Regression Tests: PARTIAL PASS (120/120 automated; manual critical paths fail)

Financial Reconciliation (Sales): PASS
Financial Reconciliation (Customer Balances): CONDITIONAL PASS
Financial Reconciliation (Supplier/Payables): FAIL
Financial Reconciliation (Trial Balance): FAIL

Inventory Reconciliation: PARTIAL FAIL (PO receive, stock divergence)

Security Verification: PARTIAL PASS (JWT solid; module gate is passthrough)

Offline Verification: N/A

Data Integrity: PARTIAL FAIL (supplier tracking absent, payables never reduce)

========================================

FINAL STATUS:

🔴 NOT PRODUCTION READY

========================================

REASON:

The ERP's supplier-side accounting is fundamentally incomplete:
- Supplier balances are not tracked at the supplier record level
- Purchase returns create no journal entry (payable never reduced)
- Supplier payments create no journal entry (payable never decremented)
- Trial balance excludes all non-journalized payment/receipt vouchers

These are not configuration gaps — they are missing implementations that
make the accounts payable module non-functional as an ERP accounting system.
Additionally, purchase orders receiving stock do not update weighted-average
cost, making COGS calculations unreliable for any business that uses POs.

BLOCKERS:

1. FV-026 — No supplier balance column; outstanding payables untrackable
2. FV-027 — Purchase return creates no journal entry; payable never reduced
3. BUG-005 — products.stock_quantity / inventory.available_stock can diverge
   on crash (inventoryController.updateStock has no transaction)

REMAINING RISKS:

- Trial balance does not include direct-balance CPV/CRV (BUG-014)
- FV-031: Supplier payment creates no journal entry
- FV-032: PO receive does not update avg_cost
- BUG-023: split/mobile_wallet payments invisible to cash register
- BUG-019: Dashboard date boundaries wrong for UTC+5 timezone
- BUG-004: Concurrent voucher creation still causes 500 errors (UNIQUE prevents corruption)
- FV-028: nextPVNumber TOCTOU causes 500 under concurrent load
- Automated test coverage critically insufficient (45 controllers, 7 test files)

REQUIRED ACTIONS BEFORE GO-LIVE:

MUST FIX (P0):
1. Implement supplier balance tracking (column + journal entry on purchase/payment/return)
2. Implement journal entry creation in purchaseReturnController.create
3. Wrap inventoryController.updateStock in a transaction with FOR UPDATE

MUST FIX (P1):
4. Create journal entry in supplierController.addPayment (DR Payable, CR Cash/Bank)
5. Fix PO receive to update avg_cost and insert stock_layers
6. Fix trial balance to UNION non-journalized CPV/CRV amounts (BUG-014)
7. Add per-item validation in purchaseVoucherController (zero/negative qty/price)
8. Add branch_id to inv_purchase_vouchers and scope queries (FV-030)
9. Fix nextPVNumber/nextPRNumber to use transactional connection (FV-028, FV-007)
10. Add retry logic for CPV/CRV number generation after UNIQUE violation (BUG-004)
11. Fix BUG-019 (UTC→UTC+5 for date boundaries)
12. Fix BUG-023 (split/mobile_wallet register update)
13. Add automated tests for salesController, accountingController, creditSaleController,
    purchaseVoucherController, returnController (minimum happy-path + edge cases)
========================================
```

---

_End of Final Verification Report_
