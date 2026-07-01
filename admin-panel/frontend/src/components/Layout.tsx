import { type ReactNode, useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, LogOut, Settings, ChevronRight, Menu,
  Activity, TrendingUp, ClipboardList, FileText, LifeBuoy, Bell, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const navItems = [
  { to: '/',         label: 'Dashboard', icon: LayoutDashboard },
  { to: '/clients',  label: 'Clients',   icon: Users },
  { to: '/revenue',  label: 'Revenue',   icon: TrendingUp },
  { to: '/activity', label: 'Activity',  icon: Activity },
  { to: '/invoices', label: 'Invoices',  icon: FileText },
  { to: '/tickets',  label: 'Tickets',   icon: LifeBuoy },
  { to: '/audit',    label: 'Audit Log', icon: ClipboardList },
  { to: '/settings', label: 'Settings',  icon: Settings },
];

const breadcrumbMap: Record<string, string> = {
  '/':          'Dashboard',
  '/clients':   'Clients',
  '/revenue':   'Revenue',
  '/activity':  'Activity',
  '/invoices':  'Invoices',
  '/tickets':   'Tickets',
  '/audit':     'Audit Log',
  '/settings':  'Settings',
};

interface LoginActivity {
  tenant_name: string;
  user_name: string;
  ip_address: string;
  created_at: string;
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function NotificationBell() {
  const [open, setOpen]         = useState(false);
  const [activity, setActivity] = useState<LoginActivity[]>([]);
  const [loading, setLoading]   = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchActivity = () => {
    setLoading(true);
    api.get('/tenants/recent-activity')
      .then(r => setActivity(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  // Poll every 60 seconds
  useEffect(() => {
    fetchActivity();
    const interval = setInterval(fetchActivity, 60000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = () => {
    setOpen(o => !o);
    if (!open) fetchActivity();
  };

  const oneHourAgo = Date.now() - 3600000;
  const hasRecent  = activity.some(a => new Date(a.created_at).getTime() > oneHourAgo);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
        title="Recent login activity"
      >
        <Bell size={17} />
        {hasRecent && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Bell size={13} className="text-emerald-600" />
              <span className="text-xs font-bold text-slate-700">Recent Logins</span>
              <span className="text-[10px] text-slate-400">(last 24h)</span>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors">
              <X size={13} />
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {loading ? (
              <div className="py-6 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : activity.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                <Bell size={24} className="mx-auto mb-2 text-slate-200" />
                <p className="text-xs">No logins in last 24 hours</p>
              </div>
            ) : (
              activity.slice(0, 10).map((item, i) => {
                const isRecent = new Date(item.created_at).getTime() > oneHourAgo;
                return (
                  <div key={i} className={`flex items-start gap-3 px-4 py-2.5 border-b border-slate-50 last:border-0 ${isRecent ? 'bg-emerald-50/40' : ''}`}>
                    <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center text-[10px] font-bold text-emerald-700 flex-shrink-0 mt-0.5">
                      {(item.user_name || '?')[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-700 truncate">{item.user_name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{item.tenant_name}</p>
                      <p className="text-[10px] text-slate-300 mt-0.5">{item.ip_address} · {timeAgo(item.created_at)}</p>
                    </div>
                    {isRecent && (
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-2 flex-shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  const initials = admin?.name
    ? admin.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : admin?.email?.[0]?.toUpperCase() ?? 'A';

  const breadcrumb = breadcrumbMap[location.pathname]
    ?? (location.pathname.startsWith('/clients/') ? 'Client Detail' : 'Page');

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/[0.08] relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center shadow-lg shadow-emerald-900/50 bg-white flex-shrink-0">
            <img src="/logo.png" alt="AByte" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-white font-bold text-base leading-tight">
              Abyte <span className="text-emerald-400">ERP</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-medium tracking-wide">Admin Console</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 relative z-10 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group overflow-hidden ${
                isActive
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-emerald-400 rounded-r-full" />
                )}
                <Icon
                  size={17}
                  className={`flex-shrink-0 transition-colors ${
                    isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-emerald-400'
                  }`}
                />
                <span>{label}</span>
                {isActive && <ChevronRight size={14} className="ml-auto text-emerald-400/60" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="px-3 py-3 border-t border-white/[0.08] relative z-10">
        <div className="flex items-center gap-3 px-3 py-2.5 bg-white/[0.06] border border-white/[0.07] rounded-xl mb-1.5">
          <div className="relative flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-emerald-900/40">
              {initials}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-slate-900 rounded-full" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-slate-200 text-xs font-semibold truncate">{admin?.name || 'Admin'}</p>
            <p className="text-slate-500 text-[10px] truncate">{admin?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 w-full text-slate-500 hover:text-red-400 hover:bg-red-500/8 rounded-lg text-sm font-medium transition-all duration-150 group"
        >
          <LogOut size={15} className="group-hover:text-red-400 transition-colors" />
          Sign Out
        </button>
        <div className="mt-2.5 mx-0.5 px-3 py-1.5 bg-white/[0.03] border border-white/[0.05] rounded-lg flex items-center justify-between">
          <p className="text-[10px] text-slate-600 font-medium">AByte ERP</p>
          <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 px-1.5 py-0.5 rounded font-bold tracking-wide">v1.0</span>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50/60">
      {/* Desktop Sidebar */}
      <aside
        style={{ background: 'linear-gradient(160deg, #0a1628 0%, #0f172a 45%, #111827 100%)' }}
        className="hidden lg:flex w-60 flex-col flex-shrink-0 border-r border-white/[0.06] relative shadow-xl"
      >
        {/* Ambient glow */}
        <div className="absolute top-0 left-0 right-0 h-36 bg-emerald-500/6 blur-3xl pointer-events-none" />
        {/* Dot grid */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.025]" style={{
          backgroundImage: 'radial-gradient(circle, #10b981 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }} />
        <div className="relative flex flex-col h-full">
          <SidebarContent />
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside
            style={{ background: 'linear-gradient(160deg, #0a1628 0%, #0f172a 50%, #111827 100%)' }}
            className="relative w-60 h-full flex flex-col shadow-2xl border-r border-white/[0.06]"
          >
            <div className="absolute top-0 left-0 right-0 h-32 bg-emerald-500/6 blur-3xl pointer-events-none" />
            <div className="relative flex flex-col h-full">
              <SidebarContent />
            </div>
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header
          className="h-14 bg-white/95 backdrop-blur-xl border-b border-slate-200/80 flex items-center px-4 lg:px-6 gap-4 flex-shrink-0"
          style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.05), 0 2px 10px rgba(0,0,0,0.04)' }}
        >
          <button
            className="lg:hidden p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>

          {/* Page title with accent */}
          <div className="flex items-center gap-3">
            <div className="h-6 w-0.5 bg-gradient-to-b from-emerald-400 to-teal-500 rounded-full" />
            <div>
              <p className="text-sm font-bold text-slate-800 leading-tight">{breadcrumb}</p>
              <p className="text-[11px] text-slate-400 leading-tight font-medium">
                {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Notification Bell */}
            <NotificationBell />

            <div className="hidden sm:flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Super Admin
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto bg-slate-50/50">
          {children}
        </main>
      </div>
    </div>
  );
}
