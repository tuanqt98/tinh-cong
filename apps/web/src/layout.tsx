import {
  BarChart3,
  Bell,
  CalendarCheck2,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FileSpreadsheet,
  History,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Send,
  Settings,
  Settings2,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Button, cn } from '@tinh-cong/ui';
import { useAuth } from './auth.js';

const items = [
  ['/dashboard', 'Dashboard', BarChart3],
  ['/imports', 'Import Excel', FileSpreadsheet],
  ['/employees', 'Quản lý nhân viên', Users],
  ['/attendance', 'Bảng công tổng hợp', CalendarCheck2],
  ['/attendance/detail', 'Chi tiết bảng công', ClipboardCheck],
  ['/exceptions', 'Xử lý ngoại lệ', ShieldAlert],
  ['/periods', 'Phê duyệt & chốt công', ClipboardList],
  ['/publications', 'Phát hành bảng công', Send],
  ['/me/timesheets', 'Bảng công cá nhân', Clock3],
  ['/shifts', 'Cấu hình ca làm việc', Settings2],
  ['/audit', 'Lịch sử điều chỉnh', History],
] as const;

const roleLabels: Record<string, string> = {
  ADMIN: 'Quản trị hệ thống',
  HR: 'HR · Nhân sự',
  MANAGER: 'Quản lý',
  EMPLOYEE: 'Nhân viên',
};

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const displayRole = user?.roles.map((role) => roleLabels[role] ?? role).join(' · ') ?? '';
  const initial = user?.username.trim().charAt(0).toLocaleUpperCase('vi-VN') || 'U';

  const sidebar = (mobile = false) => (
    <div className="flex h-full flex-col bg-[linear-gradient(180deg,#14213d_0%,#102a4b_100%)] text-white">
      <div
        className={cn(
          'flex h-[92px] items-center border-b border-white/10 px-5',
          collapsed && !mobile ? 'justify-center' : 'justify-between',
        )}
      >
        <div className={cn('flex items-center gap-3', collapsed && !mobile && 'justify-center')}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/40 text-sm font-black tracking-tighter">
            INH
          </div>
          {(!collapsed || mobile) && (
            <div>
              <div className="text-lg font-bold tracking-wide">IN NHẬT HÀN</div>
              <div className="text-xs text-blue-100/80">Quản lý chấm công</div>
            </div>
          )}
        </div>
        {mobile && (
          <button onClick={() => setMobileOpen(false)} aria-label="Đóng menu">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2.5 py-3">
        {items.map(([to, label, Icon]) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/attendance'}
            title={collapsed && !mobile ? label : undefined}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex min-h-11 items-center rounded-lg px-3 text-sm text-slate-200 transition hover:bg-white/10 hover:text-white',
                collapsed && !mobile ? 'justify-center' : 'gap-3',
                isActive && 'bg-primary text-white shadow-[0_8px_18px_rgba(23,105,210,0.28)]',
              )
            }
          >
            <Icon className="h-[19px] w-[19px] shrink-0" />
            {(!collapsed || mobile) && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 p-2.5">
        <button
          type="button"
          title={collapsed && !mobile ? 'Cài đặt hệ thống' : undefined}
          className={cn(
            'flex min-h-11 w-full items-center rounded-lg px-3 text-sm text-slate-200 hover:bg-white/10 hover:text-white',
            collapsed && !mobile ? 'justify-center' : 'gap-3',
          )}
        >
          <Settings className="h-[19px] w-[19px] shrink-0" />
          {(!collapsed || mobile) && 'Cài đặt hệ thống'}
        </button>
        <Button
          variant="ghost"
          className={cn(
            'mt-1 w-full text-slate-200 hover:bg-white/10 hover:text-white',
            collapsed && !mobile ? 'justify-center px-0' : 'justify-start',
          )}
          onClick={() => void logout()}
          title={collapsed && !mobile ? 'Đăng xuất' : undefined}
        >
          <LogOut className="h-[19px] w-[19px]" />
          {(!collapsed || mobile) && 'Đăng xuất'}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden transition-[width] duration-200 lg:block',
          collapsed ? 'w-[76px]' : 'w-[262px]',
        )}
      >
        {sidebar()}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            className="absolute inset-0 bg-slate-950/45"
            onClick={() => setMobileOpen(false)}
            aria-label="Đóng menu"
          />
          <aside className="relative h-full w-[280px]">{sidebar(true)}</aside>
        </div>
      )}

      <div
        className={cn(
          'transition-[padding] duration-200',
          collapsed ? 'lg:pl-[76px]' : 'lg:pl-[262px]',
        )}
      >
        <header className="sticky top-0 z-20 flex h-[58px] items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <button
            className="rounded-md p-2 text-navy hover:bg-slate-100"
            onClick={() => {
              if (window.innerWidth < 1024) setMobileOpen(true);
              else setCollapsed((current) => !current);
            }}
            aria-label={collapsed ? 'Mở rộng sidebar' : 'Mở menu'}
          >
            <span className="lg:hidden">
              <Menu className="h-5 w-5" />
            </span>
            <span className="hidden lg:block">
              {collapsed ? (
                <PanelLeftOpen className="h-5 w-5" />
              ) : (
                <PanelLeftClose className="h-5 w-5" />
              )}
            </span>
          </button>

          <div className="flex items-center gap-3 sm:gap-4">
            <button
              className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100"
              aria-label="Thông báo"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            </button>
            <div className="h-7 w-px bg-slate-200" />
            <button
              className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 text-left hover:bg-slate-50"
              aria-label="Menu tài khoản"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-bold text-white">
                {initial}
              </span>
              <span className="hidden sm:block">
                <span className="block max-w-40 truncate text-xs font-bold text-navy">
                  {user?.username}
                </span>
                <span className="block max-w-40 truncate text-[10px] text-slate-500">
                  {displayRole}
                </span>
              </span>
              <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
            </button>
          </div>
        </header>
        <main className="p-4 sm:p-5 lg:p-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
