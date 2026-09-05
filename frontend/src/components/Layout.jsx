import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, MessageSquare, FileText, Smartphone,
  LogOut, Menu, X, Scissors, Receipt, Settings as SettingsIcon, CreditCard,
  Sun, Moon,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import TrialBanner from './TrialBanner';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/invoice', icon: Receipt, label: 'Invoice' },
  { to: '/services', icon: SettingsIcon, label: 'Services' },
  { to: '/whatsapp', icon: Smartphone, label: 'WhatsApp' },
  { to: '/templates', icon: FileText, label: 'Templates' },
  { to: '/message-logs', icon: MessageSquare, label: 'Message Logs' },
  { to: '/billing', icon: CreditCard, label: 'Billing' },
  { to: '/settings', icon: SettingsIcon, label: 'Settings' },
];

export default function Layout({ children }) {
  const { admin, tenant, logout, daysLeft, subscription } = useAuth();
  const { toggleTheme, isDark } = useTheme();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  const sidebar = (
    <aside className="flex flex-col h-full bg-surface-soft border-r border-surface-border">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-surface-border">
        {tenant?.logoUrl ? (
          <img src={tenant.logoUrl} alt={tenant?.name || 'Logo'} className="h-10 w-10 rounded-lg object-cover" />
        ) : (
          <div className="p-2 rounded-xl bg-accent-soft text-accent">
            <Scissors size={22} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-ink text-base leading-tight truncate max-w-[130px]">
            {tenant?.name || 'CRM Pro'}
          </h1>
          <p className="text-xs text-ink-muted capitalize">{tenant?.businessType || 'Business'}</p>
        </div>
      </div>

      <div className="px-5 py-3 border-b border-surface-border">
        <button
          onClick={toggleTheme}
          className="btn-ghost w-full justify-between"
          type="button"
        >
          <span className="text-sm font-medium text-ink-muted">
            {isDark ? 'Dark Mode' : 'Light Mode'}
          </span>
          {isDark ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }>
            <Icon size={18} />
            {label}
            {label === 'Billing' && subscription?.status === 'trial' && daysLeft <= 3 && (
              <span className="ml-auto text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full">{daysLeft}d</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-surface-border">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-accent-soft flex items-center justify-center text-accent text-sm font-bold shrink-0">
            {admin?.name?.charAt(0)?.toUpperCase() || 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-ink truncate">{admin?.name}</p>
            <p className="text-xs text-ink-muted truncate">{admin?.email}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="sidebar-link w-full text-red-500 hover:text-red-500">
          <LogOut size={16} /> Logout
        </button>
      </div>
    </aside>
  );

  return (
    <div className="h-screen flex overflow-hidden">
      <div className="hidden lg:flex lg:w-72 lg:flex-shrink-0">{sidebar}</div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 modal-backdrop" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-72 z-50">{sidebar}</div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <TrialBanner />

        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-surface-elevated border-b border-surface-border">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl hover:bg-surface-soft text-ink-muted">
            <Menu size={20} />
          </button>
          <span className="font-semibold text-ink">{tenant?.name || 'CRM Pro'}</span>
          <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-xl hover:bg-surface-soft text-ink-muted opacity-0 pointer-events-none">
            <X size={20} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
