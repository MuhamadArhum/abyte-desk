# AbyteDesk ERP — System Inventory

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 20+ / Express 4 |
| Database | MariaDB (MySQL-compatible) |
| ORM/Query | Raw parameterized SQL via mariadb driver |
| Authentication | JWT (jsonwebtoken), bcryptjs |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| State Management | Zustand + React Context |
| Mobile App | React Native (Expo) — waiter-app |
| Desktop App | Electron — printer-agent |
| Testing (BE) | Jest + Supertest |
| Testing (FE) | Vitest |
| Caching | In-memory (cacheService) |
| Logging | Winston |

## Architecture

- **Single-tenant** (Phase 4 migration): One MariaDB database per installation
- **Offline-capable**: All data stored locally in MariaDB; no mandatory cloud dependency
- **LAN-served**: Backend on port 5000; frontend served statically or via dev server port 5173
- **Printer Agent**: Polls backend print queue; sends ESC/POS to local printers

## Database Tables (76 total)

| Category | Tables |
|----------|--------|
| Auth/Users | users, roles, role_permissions |
| Customers | customers, customer_addresses, credit_sales, credit_payments |
| Suppliers | suppliers, supplier_payments |
| Products | products, categories, variant_types, variant_values, variant_combinations, product_variants, product_bundles, bundle_items |
| Inventory | inventory, variant_inventory, stock_adjustments, stock_layers, stock_alerts, opening_stock_entries |
| Stock Transfers | store_inventory (dynamic), stock_issues, stock_issue_items, stock_issue_returns, stock_issue_return_items |
| Purchases | inv_purchase_vouchers, inv_purchase_voucher_items, purchase_orders, purchase_order_items, purchase_returns, purchase_return_items |
| Sales | sales, sale_details, sale_bundles, returns, return_details |
| Register | cash_registers, cash_movements |
| Restaurant | restaurant_tables, sections |
| Deliveries | deliveries |
| Quotations | quotations, quotation_items |
| Accounting | accounts, account_groups, journal_entries, journal_entry_lines, bank_accounts, payment_vouchers, receipt_vouchers, expenses, expense_categories |
| HR | staff, attendance, shifts, holidays, salary_payments, salary_increments, advance_payments, staff_loans, loan_repayments, leave_requests, sales_targets, target_achievements |
| Recipes/Production | recipes, recipe_ingredients, production_orders, raw_sales, raw_sale_items |
| System | audit_logs, backups, store_settings, print_queue, printers |

## Module Inventory

| Module | Controller | Routes | Frontend Pages | Status |
|--------|-----------|--------|---------------|--------|
| Authentication | authController | authRoutes | Login, ForgotPassword, ResetPassword | Active |
| Dashboard | reportController | reportRoutes | Dashboard | Active |
| Users | userController | userRoutes | system/Users | Active |
| Permissions | permissionController | permissionRoutes | system/AccessControl | Active |
| Settings | settingsController | settingsRoutes | system/Settings, EmailSettings | Active |
| Stores/Branches | storeController | storeRoutes | system/Stores | Active |
| Audit Logs | auditController | auditRoutes | system/AuditLog | Active |
| Backup | backupController | backupRoutes | system/Backup | Active |
| Customers | customerController | customerRoutes | hr/Customers | Active |
| Suppliers | supplierController | supplierRoutes | inventory/Suppliers | Active |
| Products | productController | productRoutes | inventory/Products, FinishedGoods | Active |
| Categories | productController | productRoutes | inventory/Categories, FinishedGoodsCategories | Active |
| Product Variants | variantController | variantRoutes | inventory/ProductVariants | Active |
| Product Bundles | bundleController | bundleRoutes | inventory/Bundles | Active |
| Inventory | inventoryController | inventoryRoutes | inventory/Inventory | Active |
| Opening Stock | openingStockController | openingStockRoutes | inventory/OpeningStock | Active |
| Stock Adjustments | stockAdjustmentController | stockAdjustmentRoutes | inventory/StockAdjustments | Active |
| Stock Transfers | stockTransferController | stockTransferRoutes | inventory/StockTransfers | Active |
| Stock Issues | issuanceController | issuanceRoutes | inventory/StockIssue | Active |
| Purchase Vouchers | purchaseVoucherController | purchaseVoucherRoutes | inventory/PurchaseVoucher | Active |
| Purchase Orders | purchaseOrderController | purchaseOrderRoutes | inventory/PurchaseOrders | Active |
| Purchase Returns | purchaseReturnController | purchaseReturnRoutes | inventory/PurchaseReturn | Active |
| POS / Sales | salesController | salesRoutes | sales/POS, sales/Orders | Active |
| Returns | returnController | returnRoutes | sales/Returns | Active |
| Cash Register | registerController | registerRoutes | sales/CashRegister | Active |
| Credit Sales | creditSaleController | creditSaleRoutes | sales/CreditSales | Active |
| Quotations | quotationController | quotationRoutes | sales/Quotations | Active |
| Deliveries | deliveryController | deliveryRoutes | sales/Deliveries | Active |
| Price Rules | priceRuleController | priceRuleRoutes | sales/PriceRules | Active |
| Sales Targets | salesTargetController | salesTargetRoutes | sales/SalesTargets | Active |
| Accounting | accountingController | accountingRoutes | accounts/* | Partially Broken |
| Journal Entries | accountingController | accountingRoutes | accounts/JournalEntries | Active |
| Vouchers | accountingController | accountingRoutes | accounts/PaymentVouchers, ReceiptVouchers | Active |
| Reports | reportController, salesReportController, inventoryReportController | reportRoutes | sales/SalesReports, inventory/InventoryReports | Active |
| HR / Staff | staffController | staffRoutes | hr/Staff, Payroll, Attendance | Active |
| Recipes | recipeController | recipeRoutes | inventory/Recipes | Active |
| Production | productionController | productionRoutes | inventory/ProductionOrders | Active |
| Restaurant | restaurantController | restaurantRoutes | restaurant/TableManagement | Active |
| AI Assistant | aiController | aiRoutes | (integrated) | Active |
| Printer Agent | agentController | agentRoutes | (backend-only) | Active |
| WhatsApp | whatsappController | whatsappRoutes | (integrated) | Active |
| FBR | fbrController | fbrRoutes | (POS integration) | Active |
| Biometric | biometricController | biometricRoutes | hr/BiometricAttendance | Active |
