'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { User } from '../lib/auth';
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
  { href: '/', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/email', label: 'Email', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { href: '/profilo', label: 'Profilo', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  { href: '/impostazioni', label: 'Impostazioni', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
];

export function AppLayout({ children, user, brandName = 'Bitora CRM', logoUrl, onLogout }: AppLayoutProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const [resolvedBrandName, setResolvedBrandName] = React.useState(brandName);
  const [resolvedLogoUrl, setResolvedLogoUrl] = React.useState<string | null | undefined>(logoUrl);

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
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-surface/80 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              {resolvedLogoUrl ? (
                <img
                  src={resolvedLogoUrl}
                  alt={resolvedBrandName}
                  className="h-9 w-9 rounded-xl object-contain bg-surface"
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

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted hover:text-foreground hover:bg-surface-hover'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                    </svg>
                    {item.label}
                  </Link>
                );
              })}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              <ThemeToggle />
              
              {/* User dropdown (desktop) */}
              <div className="hidden md:flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground truncate max-w-[150px]">{user.email}</p>
                </div>
                <button
                  onClick={onLogout}
                  className="p-2 rounded-xl text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                  title="Esci"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-xl hover:bg-surface-hover transition-colors"
              >
                {mobileMenuOpen ? (
                  <svg className="w-6 h-6 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-surface/95 backdrop-blur-xl">
            <div className="px-4 py-4 space-y-2">
              {navItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-surface-hover'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                    </svg>
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}

              <div className="border-t border-border pt-4 mt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
                    <p className="text-xs text-muted">Account connesso</p>
                  </div>
                  <button
                    onClick={() => { onLogout(); setMobileMenuOpen(false); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-danger/10 text-danger hover:bg-danger/20 transition-colors font-medium text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Esci
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Main content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-muted border-t border-border mt-auto">
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
    </div>
  );
}
