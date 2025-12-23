export const metadata = {
  title: 'Cookie Policy · Bitora CRM',
};

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-12 space-y-8">
        <header className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Cookie Policy</h1>
          <p className="text-sm text-muted">Template da personalizzare in base ai cookie/strumenti effettivi.</p>
        </header>

        <div className="card p-5 sm:p-6 space-y-6">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">1) Cookie tecnici/necessari</h2>
            <p className="text-sm text-muted">Utilizzati per sessione e preferenze (es. tema). Alcune preferenze possono essere salvate in localStorage.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">2) Statistica / analytics</h2>
            <p className="text-sm text-muted">Se usi strumenti di analytics, elencali qui: <span className="text-foreground">[INSERIRE]</span>.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">3) Profilazione / marketing</h2>
            <p className="text-sm text-muted">Se presenti cookie di profilazione/marketing, elencali e gestisci consenso: <span className="text-foreground">[INSERIRE]</span>.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">4) Gestione preferenze</h2>
            <p className="text-sm text-muted">Puoi gestire i cookie dalle impostazioni del browser e, se necessario, tramite banner/consenso.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Aggiornamenti</h2>
            <p className="text-sm text-muted">Ultimo aggiornamento: <span className="text-foreground">[INSERIRE DATA]</span></p>
          </section>
        </div>
      </div>
    </div>
  );
}
