'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  FolderOpen,
  GalleryHorizontalEnd,
  LayoutDashboard,
  LogOut,
  Tags,
  Users,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types/user';
import { cn } from '@/lib/utils';

interface ConsoleShellProps {
  children: ReactNode;
  userRole: UserRole;
  userEmail: string;
}

const navItems = [
  {
    href: '/command-center',
    label: 'Command Center',
    icon: LayoutDashboard,
    roles: ['admin', 'editor'],
  },
  {
    href: '/admin/projects',
    label: 'Projects',
    icon: FolderOpen,
    roles: ['admin', 'editor'],
  },
  {
    href: '/gallery',
    label: 'Gallery',
    icon: GalleryHorizontalEnd,
    roles: ['admin', 'editor', 'user'],
  },
  {
    href: '/admin/groups',
    label: 'Groups',
    icon: Tags,
    roles: ['admin'],
  },
  {
    href: '/admin/users',
    label: 'Users',
    icon: Users,
    roles: ['admin'],
  },
  {
    href: '/admin/stats',
    label: 'Stats',
    icon: BarChart3,
    roles: ['admin'],
  },
] satisfies Array<{
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: UserRole[];
}>;

const roleLabels: Record<UserRole, string> = {
  admin: 'Administrator',
  editor: 'Edytor',
  user: 'Użytkownik',
};

function isActivePath(pathname: string, href: string) {
  if (href === '/command-center') {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ConsoleShell({
  children,
  userRole,
  userEmail,
}: ConsoleShellProps) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const visibleNavItems = navItems.filter((item) =>
    item.roles.includes(userRole)
  );
  const activeItem = visibleNavItems.find((item) =>
    isActivePath(pathname, item.href)
  );
  const initials = userEmail.slice(0, 2).toUpperCase();
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0';
  const isFullBleedRoute =
    pathname === '/command-center' ||
    pathname === '/gallery' ||
    pathname === '/admin/projects' ||
    pathname === '/admin/groups' ||
    pathname === '/admin/users' ||
    pathname === '/admin/stats';

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  const nav = (
    <nav aria-label="Główna nawigacja" className="space-y-1">
      {visibleNavItems.map((item) => {
        const Icon = item.icon;
        const isActive = isActivePath(pathname, item.href);

        return (
          <Link
            key={`${item.href}-${item.label}`}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex h-9 items-center gap-2 rounded border border-transparent px-2 text-sm text-zinc-400 transition-colors hover:border-white/10 hover:bg-white/[0.03] hover:text-zinc-100',
              isActive &&
                'border-white/10 bg-white/[0.06] text-zinc-100'
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-zinc-100 focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-zinc-950"
      >
        Przejdź do treści
      </a>

      <div className="lg:grid lg:min-h-screen lg:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="hidden border-r border-white/10 bg-[#050505] lg:flex lg:w-[232px] lg:flex-col">
          <div className="flex h-14 items-center border-b border-white/10 px-4">
            <Link href="/command-center" className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-normal text-zinc-100">
                CONCEPTFAB Pano
              </div>
              <div className="text-[11px] leading-4 text-zinc-500">
                v: {version}
              </div>
            </Link>
          </div>

          <div className="min-h-0 flex-1 px-3 py-3">{nav}</div>

          <div className="border-t border-white/10 p-3">
            <div className="mb-2 flex items-center gap-2 rounded border border-white/10 bg-[#080809] px-2 py-2">
              <div className="flex size-8 shrink-0 items-center justify-center rounded border border-white/10 bg-white/[0.04] text-xs font-medium text-zinc-100">
                {initials}
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs text-zinc-200">
                  {userEmail}
                </div>
                <div className="text-[11px] text-zinc-500">
                  {roleLabels[userRole]}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-9 w-full items-center gap-2 rounded border border-white/10 px-2 text-sm text-zinc-400 transition-colors hover:bg-white/[0.03] hover:text-zinc-100"
            >
              <LogOut className="size-4" aria-hidden="true" />
              Wyloguj
            </button>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-40 border-b border-white/10 bg-[#050505]">
            <div className="flex h-14 items-center gap-3 px-3 sm:px-4">
              <Link href="/command-center" className="min-w-0 lg:hidden">
                <div className="truncate text-sm font-semibold text-zinc-100">
                  CONCEPTFAB Pano
                </div>
                <div className="text-[11px] leading-4 text-zinc-500">
                  v: {version}
                </div>
              </Link>

              <div className="hidden min-w-0 flex-1 items-center gap-2 text-sm text-zinc-500 md:flex">
                <span>Workspace</span>
                <span>/</span>
                <span>{activeItem?.label ?? 'Console'}</span>
              </div>

              <div className="ml-auto flex items-center gap-2 lg:ml-0">
                <div className="hidden min-w-0 text-right sm:block">
                  <div className="max-w-44 truncate text-xs text-zinc-300">
                    {userEmail}
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    {roleLabels[userRole]}
                  </div>
                </div>
                <div className="flex size-8 shrink-0 items-center justify-center rounded border border-white/10 bg-[#080809] text-xs font-medium">
                  {initials}
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex size-8 items-center justify-center rounded border border-white/10 text-zinc-400 transition-colors hover:bg-white/[0.03] hover:text-zinc-100"
                  aria-label="Wyloguj"
                >
                  <LogOut className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="border-t border-white/10 px-3 py-2 lg:hidden">
              <nav
                aria-label="Główna nawigacja"
                className="flex gap-1 overflow-x-auto"
              >
                {visibleNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = isActivePath(pathname, item.href);

                  return (
                    <Link
                      key={`${item.href}-${item.label}-mobile`}
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'flex h-8 shrink-0 items-center gap-2 rounded border border-white/10 px-2 text-xs text-zinc-400',
                        isActive && 'bg-white/[0.06] text-zinc-100'
                      )}
                    >
                      <Icon className="size-3.5" aria-hidden="true" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </header>

          <main id="main-content" className="min-w-0">
            {isFullBleedRoute ? (
              children
            ) : (
              <div className="mx-auto w-full max-w-[1440px] px-3 py-4 sm:px-4 lg:px-6">
                {children}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
