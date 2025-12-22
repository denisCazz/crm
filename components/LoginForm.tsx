"use client";
import React, { useState } from "react";
import { useSupabase } from "../lib/supabase";
import { useToast } from "./Toaster";
import { ThemeToggle } from "./ThemeProvider";

interface LoginFormProps {
  brandName?: string;
  logoUrl?: string | null;
}

export default function LoginForm({ brandName = "Bitora CRM", logoUrl }: LoginFormProps) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { push } = useToast();
  const supabase = useSupabase();

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    
    try {
      if (authMode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });
        if (error) throw error;
        push("success", "Accesso effettuato con successo!");
      } else {
        const { error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
        });
        if (error) throw error;
        push("info", "Registrazione riuscita! Controlla l'email per confermare l'account.");
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      push("error", errorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background gradient-mesh flex items-center justify-center p-4 relative overflow-hidden">
      {/* Theme toggle in corner */}
      <div className="absolute top-4 right-4 z-30">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md relative z-20">
        {/* Header */}
        <div className="text-center mb-8">
          {logoUrl ? (
            <img 
              src={logoUrl} 
              alt={brandName} 
              className="h-16 w-16 mx-auto mb-4 rounded-2xl object-contain bg-surface shadow-theme-md"
            />
          ) : (
            <div className="h-16 w-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center shadow-theme-md">
              <svg className="h-8 w-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            {brandName}
          </h1>
          <p className="text-muted text-sm">
            Gestisci i tuoi clienti in modo semplice ed efficace
          </p>
        </div>

        {/* Login Form */}
        <div className="card-elevated p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-center text-foreground mb-2">
              {authMode === "signin" ? "Bentornato" : "Crea il tuo account"}
            </h2>
            <p className="text-muted text-sm text-center">
              {authMode === "signin" 
                ? "Accedi per continuare" 
                : "Inizia subito a gestire i tuoi clienti"
              }
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Indirizzo Email
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="input-field"
                placeholder="mario.rossi@example.com"
                autoComplete="email"
              />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  required
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="input-field pr-20"
                  placeholder={authMode === "signin" ? "La tua password" : "Crea una password sicura"}
                  autoComplete={authMode === "signin" ? "current-password" : "new-password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground 
                           transition-colors duration-200 text-xs font-medium"
                >
                  {showPwd ? "Nascondi" : "Mostra"}
                </button>
              </div>
              {authMode === "signup" && (
                <p className="text-xs text-muted mt-1">
                  Usa almeno 8 caratteri con lettere e numeri
                </p>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary w-full py-3"
              >
                {submitting ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Attendere...
                  </div>
                ) : (
                  authMode === "signin" ? "Accedi" : "Crea Account"
                )}
              </button>
            </div>

            {/* Toggle Mode */}
            <div className="pt-4 border-t border-border">
              <p className="text-center text-sm text-muted mb-3">
                {authMode === "signin" 
                  ? "Non hai ancora un account?" 
                  : "Hai già un account?"
                }
              </p>
              <button
                type="button"
                onClick={() => setAuthMode((m) => (m === "signin" ? "signup" : "signin"))}
                className="btn btn-secondary w-full"
              >
                {authMode === "signin" ? "Crea un nuovo account" : "Accedi al tuo account"}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-xs text-muted">
            Powered by <span className="font-semibold text-foreground">Cazzulo Denis</span> · {' '}
            <a href="https://bitora.it" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Bitora.it
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}