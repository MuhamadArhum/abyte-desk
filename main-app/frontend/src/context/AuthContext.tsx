import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { branchFilter } from '../utils/api';

// ─── Types ────────────────────────────────────────────────────
interface User {
  user_id:     number;
  username?:   string;
  name:        string;
  email:       string;
  role?:       string;
  role_name:   string;
  branch_id?:  number | null;
  branch_name?: string | null;
}

// Kept for invoice template compatibility
export interface TenantConfig {
  company_name?:         string;
  logo_url?:             string | null;
  primary_color?:        string;
  currency_symbol?:      string;
  currency_code?:        string;
  timezone?:             string;
  tax_name?:             string;
  tax_rate?:             number;
  ntn?:                  string | null;
  strn?:                 string | null;
  is_tax_exempt?:        boolean;
  receipt_header?:       string | null;
  receipt_footer?:       string | null;
  show_tax_on_receipt?:  boolean;
  show_logo_on_receipt?: boolean;
  show_ntn_on_receipt?:  boolean;
  plan?:                 string;
  modules_allowed?:      string[];
  modules_enabled?:      string[];
}

interface AuthContextType {
  user:                 User | null;
  token:                string | null;
  tenantConfig:         TenantConfig | null;
  login:                (token: string, user: User, permissions: string[] | null, modules?: string[]) => void;
  logout:               () => void;
  updateUser:           (patch: Partial<User>) => void;
  setTenantConfig:      (config: TenantConfig) => void;
  isAuthenticated:      boolean;
  isLoading:            boolean;
  permissions:          string[] | null;
  modules:              string[];
  hasPermission:        (moduleKey: string) => boolean;
  canDo:                (moduleKey: string, action: 'create' | 'update' | 'delete') => boolean;
  hasModule:            (moduleName: string) => boolean;
  currentPlan:          string;
  currencySymbol:       string;
  refreshPermissions:   () => void;
  // Multi-branch: admin can select a specific branch to view, or null = all branches
  activeBranchId:       number | null;
  setActiveBranchId:    (id: number | null) => void;
  isAdmin:              boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user,           setUser]           = useState<User | null>(null);
  const [token,          setToken]          = useState<string | null>(null);
  const [permissions,    setPermissions]    = useState<string[] | null>(null);
  const [modules,        setModules]        = useState<string[]>([]);
  const [tenantConfig,   setTenantConfig]   = useState<TenantConfig | null>(null);
  const [isLoading,      setIsLoading]      = useState(true);
  const [activeBranchId, _setActiveBranchId] = useState<number | null>(null);

  const setActiveBranchId = useCallback((id: number | null) => {
    branchFilter.id = id;  // sync axios interceptor
    _setActiveBranchId(id);
  }, []);

  // Restore session from localStorage on app load — only token is persisted, user data always fetched fresh
  useEffect(() => {
    const storedToken = localStorage.getItem('token');

    if (storedToken) {
      setToken(storedToken);
      const apiBase = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';
      fetch(`${apiBase}/auth/verify`, {
        headers: { Authorization: `Bearer ${storedToken}` },
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.user) {
            setUser(data.user);
            setPermissions(data.permissions);
            setModules(data.modules || []);
          } else {
            localStorage.removeItem('token');
            setToken(null);
          }
        })
        .catch(() => { /* network failure — token kept, user loads on retry */ })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  // Exposed refresh function — can be called on-demand (e.g. after Access Control save)
  const refreshPermissions = useCallback(() => {
    if (!token) return;
    const apiBase = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';
    fetch(`${apiBase}/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.user) {
          setUser(data.user);
          setPermissions(data.permissions);
          setModules(data.modules || []);
        }
      })
      .catch(() => {});
  }, [token]);

  // Poll permissions every 60 seconds + refresh when tab becomes visible again
  // so that Access Control changes by admin take effect without re-login
  useEffect(() => {
    if (!token) return;

    const interval = setInterval(refreshPermissions, 60_000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshPermissions();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [token, refreshPermissions]);

  const login = useCallback((newToken: string, newUser: User, newPermissions: string[] | null, newModules: string[] = []) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(newUser);
    setPermissions(newPermissions);
    setModules(newModules);
  }, []);

  const updateUser = useCallback((patch: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      return { ...prev, ...patch };
    });
  }, []);

  const logout = useCallback(() => {
    // Revoke token server-side (fire-and-forget — don't block logout on network failure)
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${storedToken}` },
      }).catch(() => { /* ignore network errors during logout */ });
    }

    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setPermissions(null);
    setModules([]);
    setTenantConfig(null);
  }, []);

  const saveTenantConfig = useCallback((config: TenantConfig) => {
    setTenantConfig(config);
  }, []);

  // RBAC: check individual module key or any sub-key (e.g. 'sales' matches 'sales.pos')
  const hasPermission = useCallback((moduleKey: string): boolean => {
    if (permissions === null) return true; // Admin: full access
    return permissions.some(p => p === moduleKey || p.startsWith(`${moduleKey}.`));
  }, [permissions]);

  // CRUD sub-permission check: canDo('inventory.products', 'create')
  const canDo = useCallback((moduleKey: string, action: 'create' | 'update' | 'delete'): boolean => {
    if (permissions === null) return true; // Admin: full access
    return permissions.includes(`${moduleKey}.${action}`);
  }, [permissions]);

  // Multi-tenant: check if module is enabled for this tenant
  const hasModule = useCallback((moduleName: string): boolean => {
    if (modules.length === 0) return true; // fallback: allow all if not set
    return modules.includes(moduleName);
  }, [modules]);

  const currentPlan    = modules.length > 0 ? 'active' : 'enterprise';
  const currencySymbol = tenantConfig?.currency_symbol || 'Rs.';
  const isAdmin        = user?.role_name === 'Admin';

  const value = useMemo(() => ({
    user,
    token,
    tenantConfig,
    login,
    logout,
    updateUser,
    setTenantConfig: saveTenantConfig,
    isAuthenticated: !!token,
    isLoading,
    permissions,
    modules,
    hasPermission,
    canDo,
    hasModule,
    currentPlan,
    currencySymbol,
    refreshPermissions,
    activeBranchId,
    setActiveBranchId,
    isAdmin,
  }), [user, token, tenantConfig, login, logout, updateUser, saveTenantConfig, isLoading, permissions, modules, hasPermission, canDo, hasModule, currencySymbol, refreshPermissions, activeBranchId, isAdmin]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
