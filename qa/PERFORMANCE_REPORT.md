# AbyteDesk ERP — Performance Report

_Last updated: 2026-09-05_

---

## Scope

This report documents observed and projected performance characteristics of the AbyteDesk ERP backend. All measurements are based on code analysis, query pattern inspection, and LAN deployment constraints. No load testing with synthetic traffic was conducted in this cycle.

---

## Architecture & Performance Profile

| Aspect | Details |
|--------|---------|
| Deployment | Single-tenant, LAN (localhost or 192.168.x.x) |
| Concurrent Users | Designed for 1–10 POS terminals |
| Database | MariaDB (single instance, no replication) |
| Connection Pooling | Per-tenant pool via `mariadb` driver |
| Caching | In-memory `cacheService` for settings/static data |

---

## Query Performance Analysis

### Efficient Patterns

- **Batch stock updates** (`batchUpdateStock`): Updates N products in 4 queries using CASE/WHEN instead of N×4 queries — O(1) query count regardless of cart size.
- **Batch stock validation** (`batchValidateStock`): Validates all cart items in 2 queries (inventory + variants) using IN clause.
- **Parameterized queries**: All queries use `?` placeholders — no dynamic SQL construction that would prevent query plan caching.
- **Indexed columns**: `sale_date`, `status`, `product_id`, `customer_id`, `supplier_id` all indexed in schema.

### Performance Risks

| Risk | Location | Impact | Mitigation |
|------|----------|--------|-----------|
| N+1 loop in purchase return | `purchaseReturnController.js` create | 3 queries per item (SELECT FOR UPDATE + 2 UPDATEs) | Acceptable for typical 1–20 items; monitor for bulk returns |
| N+1 loop in return create | `returnController.js` | 4 queries per item post-fix (adds variant stock) | Acceptable for typical return sizes |
| Named lock contention | `salesController.js` invoice_gen | Serializes concurrent sales at invoice generation | Only held for MAX() query; typically <5ms |
| No query timeout | All controllers | Long-running queries block connection pool | Set `connectTimeout`/`queryTimeout` in pool config |
| Full table scan risk | `dailyReport` | `CURDATE()` comparison on `sale_date` without timezone offset | Index on `(sale_date, status)` exists — efficient |

---

## Identified Performance Bottlenecks

### 1. `getPayablesAging` — All Purchase Vouchers

**Before fix (BUG-001):** Query crashed. After fix: Returns all purchase vouchers with outstanding balance. With large datasets (1000s of PVs), the result set could be large. No pagination added — full result always returned.

**Recommendation:** Add `LIMIT ? OFFSET ?` pagination or date filter.

### 2. `getAccountStatement` — Triple UNION Query

The period transactions query uses a 3-way UNION ALL across `journal_entry_lines`, `payment_vouchers`, and `receipt_vouchers`. For large date ranges with many transactions, this could be slow without covering indexes on `voucher_date`.

**Recommendation:** Ensure `idx_date` index exists on both voucher tables (it does in schema — no action needed currently).

### 3. Dashboard Summary Query

The `dashboardSummary` query uses subqueries to compute today/yesterday/week/month figures. The `(sale_date, status)` composite index should cover this adequately.

### 4. `getAll` on Large Customer/Product Sets

`getAll` for customers and products uses `LIMIT 50` without index hints on the search path. FULLTEXT indexes exist on `customer_name` and `product_name` but `LIKE '%...%'` queries don't use them.

**Recommendation:** Switch to `MATCH ... AGAINST` for search queries, or ensure search is prefix-only (`LIKE 'x%'`).

---

## Response Time Targets (LAN)

| Endpoint | Target | Expected |
|----------|--------|---------|
| POST /api/sales (5-item cart) | < 200ms | ~50–100ms |
| GET /api/products (list) | < 100ms | ~20–50ms |
| GET /api/reports/dashboard | < 300ms | ~100–200ms |
| GET /api/accounting/account-statement | < 500ms | ~100–300ms |
| GET /api/accounting/payables-aging | < 1s | ~200–500ms |

---

## Memory & Resource Usage

- **Node.js heap**: Expected 100–250MB under normal POS load
- **MariaDB**: Configured with default buffer pool; sufficient for single-tenant LAN deployment
- **No background job leaks**: Cron scheduler and scheduled tasks properly initialized at startup only

---

## Recommendations

1. **Add query timeouts** to the MariaDB pool config (`queryTimeout: 30000`).
2. **Paginate `getPayablesAging`** to avoid large result sets.
3. **Index `payment_vouchers(voucher_date, account_id, main_account_id)`** and same for `receipt_vouchers` for the account statement UNION query.
4. **Monitor named lock hold time** if concurrent checkout rates increase.
5. **Consider Redis cache** for frequently-read settings (store_settings) if LAN user count grows.

---

## Verdict

Performance is **acceptable for the target deployment** (LAN, ≤10 concurrent users). The batch query patterns for stock operations are well-designed. No critical performance blockers identified. Monitoring and query timeout configuration recommended before production deployment.
