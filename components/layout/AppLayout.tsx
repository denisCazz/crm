'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { User } from '../../lib/auth';
import { ThemeToggle } from '../ThemeProvider';
import { getCachedBrand } from '../../lib/brandCache';

interface AppLayoutProps {
  children: React.ReactNode;
  user: User;
  brandName?: string;
  logoUrl?: string | null;
  onLogout: () => Promise<void>;
}

const navItems = [
  { href: '/', label: 'Clienti', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/documenti', label: 'Documenti', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { href: '/scadenze', label: 'Scadenze', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { href: '/email', label: 'Email', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { href: '/impostazioni', label: 'Impostazioni', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
];

export function AppLayout({ children, user, brandName = 'Bitora CRM', logoUrl, onLogout }: AppLayoutProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const [resolvedBrandName, setResolvedBrandName] = React.useState(brandName);
  const [resolvedLogoUrl, setResolvedLogoUrl] = React.useState<string | null | undefined>(logoUrl);
  const userInitial = (user.email?.trim()?.charAt(0) ?? 'U').toUpperCase();

  React.useEffect(() => {
    // Cache-first: show brand/logo immediately without network calls.
    if (!user?.id) return;

    const cached = getCachedBrand(user.id);
    if (!cached) return;

    if (!brandName || brandName === 'Bitora CRM') {
      if (cached.brand_name) setResolvedBrandName(cached.brand_name);
    } else {
      setResolvedBrandName(brandName);
    }

    if (!logoUrl) {
      if (cached.logo_url) setResolvedLogoUrl(cached.logo_url);
    } else {
      setResolvedLogoUrl(logoUrl);
    }
  }, [user?.id, brandName, logoUrl]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-surface/80 border-b border-border shadow-theme-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              {resolvedLogoUrl ? (
                <img
                  src={resolvedLogoUrl}
                  alt={resolvedBrandName}
                  className="h-9 w-9 rounded-xl object-contain bg-surface border border-border shadow-theme-sm"
                  decoding="async"
                  loading="eager"
                  fetchPriority="high"
                />
              ) : (
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow">
                  <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              )}
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-foreground">{resolvedBrandName}</h1>
                <p className="text-[10px] text-muted -mt-0.5">Dashboard CRM</p>
              </div>
            </Link>

            {/* Desktop Nav — icons only on md, icons+labels on lg */}
            <div className="hidden md:flex items-center gap-0.5">
              {navItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
                        : 'text-muted hover:text-foreground hover:bg-surface-hover'
                    }`}
                  >
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                    </svg>
                    <span className="hidden lg:inline">{item.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2">
              <ThemeToggle />
              
              {/* User section (desktop) */}
              <div className="hidden md:flex items-center gap-2">
                <div
                  className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 border border-border flex items-center justify-center text-sm font-bold text-foreground flex-shrink-0"
                  title={user.email ?? ''}
                >
                  {userInitial}
                </div>
                <p className="hidden xl:block text-sm font-medium text-foreground truncate max-w-[140px]">{user.email}</p>
                <button
                  onClick={onLogout}
                  className="btn btn-ghost btn-icon text-muted hover:text-danger hover:bg-danger/10"
                  title="Esci"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>

              {/* Mobile: user avatar + logout toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden flex items-center justify-center h-8 w-8 rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 border border-border text-sm font-bold text-foreground hover:opacity-80 transition-opacity"
                title="Menu utente"
              >
                {userInitial}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile user dropdown (logout only) */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-surface/95 backdrop-blur-xl">
            <div className="px-4 py-3 space-y-2">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 border border-border flex items-center justify-center text-sm font-bold text-foreground flex-shrink-0">
                  {userInitial}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted truncate">{user.email}</p>
                </div>
              </div>
              <button
                onClick={() => { onLogout(); setMobileMenuOpen(false); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-danger/10 text-danger hover:bg-danger/20 transition-colors font-semibold text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Esci
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Main content — extra bottom padding on mobile for tab bar */}
      <main className="flex-1 pb-16 md:pb-0">
        {children}
      </main>

      {/* Footer — hidden on mobile, shown on md+ */}
      <footer className="hidden md:block py-6 text-center text-xs text-muted border-t border-border mt-auto">
        <p className="space-x-2">
          <span>
            Powered by <span className="font-medium text-foreground">Cazzulo Denis</span>
          </span>
          <span aria-hidden>·</span>
          <a
            href="https://bitora.it"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Bitora.it
          </a>
          <span aria-hidden>·</span>
          <Link href="/privacy" className="text-primary hover:underline">
            Privacy
          </Link>
          <span aria-hidden>·</span>
          <Link href="/cookie" className="text-primary hover:underline">
            Cookie
          </Link>
        </p>
      </footer>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur-xl border-t border-border">
        <div className="flex items-stretch h-14">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  isActive ? 'text-primary' : 'text-muted'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive ? 2.5 : 1.75} d={item.icon} />
                </svg>
                <span className="text-[9px] font-medium leading-none">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
