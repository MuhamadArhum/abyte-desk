# AbyteDesk ERP — Test Cases

_Last updated: 2026-09-05_

---

## TC-AUTH: Authentication

| ID | Description | Steps | Expected | Status |
|----|-------------|-------|----------|--------|
| TC-AUTH-001 | Login with valid Admin credentials | POST /api/auth/login with valid email/password | 200 + JWT token + null permissions | ✅ Automated |
| TC-AUTH-002 | Login with invalid password | POST /api/auth/login with wrong password | 401 "Invalid credentials" | ✅ Automated |
| TC-AUTH-003 | Login with deactivated account | POST /api/auth/login for is_active=0 user | 403 "Account deactivated" | ✅ Automated |
| TC-AUTH-004 | Login as Cashier — receives permission array | POST /api/auth/login for Cashier role | 200 + permissions[] | ✅ Automated |
| TC-AUTH-005 | Verify valid token | GET /api/auth/verify with valid Bearer | 200 + user object | ✅ Automated |
| TC-AUTH-006 | Verify blacklisted token | GET /api/auth/verify with blacklisted token | 401 | ✅ Automated |
| TC-AUTH-007 | Logout blacklists token | POST /api/auth/logout | 200; subsequent verify returns 401 | ✅ Automated |
| TC-AUTH-008 | Missing email field | POST /api/auth/login with no email | 400 | ✅ Automated |

---

## TC-SALES: POS / Sales

| ID | Description | Steps | Expected | Status |
|----|-------------|-------|----------|--------|
| TC-SALES-001 | Create completed sale with correct price | POST /api/sales with system price | 201 + sale_id | Manual |
| TC-SALES-002 | Cashier submits wrong unit_price | POST /api/sales with price != system price (Cashier role) | 400 "does not match system price" | Manual |
| TC-SALES-003 | Admin submits any unit_price | POST /api/sales with override price (Admin role) | 201 — Admin exempt from price check | Manual |
| TC-SALES-004 | Discount exceeds 50% cap for Cashier | POST /api/sales discount > 50% | 400 "cannot exceed 50%" | Manual |
| TC-SALES-005 | Tax calculated post-discount | POST /api/sales with discount and tax | tax = (subtotal - discount) * rate | Manual |
| TC-SALES-006 | Delete pending sale — stock not restored | DELETE /api/sales/:id (pending) | 200; inventory unchanged | Manual |
| TC-SALES-007 | Delete completed sale — stock restored | DELETE /api/sales/:id (completed, Admin) | 200; inventory += qty | Manual |
| TC-SALES-008 | Cashier attempts refund | PUT /api/sales/:id/refund (Cashier role) | 403 "Only Admin or Manager" | Manual |
| TC-SALES-009 | Refund pending sale | PUT /api/sales/:id/refund (Admin, pending sale) | 400 "Only completed sales" | Manual |
| TC-SALES-010 | branch_id set on sale | POST /api/sales (user with branch) | `branch_id` = user's branch in DB | Manual |
| TC-SALES-011 | Sale with empty cart | POST /api/sales items=[] | 400 "Cart is empty" | Manual |
| TC-SALES-012 | Zero quantity item | POST /api/sales item.quantity=0 | 400 invalid quantity | Manual |
| TC-SALES-013 | Credit sale without customer_id | POST /api/sales is_credit=true, customer_id=1 | 400 "require a named customer" | Manual |

---

## TC-INV: Inventory

| ID | Description | Steps | Expected | Status |
|----|-------------|-------|----------|--------|
| TC-INV-001 | Get all products | GET /api/products | 200 + product list | ✅ Automated |
| TC-INV-002 | Create product | POST /api/products | 201 + product object | ✅ Automated |
| TC-INV-003 | Update product price | PUT /api/products/:id | 200 + updated record | ✅ Automated |
| TC-INV-004 | Get inventory report | GET /api/reports/inventory | 200; stock_value uses avg_cost | Manual |
| TC-INV-005 | Low stock threshold from settings | GET /api/reports/inventory | low_stock uses store_settings.low_stock_threshold | Manual |

---

## TC-RET: Returns

| ID | Description | Steps | Expected | Status |
|----|-------------|-------|----------|--------|
| TC-RET-001 | Return completed sale item | POST /api/returns | 201; inventory += returnQty | Manual |
| TC-RET-002 | Return variant item | POST /api/returns with variant_id | variant_inventory and product_variants also restored | Manual |
| TC-RET-003 | Return quantity exceeds original | POST /api/returns qty > original | 400 "Max returnable" | Manual |
| TC-RET-004 | Return pending sale | POST /api/returns for pending sale | 400 "only return completed sales" | Manual |
| TC-RET-005 | Zero-quantity return | POST /api/returns returnQty=0 | 400 "must be greater than 0" | Manual |
| TC-RET-006 | Return refund amount is rounded | POST /api/returns | refund_price rounded to 2dp | Manual |

---

## TC-PRCH: Purchase Returns

| ID | Description | Steps | Expected | Status |
|----|-------------|-------|----------|--------|
| TC-PRCH-001 | Return when stock available | POST /api/purchase-returns | 201; stock deducted | Manual |
| TC-PRCH-002 | Return when stock = 0 | POST /api/purchase-returns (stock insufficient) | 400 "Insufficient stock" | Manual |
| TC-PRCH-003 | Return more than available | POST /api/purchase-returns qty > available_stock | 400 with available qty shown | Manual |

---

## TC-REG: Cash Register

| ID | Description | Steps | Expected | Status |
|----|-------------|-------|----------|--------|
| TC-REG-001 | Open register with valid balance | POST /api/register/open balance=1000 | 201 | Manual |
| TC-REG-002 | Open register with string balance | POST /api/register/open balance="abc" | 400 "Valid opening balance required" | Manual |
| TC-REG-003 | Close register with cash movements | POST /api/register/close | expected = opening + cash_sales + cash_in - cash_out - expenses | Manual |
| TC-REG-004 | Close register with pending orders | POST /api/register/close (pending sales exist) | 400 "Cannot close: pending orders" | Manual |

---

## TC-ACC: Accounting

| ID | Description | Steps | Expected | Status |
|----|-------------|-------|----------|--------|
| TC-ACC-001 | Cash flow statement | GET /api/accounting/cash-flow?from_date=...&to_date=... | 200 + summary/monthly/top breakdown | Manual |
| TC-ACC-002 | Account statement | GET /api/accounting/account-statement?account_id=1&... | 200 + running balance | Manual |
| TC-ACC-003 | Payables aging | GET /api/accounting/payables-aging | 200 + supplier aging buckets | Manual |
| TC-ACC-004 | Trial balance | GET /api/accounting/trial-balance | Balanced DR = CR (only if all entries journalized) | Manual |

---

## TC-CRED: Credit Sales

| ID | Description | Steps | Expected | Status |
|----|-------------|-------|----------|--------|
| TC-CRED-001 | Create credit sale | POST /api/credit-sales | 201 | Manual |
| TC-CRED-002 | paid_amount > total_amount | POST /api/credit-sales paid > total | 400 "cannot exceed total amount" | Manual |
| TC-CRED-003 | Record partial payment | POST /api/credit-sales/:id/payments | 200; balance_due reduced | Manual |
| TC-CRED-004 | Final payment marks as paid | POST /api/credit-sales/:id/payments (full) | status = 'paid'; balance_due = 0.00 | Manual |
| TC-CRED-005 | overdue=false query param | GET /api/credit-sales?overdue=false | Overdue filter NOT applied | Manual |
| TC-CRED-006 | overdue=true query param | GET /api/credit-sales?overdue=true | Overdue filter applied | Manual |
| TC-CRED-007 | Payment exceeds balance_due | POST /api/credit-sales/:id/payments amount > balance | 400 | Manual |

---

## TC-REP: Reports

| ID | Description | Steps | Expected | Status |
|----|-------------|-------|----------|--------|
| TC-REP-001 | Daily report excludes refunds | GET /api/reports/daily (with refunded sales today) | Revenue excludes refunded sales | Manual |
| TC-REP-002 | Date range report excludes cancelled | GET /api/reports/date-range | Only completed sales counted | Manual |
| TC-REP-003 | Inventory report stock value | GET /api/reports/inventory | stock_value = avg_cost × available_stock | Manual |
| TC-REP-004 | Dashboard summary | GET /api/reports/dashboard | today/week/month revenue figures | Manual |

---

## TC-XFER: Stock Transfers

| ID | Description | Steps | Expected | Status |
|----|-------------|-------|----------|--------|
| TC-XFER-001 | Get all transfers | GET /api/stock-transfers | 200 | ✅ Automated |
| TC-XFER-002 | Create transfer | POST /api/stock-transfers | 201 | ✅ Automated |
| TC-XFER-003 | Approve pending transfer | PUT /api/stock-transfers/:id/approve | 200; stock moved | ✅ Automated |
| TC-XFER-004 | Approve already approved | PUT /api/stock-transfers/:id/approve (status=completed) | 400 | ✅ Automated |
| TC-XFER-005 | Cancel pending transfer | PUT /api/stock-transfers/:id/cancel | 200; status=cancelled | ✅ Automated |
| TC-XFER-006 | Cancel already completed | PUT /api/stock-transfers/:id/cancel (completed) | 400 "Only pending" | ✅ Automated |
| TC-XFER-007 | Concurrent cancel + approve | Two simultaneous requests | One wins via FOR UPDATE lock | Manual |

---

## TC-CUST: Customers

| ID | Description | Steps | Expected | Status |
|----|-------------|-------|----------|--------|
| TC-CUST-001 | Create customer with address | POST /api/customers | 201; customer + address in transaction | Manual |
| TC-CUST-002 | List customers excludes deleted | GET /api/customers | Soft-deleted (deleted_at IS NOT NULL) not shown | Manual |
| TC-CUST-003 | Duplicate phone number | POST /api/customers (duplicate phone) | 400 "Phone number already exists" | Manual |

---

## Automated Test Coverage Summary

| Area | Automated Tests | Pass Rate |
|------|----------------|-----------|
| Auth (integration) | 11 | 100% |
| Products (integration) | 20 | 100% |
| Stock Transfers (integration) | 17 | 100% |
| AuthContext (frontend) | 14 | 100% |
| **Total** | **62** | **100%** |
