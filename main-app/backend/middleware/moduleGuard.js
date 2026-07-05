// =============================================================
// moduleGuard.js - Module-based Access Control
// Tenants subscribe to parent modules (sales, inventory, etc.)
// Sub-modules control which features within a module are enabled.
// Backward compatible: old tenants with ["sales"] get all sub-modules.
// =============================================================

const MODULES = {
  sales: {
    key: 'sales',
    name: 'Sale',
    price: 2250,
    description: 'POS, Orders, Returns, Credit Sales, Quotations, Deliveries',
    subModules: [
      { key: 'sales.pos',          label: 'Point of Sale' },
      { key: 'sales.orders',       label: 'Orders / Done Orders' },
      { key: 'sales.returns',      label: 'Sales Returns' },
      { key: 'sales.credit',       label: 'Credit Sales' },
      { key: 'sales.quotations',   label: 'Quotations' },
      { key: 'sales.deliveries',   label: 'Deliveries' },
      { key: 'sales.price-rules',  label: 'Price Rules' },
      { key: 'sales.targets',      label: 'Sales Targets' },
      { key: 'sales.loyalty',      label: 'Loyalty & Coupons' },
    ],
  },
  inventory: {
    key: 'inventory',
    name: 'Inventory',
    price: 2250,
    description: 'Products, Stock, Purchase Orders, GRN, Suppliers',
    subModules: [
      { key: 'inventory.products',          label: 'Products & Variants' },
      { key: 'inventory.purchase-orders',   label: 'Purchase Orders' },
      { key: 'inventory.suppliers',         label: 'Suppliers' },
      { key: 'inventory.stock-adjustments', label: 'Stock Adjustments' },
      { key: 'inventory.stock-transfers',   label: 'Stock Transfers' },
      { key: 'inventory.recipes',           label: 'Recipes / Manufacturing' },
      { key: 'inventory.issuance',          label: 'Stock Issuance' },
    ],
  },
  accounts: {
    key: 'accounts',
    name: 'Accounts',
    price: 2999,
    description: 'Journal Entries, Vouchers, Bank Accounts, Ledger',
    subModules: [
      { key: 'accounts.chart',    label: 'Chart of Accounts' },
      { key: 'accounts.journal',  label: 'Journal Entries' },
      { key: 'accounts.vouchers', label: 'Payment Vouchers' },
      { key: 'accounts.bank',     label: 'Bank Accounts' },
      { key: 'accounts.reports',  label: 'Financial Reports' },
    ],
  },
  hr: {
    key: 'hr',
    name: 'HR & Payroll',
    price: 2999,
    description: 'Staff, Attendance, Salary, Leaves, Loans',
    subModules: [
      { key: 'hr.staff',      label: 'Staff Management' },
      { key: 'hr.attendance', label: 'Attendance' },
      { key: 'hr.payroll',    label: 'Payroll' },
      { key: 'hr.leaves',     label: 'Leave Management' },
      { key: 'hr.loans',      label: 'Loans' },
      { key: 'hr.biometric',  label: 'Biometric Integration' },
    ],
  },
};

// Legacy plan support
const PLAN_MODULES = {
  basic:        ['sales', 'inventory'],
  professional: ['sales', 'inventory', 'accounts'],
  enterprise:   ['sales', 'inventory', 'accounts', 'hr'],
};

// --- hasModuleAccess(modules, key) ---
// Backward-compatible check:
//   Old format ["sales", "inventory"]: parent key grants all sub-modules
//   New format ["sales.pos", "sales.returns", ...]: exact match required
const hasModuleAccess = (modules, key) => {
  if (!Array.isArray(modules) || modules.length === 0) return false;

  // Exact match (handles both "sales" and "sales.pos")
  if (modules.includes(key)) return true;

  const parent = key.split('.')[0];
  const isSubKey = key.includes('.');

  if (isSubKey) {
    // Checking a sub-module key like "sales.returns"
    // Old format: if parent "sales" exists but NO sub-modules of that parent exist → grant all
    const hasParent = modules.includes(parent);
    const hasAnySubOfParent = modules.some(m => m.startsWith(parent + '.'));
    if (hasParent && !hasAnySubOfParent) return true;
  } else {
    // Checking a parent key like "sales"
    // Grant if any sub-module of this parent is enabled
    if (modules.some(m => m.startsWith(key + '.'))) return true;
  }

  return false;
};

// --- requireModule(moduleName) ---
const requireModule = (moduleName) => {
  return (req, res, next) => {
    if (!req.tenantId) return next();

    if (!req.modules || req.modules.length === 0) {
      const parent = moduleName.split('.')[0];
      const mod = MODULES[parent];
      return res.status(403).json({
        message: `This feature requires the "${mod?.name || moduleName}" module.`,
        module: moduleName,
        price: mod?.price || null,
        upgrade_required: true,
      });
    }

    if (hasModuleAccess(req.modules, moduleName)) return next();

    const parent = moduleName.split('.')[0];
    const mod = MODULES[parent];
    return res.status(403).json({
      message: `This feature requires the "${mod?.name || moduleName}" module.`,
      module: moduleName,
      price: mod?.price || null,
      upgrade_required: true,
    });
  };
};

// --- calculatePrice(modules[]) ---
// Counts unique parent modules only (Option A: bundle pricing)
const calculatePrice = (selectedModules = []) => {
  const parentKeys = new Set(selectedModules.map(m => m.split('.')[0]));
  return [...parentKeys].reduce((total, key) => {
    return total + (MODULES[key]?.price || 0);
  }, 0);
};

const getModuleList = () => Object.values(MODULES);
const getPlanModules = (plan) => PLAN_MODULES[plan] || PLAN_MODULES.basic;
const isModuleAllowed = (modulesEnabled, moduleName) => {
  if (!modulesEnabled) return true;
  return hasModuleAccess(modulesEnabled, moduleName);
};

// Returns all sub-module keys for a parent module
const getDefaultSubModules = (parentKey) => {
  return (MODULES[parentKey]?.subModules || []).map(s => s.key);
};

// Expand old-format ["sales", "inventory"] to full sub-module list
const expandToSubModules = (modules = []) => {
  const result = [];
  modules.forEach(m => {
    if (!m.includes('.')) {
      // Parent key — expand to all sub-modules
      result.push(...getDefaultSubModules(m));
    } else {
      result.push(m);
    }
  });
  return [...new Set(result)];
};

module.exports = {
  requireModule,
  calculatePrice,
  getModuleList,
  getPlanModules,
  isModuleAllowed,
  hasModuleAccess,
  getDefaultSubModules,
  expandToSubModules,
  PLAN_MODULES,
  MODULES,
};
