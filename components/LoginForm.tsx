"use client";
import React, { useState } from "react";
import { signIn, signUp, requestPasswordReset } from "../lib/authClient";
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

  async function handleForgotPassword() {
    const email = form.email.trim();
    if (!email) {
      push("error", "Inserisci prima la tua email.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await requestPasswordReset(email);
      if (result.error) {
        push("error", result.error);
      } else {
        push("success", "Email di recupero inviata. Controlla la posta.");
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      push("error", errorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    
    try {
      if (authMode === "signin") {
        const result = await signIn(form.email, form.password);
        if ('error' in result) {
          push("error", result.error);
        } else {
          push("success", "Accesso effettuato con successo!");
          // Ricarica la pagina per aggiornare lo stato
          window.location.href = '/';
        }
      } else {
        const result = await signUp(form.email, form.password);
        if ('error' in result) {
          push("error", result.error);
        } else {
          // Crea automaticamente una licenza trial per il nuovo utente
          try {
            await fetch('/api/license', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_id: result.user.id,
                plan: 'trial',
                status: 'trial',
              }),
            });
          } catch (licenseErr) {
            console.error('Errore creazione licenza automatica:', licenseErr);
            // Non bloccare la registrazione se la licenza fallisce
          }
          
          push("success", "Registrazione completata! Ora puoi fare login.");
          // Switch automatico a signin
          setAuthMode("signin");
        }
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
              decoding="async"
              loading="eager"
              fetchPriority="high"
            />
          ) : (
            <img
              src="/CRM.png"
              alt={brandName}
              className="h-24 w-24 mx-auto mb-4 rounded-2xl object-contain bg-surface shadow-theme-md"
              decoding="async"
              loading="eager"
              fetchPriority="high"
            />
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

              {authMode === "signin" && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={submitting}
                    className="text-xs font-medium text-primary hover:underline disabled:opacity-60"
                  >
                    Password dimenticata?
                  </button>
                </div>
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
            {' · '}
            <a href="/privacy" className="text-primary hover:underline">Privacy</a>
            {' · '}
            <a href="/cookie" className="text-primary hover:underline">Cookie</a>
          </p>
        </div>
      </div>
    </div>
  );
}