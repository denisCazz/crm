"use client";
import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useToast } from "./Toaster";
import { AnimatedBackground } from "./AnimatedBackground";

// Supabase client (browser)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginForm() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { push } = useToast();

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
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-4 relative overflow-hidden">
      <AnimatedBackground />
      <div className="w-full max-w-md relative z-20">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-neutral-300 bg-clip-text text-transparent mb-2">
            Bitora CRM
          </h1>
          <p className="text-neutral-400 text-sm">
            Gestisci i tuoi clienti in modo semplice ed efficace
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-center mb-2">
              {authMode === "signin" ? "Bentornato" : "Crea il tuo account"}
            </h2>
            <p className="text-neutral-400 text-sm text-center">
              {authMode === "signin" 
                ? "Accedi per continuare" 
                : "Inizia subito a gestire i tuoi clienti"
              }
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-neutral-300">
                Indirizzo Email
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-sm 
                         outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         transition-all duration-200 placeholder-neutral-500"
                placeholder="mario.rossi@example.com"
                autoComplete="email"
              />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-neutral-300">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  required
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 pr-12 text-sm 
                           outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           transition-all duration-200 placeholder-neutral-500"
                  placeholder={authMode === "signin" ? "La tua password" : "Crea una password sicura"}
                  autoComplete={authMode === "signin" ? "current-password" : "new-password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200 
                           transition-colors duration-200 text-sm font-medium"
                >
                  {showPwd ? "Nascondi" : "Mostra"}
                </button>
              </div>
              {authMode === "signup" && (
                <p className="text-xs text-neutral-400 mt-1">
                  Usa almeno 8 caratteri con lettere e numeri
                </p>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 
                         text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 
                         disabled:opacity-60 disabled:cursor-not-allowed transform hover:scale-[1.02] 
                         active:scale-[0.98] shadow-lg hover:shadow-xl"
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
            <div className="pt-4 border-t border-neutral-800">
              <p className="text-center text-sm text-neutral-400 mb-3">
                {authMode === "signin" 
                  ? "Non hai ancora un account?" 
                  : "Hai già un account?"
                }
              </p>
              <button
                type="button"
                onClick={() => setAuthMode((m) => (m === "signin" ? "signup" : "signin"))}
                className="w-full bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium 
                         py-2.5 px-4 rounded-xl transition-all duration-200 text-sm
                         border border-neutral-700 hover:border-neutral-600"
              >
                {authMode === "signin" ? "Crea un nuovo account" : "Accedi al tuo account"}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-xs text-neutral-500">
            Powered by <span className="font-semibold">Bitora</span> · Un prodotto di <a href="https://bitora.it" target="_blank" rel="noopener noreferrer" className="underline hover:text-neutral-400">Denis Cazzulo</a> (bitora.it)
          </p>
        </div>
      </div>
    </div>
  );
}