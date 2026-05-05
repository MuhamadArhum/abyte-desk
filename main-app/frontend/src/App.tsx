import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import Layout from './components/Layout';
import PermissionGuard from './components/PermissionGuard';
// Root Pages
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import NotFound from './pages/NotFound';
import HelpSupport from './pages/HelpSupport';

// Sales Module
import POS from './pages/sales/POS';
import Orders from './pages/sales/Orders';
import CashRegister from './pages/sales/CashRegister';
import Returns from './pages/sales/Returns';
import Quotations from './pages/sales/Quotations';
import CreditSales from './pages/sales/CreditSales';
import PriceRules from './pages/sales/PriceRules';
import SalesTargets from './pages/sales/SalesTargets';
import Deliveries from './pages/sales/Deliveries';
import WalkInOrders from './pages/sales/WalkInOrders';
import DoneOrders from './pages/sales/DoneOrders';
import SalesReports from './pages/sales/SalesReports';

// Inventory Module
import Inventory from './pages/inventory/Inventory';
import FinishedGoods from './pages/inventory/FinishedGoods';
import RawMaterials from './pages/inventory/RawMaterials';
import Categories from './pages/inventory/Categories';
import PurchaseOrders from './pages/inventory/PurchaseOrders';
import StockTransfers from './pages/inventory/StockTransfers';
import StockAdjustments from './pages/inventory/StockAdjustments';
import StockAlerts from './pages/inventory/StockAlerts';
import Suppliers from './pages/inventory/Suppliers';
import InventoryReports from './pages/inventory/InventoryReports';
import Bundles from './pages/inventory/Bundles';
import ProductVariants from './pages/inventory/ProductVariants';
import StockCount from './pages/inventory/StockCount';
import Products from './pages/inventory/Products';
import PurchaseVoucher from './pages/inventory/PurchaseVoucher';
import PurchaseReturn from './pages/inventory/PurchaseReturn';
import StockIssue from './pages/inventory/StockIssue';
import StockReturnIssuance from './pages/inventory/StockReturnIssuance';
import RawSale from './pages/inventory/RawSale';
import Sections from './pages/inventory/Sections';
import ItemsLedger from './pages/inventory/ItemsLedger';
import ItemWisePurchase from './pages/inventory/ItemWisePurchase';
import SupplierWisePurchase from './pages/inventory/SupplierWisePurchase';
import IssuanceReports from './pages/inventory/IssuanceReports';
import StockReconciliation from './pages/inventory/StockReconciliation';
import OpeningStock from './pages/inventory/OpeningStock';
import Recipes from './pages/inventory/Recipes';
import ProductionOrders from './pages/inventory/ProductionOrders';

// HR Module
import Customers from './pages/hr/Customers';
import Staff from './pages/hr/Staff';
import Attendance from './pages/hr/Attendance';
import DailyAttendance from './pages/hr/DailyAttendance';
import SalarySheet from './pages/hr/SalarySheet';
import PayrollProcessing from './pages/hr/PayrollProcessing';
import SalaryVoucher from './pages/hr/SalaryVoucher';
import AdvancePayments from './pages/hr/AdvancePayments';
import LoanManagement from './pages/hr/LoanManagement';
import IncrementHistory from './pages/hr/IncrementHistory';
import EmployeeLedger from './pages/hr/EmployeeLedger';
import HolidayCalendar from './pages/hr/HolidayCalendar';
import LeaveRequests from './pages/hr/LeaveRequests';
import StaffReports from './pages/hr/StaffReports';
import Departments from './pages/hr/Departments';
import SalaryComponents from './pages/hr/SalaryComponents';
import Appraisals from './pages/hr/Appraisals';
import ExitManagement from './pages/hr/ExitManagement';
import LeavePolicies from './pages/hr/LeavePolicies';

// Accounts Module
import ChartOfAccounts from './pages/accounts/ChartOfAccounts';
import JournalEntries from './pages/accounts/JournalEntries';
import GeneralLedger from './pages/accounts/GeneralLedger';
import TrialBalance from './pages/accounts/TrialBalance';
import TrialBalance6Col from './pages/accounts/TrialBalance6Col';
import ProfitLoss from './pages/accounts/ProfitLoss';
import BalanceSheet from './pages/accounts/BalanceSheet';
import BankAccounts from './pages/accounts/BankAccounts';
import PaymentVouchers from './pages/accounts/PaymentVouchers';
import ReceiptVouchers from './pages/accounts/ReceiptVouchers';
import Analytics from './pages/accounts/Analytics';
import Reports from './pages/accounts/Reports';
import SalesAnalytics from './pages/SalesAnalytics';

// Restaurant Module
import TableManagement from './pages/restaurant/TableManagement';

// System Module
import Stores from './pages/system/Stores';
import AccessControl from './pages/system/AccessControl';
import AuditLog from './pages/system/AuditLog';
import Backup from './pages/system/Backup';
import SettingsPage from './pages/system/Settings';
import EmailSettings from './pages/system/EmailSettings';
import { CartProvider } from './context/CartContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { SettingsProvider } from './context/SettingsContext';


// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
      <ToastProvider>
      <CartProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Routes>
                      {/* Unguarded - all authenticated users */}
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/pos" element={<POS />} />
                      <Route path="/walk-in-orders" element={<WalkInOrders />} />
                      <Route path="/cash-register" element={<CashRegister />} />

                      {/* Sales */}
                      <Route path="/orders" element={<PermissionGuard moduleKey="sales.orders"><Orders /></PermissionGuard>} />
                      <Route path="/customers" element={<PermissionGuard moduleKey="sales.customers"><Customers /></PermissionGuard>} />
                      <Route path="/returns" element={<PermissionGuard moduleKey="sales.returns"><Returns /></PermissionGuard>} />
                      <Route path="/quotations" element={<PermissionGuard moduleKey="sales.quotations"><Quotations /></PermissionGuard>} />
                      <Route path="/credit-sales" element={<PermissionGuard moduleKey="sales.credit"><CreditSales /></PermissionGuard>} />
                      <Route path="/price-rules" element={<PermissionGuard moduleKey="sales.pricerules"><PriceRules /></PermissionGuard>} />
                      <Route path="/sales-targets" element={<PermissionGuard moduleKey="sales.targets"><SalesTargets /></PermissionGuard>} />
                      <Route path="/deliveries" element={<PermissionGuard moduleKey="sales.deliveries"><Deliveries /></PermissionGuard>} />
                      <Route path="/done-orders" element={<PermissionGuard moduleKey="sales.orders"><DoneOrders /></PermissionGuard>} />
                      <Route path="/sales-reports" element={<PermissionGuard moduleKey="sales.reports"><SalesReports /></PermissionGuard>} />
                      <Route path="/sales-analytics" element={<PermissionGuard moduleKey="sales.reports"><SalesAnalytics /></PermissionGuard>} />
                      {/* Restaurant */}
                      <Route path="/restaurant/tables" element={<PermissionGuard moduleKey="restaurant.tables"><TableManagement /></PermissionGuard>} />

                      {/* Inventory */}
                      <Route path="/inventory" element={<PermissionGuard moduleKey="inventory.products"><Inventory /></PermissionGuard>} />
                      <Route path="/finished-goods" element={<PermissionGuard moduleKey="inventory.products"><FinishedGoods /></PermissionGuard>} />
                      <Route path="/raw-materials" element={<PermissionGuard moduleKey="inventory.products"><RawMaterials /></PermissionGuard>} />
                      <Route path="/categories" element={<PermissionGuard moduleKey="inventory.categories"><Categories /></PermissionGuard>} />
                      <Route path="/purchase-orders" element={<PermissionGuard moduleKey="inventory.purchases"><PurchaseOrders /></PermissionGuard>} />
                      <Route path="/stock-transfers" element={<PermissionGuard moduleKey="inventory.transfers"><StockTransfers /></PermissionGuard>} />
                      <Route path="/stock-adjustments" element={<PermissionGuard moduleKey="inventory.adjustments"><StockAdjustments /></PermissionGuard>} />
                      <Route path="/stock-alerts" element={<PermissionGuard moduleKey="inventory.alerts"><StockAlerts /></PermissionGuard>} />
                      <Route path="/suppliers" element={<PermissionGuard moduleKey="inventory.suppliers"><Suppliers /></PermissionGuard>} />
                      <Route path="/inventory-reports" element={<PermissionGuard moduleKey="inventory.reports"><InventoryReports /></PermissionGuard>} />
                      <Route path="/bundles" element={<PermissionGuard moduleKey="inventory.bundles"><Bundles /></PermissionGuard>} />
                      <Route path="/product-variants" element={<PermissionGuard moduleKey="inventory.variants"><ProductVariants /></PermissionGuard>} />
                      <Route path="/stock-count" element={<PermissionGuard moduleKey="inventory.stockcount"><StockCount /></PermissionGuard>} />
                      <Route path="/products" element={<PermissionGuard moduleKey="inventory.products"><Products /></PermissionGuard>} />
                      <Route path="/purchase-voucher" element={<PermissionGuard moduleKey="inventory.purchases"><PurchaseVoucher /></PermissionGuard>} />
                      <Route path="/purchase-return" element={<PermissionGuard moduleKey="inventory.purchases"><PurchaseReturn /></PermissionGuard>} />
                      <Route path="/stock-issue" element={<PermissionGuard moduleKey="inventory.adjustments"><StockIssue /></PermissionGuard>} />
                      <Route path="/stock-return-issuance" element={<PermissionGuard moduleKey="inventory.adjustments"><StockReturnIssuance /></PermissionGuard>} />
                      <Route path="/raw-sale" element={<PermissionGuard moduleKey="inventory.adjustments"><RawSale /></PermissionGuard>} />
                      <Route path="/sections" element={<PermissionGuard moduleKey="inventory.adjustments"><Sections /></PermissionGuard>} />
                      <Route path="/items-ledger" element={<PermissionGuard moduleKey="inventory.reports"><ItemsLedger /></PermissionGuard>} />
                      <Route path="/item-wise-purchase" element={<PermissionGuard moduleKey="inventory.reports"><ItemWisePurchase /></PermissionGuard>} />
                      <Route path="/supplier-wise-purchase" element={<PermissionGuard moduleKey="inventory.reports"><SupplierWisePurchase /></PermissionGuard>} />
                      <Route path="/issuance-reports" element={<PermissionGuard moduleKey="inventory.reports"><IssuanceReports /></PermissionGuard>} />
                      <Route path="/stock-reconciliation" element={<PermissionGuard moduleKey="inventory.reports"><StockReconciliation /></PermissionGuard>} />
                      <Route path="/opening-stock" element={<PermissionGuard moduleKey="inventory.products"><OpeningStock /></PermissionGuard>} />
                      <Route path="/recipes" element={<PermissionGuard moduleKey="inventory.products"><Recipes /></PermissionGuard>} />
                      <Route path="/production-orders" element={<PermissionGuard moduleKey="inventory.products"><ProductionOrders /></PermissionGuard>} />

                      {/* HR */}
                      <Route path="/staff" element={<PermissionGuard moduleKey="hr.staff"><Staff /></PermissionGuard>} />
                      <Route path="/attendance" element={<PermissionGuard moduleKey="hr.attendance"><Attendance /></PermissionGuard>} />
                      <Route path="/daily-attendance" element={<PermissionGuard moduleKey="hr.daily-attendance"><DailyAttendance /></PermissionGuard>} />
                      <Route path="/salary-sheet" element={<PermissionGuard moduleKey="hr.salary-sheet"><SalarySheet /></PermissionGuard>} />
                      <Route path="/salary-voucher" element={<PermissionGuard moduleKey="hr.salary-sheet"><SalaryVoucher /></PermissionGuard>} />
                      <Route path="/payroll" element={<PermissionGuard moduleKey="hr.payroll"><PayrollProcessing /></PermissionGuard>} />
                      <Route path="/advance-payments" element={<PermissionGuard moduleKey="hr.advances"><AdvancePayments /></PermissionGuard>} />
                      <Route path="/loans" element={<PermissionGuard moduleKey="hr.loans"><LoanManagement /></PermissionGuard>} />
                      <Route path="/increments" element={<PermissionGuard moduleKey="hr.increments"><IncrementHistory /></PermissionGuard>} />
                      <Route path="/employee-ledger" element={<PermissionGuard moduleKey="hr.ledger"><EmployeeLedger /></PermissionGuard>} />
                      <Route path="/holidays" element={<PermissionGuard moduleKey="hr.holidays"><HolidayCalendar /></PermissionGuard>} />
                      <Route path="/leave-requests" element={<PermissionGuard moduleKey="hr.leaves"><LeaveRequests /></PermissionGuard>} />
                      <Route path="/staff-reports" element={<PermissionGuard moduleKey="hr.reports"><StaffReports /></PermissionGuard>} />
                      <Route path="/departments" element={<PermissionGuard moduleKey="hr.departments"><Departments /></PermissionGuard>} />
                      <Route path="/salary-components" element={<PermissionGuard moduleKey="hr.salary-components"><SalaryComponents /></PermissionGuard>} />
                      <Route path="/appraisals" element={<PermissionGuard moduleKey="hr.appraisals"><Appraisals /></PermissionGuard>} />
                      <Route path="/exit-management" element={<PermissionGuard moduleKey="hr.exit"><ExitManagement /></PermissionGuard>} />
                      <Route path="/leave-policies" element={<PermissionGuard moduleKey="hr.leaves"><LeavePolicies /></PermissionGuard>} />

                      {/* Accounts */}
                      <Route path="/chart-of-accounts" element={<PermissionGuard moduleKey="accounts.chart"><ChartOfAccounts /></PermissionGuard>} />
                      <Route path="/journal-entries" element={<PermissionGuard moduleKey="accounts.journal"><JournalEntries /></PermissionGuard>} />
                      <Route path="/general-ledger" element={<PermissionGuard moduleKey="accounts.ledger"><GeneralLedger /></PermissionGuard>} />
                      <Route path="/trial-balance" element={<PermissionGuard moduleKey="accounts.trial-balance"><TrialBalance /></PermissionGuard>} />
                      <Route path="/trial-balance-6col" element={<PermissionGuard moduleKey="accounts.trial-balance-6col"><TrialBalance6Col /></PermissionGuard>} />
                      <Route path="/profit-loss" element={<PermissionGuard moduleKey="accounts.profit-loss"><ProfitLoss /></PermissionGuard>} />
                      <Route path="/balance-sheet" element={<PermissionGuard moduleKey="accounts.balance-sheet"><BalanceSheet /></PermissionGuard>} />
                      <Route path="/bank-accounts" element={<PermissionGuard moduleKey="accounts.bank-accounts"><BankAccounts /></PermissionGuard>} />
                      <Route path="/payment-vouchers" element={<PermissionGuard moduleKey="accounts.payment-vouchers"><PaymentVouchers /></PermissionGuard>} />
                      <Route path="/receipt-vouchers" element={<PermissionGuard moduleKey="accounts.receipt-vouchers"><ReceiptVouchers /></PermissionGuard>} />
                      <Route path="/analytics" element={<PermissionGuard moduleKey="accounts.analytics"><Analytics /></PermissionGuard>} />
                      <Route path="/reports" element={<PermissionGuard moduleKey="accounts.reports"><Reports /></PermissionGuard>} />

                      {/* System */}
                      <Route path="/stores" element={<PermissionGuard moduleKey="system.stores"><Stores /></PermissionGuard>} />
                      <Route path="/access-control" element={<PermissionGuard moduleKey="system.settings"><AccessControl /></PermissionGuard>} />
                      <Route path="/audit-log" element={<PermissionGuard moduleKey="system.audit"><AuditLog /></PermissionGuard>} />
                      <Route path="/backup" element={<PermissionGuard moduleKey="system.backup"><Backup /></PermissionGuard>} />
                      <Route path="/settings" element={<PermissionGuard moduleKey="system.settings"><SettingsPage /></PermissionGuard>} />
                      <Route path="/email-settings" element={<PermissionGuard moduleKey="system.settings"><EmailSettings /></PermissionGuard>} />
                      <Route path="/help" element={<HelpSupport />} />
                    </Routes>
                  </Layout>
                </ProtectedRoute>
              }
            />
          <Route path="*" element={<NotFound />} />
          </Routes>
        </Router>
      </CartProvider>
      </ToastProvider>
      </SettingsProvider>
      <PWAInstallPrompt />
    </AuthProvider>
  );
}

export default App;
