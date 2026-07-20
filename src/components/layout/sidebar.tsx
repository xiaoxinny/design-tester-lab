'use client';

import { cn } from '@/lib/cn';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { Menu, X } from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { LogoutButton } from '@/components/layout/logout-button';

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/generate', label: 'Generate' },
  { href: '/runs', label: 'Runs' },
  { href: '/compare', label: 'Compare' },
  { href: '/credentials', label: 'Credentials' },
  { href: '/settings', label: 'Settings' },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-2">
      {navItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'block rounded-md px-3 py-2 text-sm transition-colors',
              isActive
                ? 'bg-surface-raised text-text-primary font-medium'
                : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  useGSAP(
    () => {
      if (mobileOpen && drawerRef.current) {
        gsap.from(drawerRef.current, { x: -264, duration: 0.25, ease: 'power2.out' });
      }
    },
    { dependencies: [mobileOpen] }
  );

  return (
    <>
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center h-14 px-4 border-b border-border bg-surface">
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setMobileOpen(true)}
          className="rounded-md p-2 text-text-secondary hover:bg-surface-raised hover:text-text-primary"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link
          href="/dashboard"
          className="flex-1 text-center font-mono text-sm font-semibold text-text-primary"
        >
          design-tester-lab
        </Link>
        <ThemeToggle />
      </header>

      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-50 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={drawerRef}
            className="md:hidden fixed left-0 top-0 z-50 h-screen w-64 bg-surface border-r border-border flex flex-col"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-border-subtle p-4">
              <Link
                href="/dashboard"
                className="font-mono text-sm font-semibold text-text-primary"
              >
                design-tester-lab
              </Link>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-1 text-text-secondary hover:bg-surface-raised hover:text-text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks onNavigate={() => setMobileOpen(false)} />
            <div className="mt-auto flex items-center justify-between border-t border-border-subtle p-4">
              <LogoutButton />
            </div>
          </div>
        </>
      )}

      <aside className="hidden md:flex fixed left-0 top-0 z-30 h-screen w-56 flex-col border-r border-border bg-surface">
        <div className="border-b border-border-subtle p-4">
          <Link href="/dashboard" className="font-mono text-sm font-semibold text-text-primary">
            design-tester-lab
          </Link>
        </div>
        <NavLinks />
        <div className="mt-auto flex items-center justify-between border-t border-border-subtle p-4">
          <ThemeToggle />
          <LogoutButton />
        </div>
      </aside>
    </>
  );
}
