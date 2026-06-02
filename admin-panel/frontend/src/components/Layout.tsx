import { type ReactNode, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, LogOut, Settings, ChevronRight, Menu, Activity, TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/',         label: 'Dashboard', icon: LayoutDashboard },
  { to: '/clients',  label: 'Clients',   icon: Users },
  { to: '/revenue',  label: 'Revenue',   icon: TrendingUp },
  { to: '/activity', label: 'Activity',  icon: Activity },
  { to: '/settings', label: 'Settings',  icon: Settings },
];

const breadcrumbMap: Record<string, string> = {
  '/':         'Dashboard',
  '/clients':  'Clients',
  '/revenue':  'Revenue',
  '/activity': 'Activity',
  '/settings': 'Settings',
};

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
      <div className="px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center shadow-lg bg-white">
            <img src="/logo.png" alt="AByte" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-white font-bold text-base leading-tight">AByte POS</h1>
            <p className="text-slate-400 text-xs">Admin Console</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-emerald-500/20 text-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={17} className={isActive ? 'text-emerald-400' : ''} />
                {label}
                {isActive && <ChevronRight size={14} className="ml-auto text-emerald-400/60" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="px-3 py-4 border-t border-white/10 space-y-2">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-emerald-500/30 border border-emerald-500/40 flex items-center justify-center text-emerald-300 text-xs font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-slate-200 text-xs font-medium truncate">{admin?.name || 'Admin'}</p>
            <p className="text-slate-500 text-xs truncate">{admin?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl text-sm font-medium transition-all duration-150"
        >
          <LogOut size={17} />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-60 flex-col flex-shrink-0 bg-slate-900">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-60 h-full flex flex-col bg-slate-900 shadow-2xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 lg:px-6 gap-4 flex-shrink-0">
          <button
            className="lg:hidden p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="text-slate-400">AByte</span>
            <ChevronRight size={14} />
            <span className="text-slate-700 font-medium">{breadcrumb}</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Super Admin
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
