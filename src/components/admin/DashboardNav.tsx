'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  LayoutGrid,
  FolderOpen,
  Users,
  BarChart3,
  LogOut,
  Menu,
  Bug,
  Tags,
} from 'lucide-react';
import { BugHunterDialog } from '@/components/auth/BugHunterDialog';

interface DashboardNavProps {
  userRole: 'admin' | 'user' | 'editor';
  userEmail: string;
}

export function DashboardNav({ userRole, userEmail }: DashboardNavProps) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [bugHunterOpen, setBugHunterOpen] = useState(false);

  const isAdmin = userRole === 'admin';
  const isEditor = userRole === 'editor';

  const navItems = isAdmin
    ? [
        { href: '/admin/projects', label: 'Projekty', icon: FolderOpen },
        { href: '/admin/groups', label: 'Grupy', icon: Tags },
        { href: '/gallery', label: 'Galeria', icon: LayoutGrid },
        { href: '/admin/users', label: 'Użytkownicy', icon: Users },
        { href: '/admin/stats', label: 'Statystyki', icon: BarChart3 },
      ]
    : isEditor
    ? [{ href: '/gallery', label: 'Galeria', icon: LayoutGrid }]
    : [{ href: '/gallery', label: 'Galeria', icon: LayoutGrid }];

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  const initials = userEmail.slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-50 border-b bg-white dark:bg-zinc-900">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="font-semibold text-lg">
              <span className="text-primary text-[0.7em]">CONCEPTFAB</span>
              <span className="text-muted-foreground text-[0.91em] ml-2">
                Pano{' '}
                <span className="text-[10px]">
                  v: {process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0'}
                </span>
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={isActive ? 'secondary' : 'ghost'}
                      size="sm"
                      className="gap-2"
                    >
                      <Icon className="size-4" />
                      {item.label}
                    </Button>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {!isAdmin && !isEditor && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  onClick={() => setBugHunterOpen(true)}
                  aria-label="Bug hunter – zgłoś błąd"
                >
                  <Bug className="size-5" />
                </Button>
                <BugHunterDialog
                  open={bugHunterOpen}
                  onOpenChange={setBugHunterOpen}
                />
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-11 md:hidden" aria-label="Menu nawigacji">
                  <Menu className="size-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link
                        href={item.href}
                        className="flex items-center gap-2"
                      >
                        <Icon className="size-4" />
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  <Avatar className="size-8">
                    <AvatarFallback className="text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden md:inline text-sm">{userEmail}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem disabled className="text-muted-foreground">
                  {isAdmin
                    ? 'Administrator'
                    : isEditor
                    ? 'Edytor'
                    : 'Użytkownik'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-red-600"
                >
                  <LogOut className="size-4 mr-2" />
                  Wyloguj
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
