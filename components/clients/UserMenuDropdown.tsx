'use client';

import React, { useState } from 'react';
import { User } from '@supabase/supabase-js';

interface UserMenuDropdownProps {
  user: User;
  onLogout: () => Promise<void>;
  onStatsOpen: () => void;
  onExportCSV: () => void;
  canExport: boolean;
  canShowStats: boolean;
}

export function UserMenuDropdown({
  user,
  onLogout,
  onStatsOpen,
  onExportCSV,
  canExport,
  canShowStats,
}: UserMenuDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm font-medium text-neutral-200 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
        </svg>
        Menu
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full right-0 mt-2 w-56 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl z-20">
            <div className="p-2">
              <button
                type="button"
                onClick={() => {
                  onStatsOpen();
                  setIsOpen(false);
                }}
                disabled={!canShowStats}
                className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-800 rounded-md disabled:text-neutral-500 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Statistiche
              </button>

              <button
                type="button"
                onClick={() => {
                  onExportCSV();
                  setIsOpen(false);
                }}
                disabled={!canExport}
                className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-800 rounded-md disabled:text-neutral-500 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Esporta CSV
              </button>

              <div className="border-t border-neutral-700 my-2" />

              <button
                type="button"
                onClick={() => {
                  onLogout();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm text-red-400 hover:bg-red-950/30 rounded-md transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Esci
              </button>
            </div>

            <div className="border-t border-neutral-700 px-3 py-3 bg-neutral-950 rounded-b-lg">
              <p className="text-xs text-neutral-400 truncate">{user.email}</p>
              <p className="text-xs text-neutral-500 mt-1">Utente connesso</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
