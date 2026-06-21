// =============================================================
// moduleGuard.js - Module-based Access Control
// Each client subscribes to individual modules.
// Modules are stored per-tenant in abyte_master.tenant_configs
// =============================================================

// Available modules with pricing (PKR/month)
const MODULES = {
  sales: {
    key: 'sales',
    name: 'Sale',
    price: 2250,
    description: 'POS, Orders, Returns, Credit Sales, Quotations, Deliveries',
  },
  inventory: {
    key: 'inventory',
    name: 'Inventory',
    price: 2250,
    description: 'Products, Stock, Purchase Orders, GRN, Suppliers',
  },
  accounts: {
    key: 'accounts',
    name: 'Accounts',
    price: 2999,
    description: 'Journal Entries, Vouchers, Bank Accounts, Ledger',
  },
  hr: {
    key: 'hr',
    name: 'HR & Payroll',
    price: 2999,
    description: 'Staff, Attendance, Salary, Leaves, Loans',
  },
};

// Legacy plan support (kept for backward compatibility)
const PLAN_MODULES = {
  basic: ['sales', 'inventory'],
  professional: ['sales', 'inventory', 'accounts'],
  enterprise: ['sales', 'inventory', 'accounts', 'hr'],
};

// --- requireModule(moduleName) ---
// Checks if current tenant has subscribed to the module.
// Must be used AFTER authenticate middleware.
const requireModule = (moduleName) => {
  return (req, res, next) => {
    // Single-client mode or no tenant context — allow all
    if (!req.modules || req.modules.length === 0) return next();

    const enabled = req.modules;
    if (Array.isArray(enabled) && enabled.includes(moduleName)) {
      return next();
    }

    const mod = MODULES[moduleName];
    return res.status(403).json({
      message: `This feature requires the "${mod?.name || moduleName}" module.`,
      module: moduleName,
      price: mod?.price || null,
      upgrade_required: true,
    });
  };
};

// --- calculatePrice(modules[]) ---
// Returns total monthly price for selected modules
const calculatePrice = (selectedModules = []) => {
  return selectedModules.reduce((total, key) => {
    return total + (MODULES[key]?.price || 0);
  }, 0);
};

// --- getModuleList() ---
// Returns all available modules with pricing
const getModuleList = () => Object.values(MODULES);

const getPlanModules = (plan) => PLAN_MODULES[plan] || PLAN_MODULES.basic;
const isModuleAllowed = (modulesEnabled, moduleName) => {
  if (!modulesEnabled) return true;
  return Array.isArray(modulesEnabled) && modulesEnabled.includes(moduleName);
};

module.exports = {
  requireModule,
  calculatePrice,
  getModuleList,
  getPlanModules,
  isModuleAllowed,
  PLAN_MODULES,
  MODULES,
};
