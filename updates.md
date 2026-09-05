# AByte ERP — Updates Log
**Date:** 2026-08-30

---

## ✅ Completed Tasks

### 1. Backend Testing
**Status:** Complete
- Backend port 5000 pe successfully start hua
- Login API tested: `admin@abyte.com / admin123` — SUCCESS
- All major APIs tested and working:
  - Products: 25,000 records
  - Sales: 205,004 records
  - Customers: 205,002 records
  - Suppliers: 11,000 records
  - Accounting: 10,495 records
  - Staff/HR: 1,316 records
  - Purchase Orders: 45,000 records
  - Quotations: 60,000 records
  - Credit Sales: 50,063 records
  - Returns: 20,000 records

### 2. Suppliers Date Filter
**Status:** Complete
- Backend: `date_from` / `date_to` on `created_at` added to `supplierController.js`
- Frontend: Date range inputs added to `Suppliers.tsx` with Clear button

### 3. Waiter-App LAN Configuration
**Status:** Complete
- `.env` file created with `EXPO_PUBLIC_API_URL=http://192.168.0.105:5000/api`
- All waiter-app routes verified in backend (tables, orders, pending, print-queue)

### 4. Version Bump → v1.0.5
**Status:** Complete
- `server-app/package.json` → 1.0.5
- `client-app/package.json` → 1.0.5
- `server-app/renderer/index.html` → v1.0.5 display

### 5. Frontend Production Build
**Status:** Complete
- `npm run build` successful in `main-app/frontend`
- dist files updated

### 6. EXE Rebuild v1.0.5
**Status:** Complete
- `AByte ERP Server Setup 1.0.5.exe` ✅
- `AByte ERP Server 1.0.5.exe` (Portable) ✅
- `AByte ERP Client Setup 1.0.5.exe` ✅
- `AByte ERP Client 1.0.5.exe` (Portable) ✅

### 7. Git Commit
**Status:** Complete
- Commit: `0b90d65` — feat: v1.0.5 suppliers date filter, version bump, waiter-app LAN config

---

---

**Date:** 2026-09-05

---

## ✅ Completed Tasks

### 1. Integration Test Fixes (Phase 4 Migration)
**Status:** Complete
- `tests/integration/auth.test.js` — Phase 4 rewrite: removed tenantStorage, fixed logAction mock
- `tests/integration/products.test.js` — FIFO queue strategy for authenticate + controller mocks
- `tests/integration/stockTransfer.test.js` — Added missing route in testApp.js, updated cancel tests
- Frontend `AuthContext.test.tsx` — Fixed 3 failing tests for Phase 4 enterprise plan behavior
- **All 62 automated tests pass**

### 2. Full QA Audit — 37 Bugs Found & Catalogued
**Status:** Complete
- `qa/SYSTEM_INVENTORY.md` — 76 tables, 46 controllers, all modules catalogued
- `qa/BUGS.md` — 37 bugs: 5× P0, 11× P1, 16× P2, 5× P3

### 3. P0 Bug Fixes
**Status:** Complete — 3 of 5 P0 bugs fixed
- **BUG-001**: `getCashFlowStatement`, `getAccountStatement`, `getPayablesAging` — all 3 accounting endpoints crashed on every call due to non-existent tables (`receipt_voucher_lines`, `payment_voucher_lines`, `purchases`) and wrong column names (`debit_amount`/`credit_amount`). Fixed to use actual schema.
- **BUG-002**: Server-side price validation added — Cashiers can no longer submit arbitrary unit prices
- **BUG-003**: Purchase return stock availability check added — stock can no longer go negative

### 4. P1 Bug Fixes
**Status:** Complete — 8 of 11 P1 bugs fixed
- **BUG-006**: Tax now calculated on post-discount amount (not pre-discount subtotal)
- **BUG-007**: Combined explicit + bundle discount cap enforced (partial fix)
- **BUG-008**: Pending sale deletion no longer restores stock (stock was never deducted)
- **BUG-009**: refundSale now blocks non-completed sales
- **BUG-010**: Return controller now restores `variant_inventory` + `product_variants` stock
- **BUG-011**: Cash register expected balance now includes `cash_in`/`cash_out` movements
- **BUG-012**: Stock transfer cancel wrapped in transaction with FOR UPDATE lock
- **BUG-015**: `branch_id` now set from `req.user.branch_id` on sale INSERT
- **BUG-016**: refundSale now requires Admin or Manager role

### 5. P2 Bug Fixes
**Status:** Complete — 11 of 16 P2 bugs fixed
- BUG-017: Reports filter `status='completed'` only
- BUG-018: Inventory report uses `avg_cost` instead of selling price
- BUG-021: Zero-quantity returns rejected
- BUG-022: Refund price rounded to 2 decimal places
- BUG-024: Credit sale rejects `paid_amount > total_amount`
- BUG-025: Credit payment floating-point drift fixed with `Math.round`
- BUG-026: `overdue` query param compared as `=== 'true'` (not truthy string)
- BUG-027: Customer create + address insert wrapped in transaction
- BUG-028: Soft-deleted customers excluded via `deleted_at IS NULL`
- BUG-029: Low-stock threshold reads from `store_settings`
- BUG-033: Register balance validation rejects NaN strings

### 6. Full QA Documentation Suite
**Status:** Complete
- `qa/TEST_PLAN.md` ✅
- `qa/TEST_CASES.md` ✅
- `qa/SECURITY_AUDIT.md` ✅
- `qa/PERFORMANCE_REPORT.md` ✅
- `qa/OFFLINE_TEST_REPORT.md` ✅
- `qa/REGRESSION_REPORT.md` ✅
- `qa/FINAL_QA_REPORT.md` ✅

---

## ⏳ Pending Tasks

### 1. GitHub Release v1.0.5
**Status:** Pending
- 4 new exe files GitHub Release pe upload karne hain

### 2. Open P0 Bugs (Require DB Migration)
**Status:** Pending
- BUG-004: Duplicate voucher numbers — needs UNIQUE constraint migration
- BUG-005: Dual-table stock divergence — systemic; needs reconciliation

### 3. Open P1 Bugs
**Status:** Pending
- BUG-013: Stock adjustment inventory lock missing
- BUG-014: Trial balance excludes non-journalized vouchers

### 4. Security Hardening
**Status:** Pending
- BUG-030: Protect /api/health endpoint with auth
- BUG-036: Enable SSL for DB connection in production

---

**Date:** 2026-08-29

---

## ✅ Completed Tasks

### 1. App Readiness Audit
**Status:** Complete
- Full codebase audit kiya (backend, frontend, admin panel, database)
- 95/100 readiness score confirm hua
- Missing .env files identify kiye

### 2. Environment Files (.env) Setup
**Status:** Complete
- `main-app/backend/.env` banaya
- `admin-panel/backend/.env` banaya
- JWT Secret (128-char secure) generate kiya
- DB credentials configured: `root / 12345`
- CORS origins: `http://localhost:5173`, `http://localhost:5174`

### 3. Executable (EXE) Builds
**Status:** Complete
- `AByte ERP Server Setup 1.0.4.exe` built ✅
- `AByte ERP Server 1.0.4.exe` (portable) built ✅
- `AByte ERP Client Setup 1.0.4.exe` built ✅
- `AByte ERP Client 1.0.4.exe` (portable) built ✅
- GitHub Release v1.0.4 already had all 4 files (no re-upload needed)

### 4. Database Seeding (2.5 Million Rows)
**Status:** Complete
- `seed.js` script banaya aur `abytedesk-arhum` DB pe run kiya
- `seed.js` ko `.gitignore` mein add kiya (GitHub pe nahi jayega)
- **61 tables seeded:**

| Table | Rows |
|-------|------|
| customers | 100,000 |
| sales | 100,000 |
| sale_details | 100,000 |
| deliveries | 100,000 |
| expenses | 100,000 |
| audit_logs | 100,000 |
| stock_adjustments | 100,000 |
| stock_layers | 100,000 |
| cash_movements | 100,000 |
| attendance | 100,000 |
| credit_payments | 100,000 |
| journal_entry_lines | 100,000 |
| customer_addresses | 100,000 |
| stock_issue_items | 100,000 |
| inv_purchase_voucher_items | 100,000 |
| purchase_order_items | 100,000 |
| + 45 more tables | 5k–50k each |
| **Total** | **~2.5 Million rows** |

### 5. Pagination & Date Filters
**Status:** Complete
- **Backend date filters added:**
  - `purchaseOrderController.js` → `date_from` / `date_to` on `order_date`
  - `quotationController.js` → `date_from` / `date_to` on `created_at`
  - `creditSaleController.js` → `date_from` / `date_to` on `created_at`
- **Frontend date range inputs added:**
  - Purchase Orders page
  - Quotations page
  - Credit Sales page
  - Returns page

### 6. Level 4 Account Enforcement
**Status:** Complete
- **Backend validation added** in `accountingController.js`:
  - Journal Entries: sab account lines level 4 honi chahiye
  - Payment Vouchers: `account_id` aur `main_account_id` level 4
  - Receipt Vouchers: `account_id` aur `main_account_id` level 4
  - `getAccounts` API: `?level=4` query param support
- Error message: `"Only Level 4 accounts can be used for transactions"`

### 7. Admin User Created
**Status:** Complete
- Email: `admin@abyte.com`
- Password: `admin123`
- Role: Admin

### 8. GitHub Updates
**Status:** Complete
- All changes pushed to `main` branch
- Latest commits:
  - `e5e5917` — feat: Level 4 account enforcement
  - `973b138` — chore: gitignore updates
  - `706afd2` — feat: pagination & date filters

### 9. Admin Panel Deleted
**Status:** Complete
- `admin-panel/` directory permanently delete kiya
- Reason: Product local/LAN deployment ke liye hai, SaaS infrastructure ki zarurat nahi
- Admin panel SaaS model (cloud tenants, billing, subscriptions) ke liye tha jo hamara use case nahi

---

## ⏳ Pending Tasks

### 1. Backend Server Port Conflict
**Status:** Pending
- "Abyte Hunt API" (another project) port 5000 pe chal raha hai
- Hamara AByte ERP backend start nahi ho pa raha
- **Fix needed:** Abyte Hunt band karo ya uska port change karo
- **Solution:** `main-app/backend` mein `node server.js` manually run karo Abyte Hunt band karke

### 2. Login Testing
**Status:** Pending
- CORS fix ho gaya, admin user bana, login API test hua ✅
- Lekin browser se full login test karna baqi hai (port conflict ki wajah se)

### 3. Remaining Pagination/Date Filters
**Status:** Pending
- Kuch aur tables/pages pe abhi bhi date filters missing hain:
  - Products page — date filter nahi
  - Suppliers page — date filter nahi
  - Inventory ledger — date filter nahi

### 4. Full App Testing
**Status:** Pending
- Sab modules ka end-to-end testing baqi hai
- Sales flow test
- Purchase flow test
- HR module test
- Accounts module test

### 5. Exe Rebuild (After Code Changes)
**Status:** Pending
- Aaj ke code changes (Level 4, pagination, date filters) ke baad
- Naye exe files rebuild karne honge v1.0.5 ke liye

### 6. Mobile App Integration
**Status:** Pending (kal subha)
- Mobile app ko main app ke saath integrate karna hai
- waiter-app already exists in codebase — confirm karna hai kya yahi integrate hogi

---

## 📋 Summary

| Category | Completed | Pending |
|----------|-----------|---------|
| Setup & Config | ✅ 2/2 | — |
| Build & Deploy | ✅ 1/1 | ⏳ Rebuild needed |
| Database | ✅ 1/1 | — |
| Features | ✅ 2/2 | ⏳ More filters |
| Testing | — | ⏳ Full testing |
| Server | ⏳ Port conflict | — |
