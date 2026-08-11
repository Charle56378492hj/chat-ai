import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { Logo, Badge } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import {
  LayoutDashboard, MessageSquare, Users, Package, ShoppingCart, Bot,
  Zap, FileText, Workflow, BarChart3, Plug, Shield, ScrollText, CreditCard,
  Settings, HelpCircle, LogOut, Menu, X, Crown, Smartphone, Code, FlaskConical,
  MessageCircle, Bell, Search,
} from 'lucide-react';
import { useState } from 'react';

const navGroups = [
  {
    title: 'الرئيسية',
    items: [
      { to: '/app', label: 'لوحة التحكم', icon: LayoutDashboard, end: true },
      { to: '/app/inbox', label: 'المحادثات', icon: MessageSquare },
      { to: '/app/orders', label: 'الطلبات', icon: ShoppingCart },
      { to: '/app/customers', label: 'العملاء', icon: Users },
      { to: '/app/products', label: 'المنتجات', icon: Package },
    ],
  },
  {
    title: 'الذكاء والأتمتة',
    items: [
      { to: '/app/ai-studio', label: 'استوديو الذكاء', icon: Bot },
      { to: '/app/automation', label: 'قواعد الأتمتة', icon: Zap },
      { to: '/app/templates', label: 'القوالب', icon: FileText },
      { to: '/app/workflows', label: 'Workflows', icon: Workflow },
    ],
  },
  {
    title: 'الإدارة',
    items: [
      { to: '/app/team', label: 'الفريق', icon: Users },
      { to: '/app/analytics', label: 'التحليلات', icon: BarChart3 },
      { to: '/app/connections', label: 'القنوات', icon: Plug },
      { to: '/app/whatsapp', label: 'واتساب', icon: MessageCircle },
    ],
  },
  {
    title: 'النظام',
    items: [
      { to: '/app/security', label: 'الأمان', icon: Shield },
      { to: '/app/logs', label: 'السجلات', icon: ScrollText },
      { to: '/app/billing', label: 'الفوترة', icon: CreditCard },
      { to: '/app/settings', label: 'الإعدادات', icon: Settings },
      { to: '/app/help', label: 'مركز المساعدة', icon: HelpCircle },
    ],
  },
  {
    title: 'متقدم',
    items: [
      { to: '/app/admin', label: 'الإدارة العليا', icon: Crown },
      { to: '/app/api-docs', label: 'API / Developer', icon: Code },
      { to: '/app/sandbox', label: 'Sandbox', icon: FlaskConical },
    ],
  },
];

export function AppLayout() {
  const { merchant, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-100">
        <Logo />
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-6">
        {navGroups.map((group) => (
          <div key={group.title}>
            <div className="px-3 mb-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">{group.title}</div>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
                >
                  <item.icon size={18} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="p-3 border-t border-slate-100">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
            {merchant?.company_name?.charAt(0) ?? 'م'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-slate-900 truncate">{merchant?.company_name ?? 'متجري'}</div>
            <div className="text-xs text-slate-500 truncate">{user?.email}</div>
          </div>
          <button onClick={handleSignOut} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-red-500" title="تسجيل خروج">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 bg-white border-l border-slate-200 flex-col fixed inset-y-0 right-0 z-30">
        {sidebar}
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-white h-full animate-slide-in">
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 lg:mr-64 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 -mr-2" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <div className="relative hidden sm:block">
              <Search size={18} className="absolute right-3 top-2.5 text-slate-400" />
              <input className="w-64 rounded-xl border border-slate-200 bg-slate-50 pr-10 pl-4 py-2 text-sm focus:bg-white focus:border-sky-400 outline-none" placeholder="بحث..." />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge color="green"><span className="h-2 w-2 rounded-full bg-green-500" /> نشط</Badge>
            <button className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 relative">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
            </button>
            <Link to="/app/sandbox" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden">
              <Smartphone size={20} />
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
