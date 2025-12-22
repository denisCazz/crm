'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { User } from '@supabase/supabase-js';
import { ThemeToggle } from './ThemeProvider';

interface NavbarProps {
  user: User;
  brandName?: string;
  logoUrl?: string | null;
  onLogout: () => Promise<void>;
  onNewClient: () => void;
  onNewsletter: () => void;
  onExportCSV: () => void;
  onStatsOpen: () => void;
  clientCount: number;
  newClientCount: number;
  canExport: boolean;
  canShowStats: boolean;
  sendingNewsletter?: boolean;
}

export function Navbar({
  user,
  brandName = 'Bitora CRM',
  logoUrl,
  // isAdmin prop removed - no longer needed since settings visible to all users
  onLogout,
  onNewClient,
  onNewsletter,
  onExportCSV,
  onStatsOpen,
  clientCount,
  newClientCount,
  canExport,
  canShowStats,
  sendingNewsletter,
}: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Chiudi menu desktop quando si clicca fuori
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuOpen &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // Chiudi mobile menu su resize
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false);
      }
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-surface/80 border-b border-border shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt={brandName} className="h-9 w-9 rounded-xl object-contain bg-surface" />
            ) : (
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow">
                <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            )}
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-foreground">{brandName}</h1>
              <p className="text-[10px] text-muted -mt-0.5">Dashboard CRM</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-3">
            {/* Quick Stats */}
            {clientCount > 0 && (
              <div className="flex items-center gap-2 mr-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  {clientCount} clienti
                </span>
                {newClientCount > 0 && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent border border-accent/20">
                    +{newClientCount} nuovi
                  </span>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <button 
              onClick={onNewClient} 
              className="btn btn-primary"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden lg:inline">Nuovo Cliente</span>
              <span className="lg:hidden">Nuovo</span>
            </button>

            <button 
              onClick={onNewsletter} 
              disabled={sendingNewsletter || clientCount === 0}
              className="btn btn-secondary"
            >
              {sendingNewsletter ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Invio...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span>Newsletter</span>
                </>
              )}
            </button>

            <ThemeToggle />

            {/* Menu Dropdown */}
            <div className="relative">
              <button
                ref={menuButtonRef}
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2 rounded-xl hover:bg-surface-hover transition-colors"
                aria-label="Menu"
              >
                <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>

              {menuOpen && (
                <div 
                  ref={menuRef}
                  className="absolute right-0 mt-2 w-56 rounded-2xl bg-surface border border-border shadow-xl py-2 z-50"
                  style={{ animation: 'slideDown 0.15s ease-out' }}
                >
                  <Link
                    href="/email"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover transition-colors"
                  >
                    <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm text-foreground">Invia Email Singola</span>
                  </Link>

                  <Link
                    href="/impostazioni"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover transition-colors"
                  >
                    <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-sm text-foreground">Impostazioni</span>
                  </Link>

                  <button
                    onClick={() => {
                      onStatsOpen();
                      setMenuOpen(false);
                    }}
                    disabled={!canShowStats}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span className="text-sm text-foreground">Statistiche</span>
                  </button>

                  <button
                    onClick={() => {
                      onExportCSV();
                      setMenuOpen(false);
                    }}
                    disabled={!canExport}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span className="text-sm text-foreground">Esporta CSV</span>
                  </button>

                  <div className="my-2 border-t border-border" />

                  <button
                    onClick={() => {
                      onLogout();
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-danger/10 transition-colors text-danger"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span className="text-sm">Esci</span>
                  </button>

                  <div className="my-2 border-t border-border" />

                  <div className="px-4 py-2">
                    <p className="text-xs font-medium text-foreground truncate">{user.email}</p>
                    <p className="text-[10px] text-muted">Account connesso</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl hover:bg-surface-hover transition-colors"
              aria-label="Menu mobile"
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

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div 
          className="md:hidden border-t border-border bg-surface/95 backdrop-blur-xl"
          style={{ animation: 'slideDown 0.2s ease-out' }}
        >
          <div className="px-4 py-4 space-y-4">
            {/* Stats */}
            {clientCount > 0 && (
              <div className="flex items-center gap-2 pb-3 border-b border-border">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  {clientCount} clienti
                </span>
                {newClientCount > 0 && (
                  <span className="inline-flex items-center px-2.5 py-1.5 rounded-full text-xs font-medium bg-accent/10 text-accent border border-accent/20">
                    +{newClientCount} nuovi
                  </span>
                )}
              </div>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => { onNewClient(); setMobileMenuOpen(false); }} 
                className="btn btn-primary py-3"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nuovo Cliente
              </button>

              <button 
                onClick={() => { onNewsletter(); setMobileMenuOpen(false); }} 
                disabled={sendingNewsletter || clientCount === 0}
                className="btn btn-secondary py-3"
              >
                {sendingNewsletter ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                )}
                Newsletter
              </button>
            </div>

            {/* Nav Links */}
            <div className="space-y-1">
              <Link 
                href="/email" 
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-hover transition-colors"
              >
                <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-foreground font-medium">Invia Email Singola</span>
              </Link>

              <Link 
                href="/impostazioni" 
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-hover transition-colors"
              >
                <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-foreground font-medium">Impostazioni</span>
              </Link>

              <button
                onClick={() => { onStatsOpen(); setMobileMenuOpen(false); }}
                disabled={!canShowStats}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-hover transition-colors disabled:opacity-50"
              >
                <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="text-foreground font-medium">Statistiche</span>
              </button>

              <button
                onClick={() => { onExportCSV(); setMobileMenuOpen(false); }}
                disabled={!canExport}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-hover transition-colors disabled:opacity-50"
              >
                <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span className="text-foreground font-medium">Esporta CSV</span>
              </button>
            </div>

            <div className="border-t border-border pt-4" />

            {/* User Info & Logout */}
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
                <p className="text-xs text-muted">Account connesso</p>
              </div>
              <button
                onClick={() => { onLogout(); setMobileMenuOpen(false); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-danger/10 text-danger hover:bg-danger/20 transition-colors font-medium text-sm shrink-0 ml-3"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Esci
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </nav>
  );
}
