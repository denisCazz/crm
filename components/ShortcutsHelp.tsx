import React from 'react';

export function ShortcutsHelp({ className = "" }: { className?: string }) {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘' : 'Ctrl';

  return (
    <div className={`text-xs text-neutral-400 space-y-1 ${className}`}>
      <div className="font-medium mb-2">Scorciatoie da tastiera:</div>
      <div className="flex justify-between">
        <span>{modKey} + K</span>
        <span>Cerca</span>
      </div>
      <div className="flex justify-between">
        <span>{modKey} + N</span>
        <span>Nuovo cliente</span>
      </div>
      <div className="flex justify-between">
        <span>ESC</span>
        <span>Chiudi</span>
      </div>
      <div className="flex justify-between">
        <span>{modKey} + S</span>
        <span>Salva</span>
      </div>
    </div>
  );
}