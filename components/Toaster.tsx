"use client";
import React, { createContext, useContext, useId, useMemo, useState } from "react";

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

  const push = (kind: ToastKind, message: string, ms = 3000) => {
    const id = `${idPrefix}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((t) => [...t, { id, kind, message }]);
    // auto-dismiss
    setTimeout(() => remove(id), ms);
  };

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
  return (
    <div className="fixed inset-x-0 top-3 z-[9999] flex justify-center px-3 pointer-events-none">
      <div className="w-full max-w-md space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={[
              "pointer-events-auto rounded-xl border px-4 py-3 shadow-lg backdrop-blur",
              "bg-neutral-900/80 border-neutral-800 text-neutral-100",
              t.kind === "success" ? "ring-1 ring-emerald-500/20" : "",
              t.kind === "error" ? "ring-1 ring-red-500/20" : "",
              t.kind === "info" ? "ring-1 ring-sky-500/20" : "",
            ].join(" ")}
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-sm">
                {t.kind === "success" ? "✅" : t.kind === "error" ? "⚠️" : "ℹ️"}
              </span>
              <p className="text-sm leading-snug">{t.message}</p>
              <button
                onClick={() => onClose(t.id)}
                className="ml-auto text-xs text-neutral-400 hover:text-neutral-200"
                aria-label="Chiudi notifica"
              >
                Chiudi
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
