"use client";
import React, { createContext, useContext, useId, useMemo, useState, useCallback } from "react";

type ToastKind = "success" | "error" | "info";
type Toast = { id: string; kind: ToastKind; message: string };

type ToastCtx = {
  push: (kind: ToastKind, message: string, ms?: number) => void;
};

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idPrefix = useId();

  const remove = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  const push = useCallback((kind: ToastKind, message: string, ms = 4000) => {
    const id = `${idPrefix}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => remove(id), ms);
  }, [idPrefix]);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <ToasterUI toasts={toasts} onClose={remove} />
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

function ToasterUI({ toasts, onClose }: { toasts: Toast[]; onClose: (id: string) => void }) {
  const icons = {
    success: (
      <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    ),
    error: (
      <div className="w-8 h-8 rounded-full bg-danger/20 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    ),
    info: (
      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    ),
  };

  const ringColors = {
    success: 'ring-success/30',
    error: 'ring-danger/30',
    info: 'ring-primary/30',
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 px-4 pointer-events-none w-full max-w-md">
      {toasts.map((t, index) => (
        <div
          key={t.id}
          role="status"
          className={`
            pointer-events-auto w-full
            glass-strong rounded-xl px-4 py-3
            ring-1 ${ringColors[t.kind]}
            animate-slide-down shadow-theme-lg
          `}
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <div className="flex items-center gap-3">
            {icons[t.kind]}
            <p className="text-sm font-medium text-foreground flex-1">{t.message}</p>
            <button
              onClick={() => onClose(t.id)}
              className="btn btn-ghost btn-icon p-1.5 text-muted hover:text-foreground"
              aria-label="Chiudi notifica"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
