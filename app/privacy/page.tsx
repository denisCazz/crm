export const metadata = {
  title: 'Privacy Policy · Bitora CRM',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-12 space-y-8">
        <header className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Privacy Policy</h1>
          <p className="text-sm text-muted">Template da personalizzare e far validare (non consulenza legale).</p>
        </header>

        <div className="card p-5 sm:p-6 space-y-6">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">1) Titolare del trattamento</h2>
            <ul className="text-sm text-muted list-disc pl-5 space-y-1">
              <li>Ragione sociale / Nome e cognome: <span className="text-foreground">[INSERIRE]</span></li>
              <li>Sede: <span className="text-foreground">[INSERIRE]</span></li>
              <li>Email di contatto: <span className="text-foreground">[INSERIRE]</span></li>
              <li>PEC (se applicabile): <span className="text-foreground">[INSERIRE]</span></li>
              <li>P.IVA / CF: <span className="text-foreground">[INSERIRE]</span></li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">2) Tipologie di dati</h2>
            <p className="text-sm text-muted">Possiamo trattare (a seconda dell’uso): dati anagrafici e di contatto, note/tag dei contatti inseriti nel CRM, dati di autenticazione e dati tecnici.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">3) Finalità e basi giuridiche</h2>
            <div className="text-sm text-muted space-y-2">
              <p>Trattiamo i dati per: erogazione del servizio (art. 6.1.b), sicurezza (art. 6.1.f), obblighi legali (art. 6.1.c), invii email secondo la base giuridica applicabile (consenso/contratto/legittimo interesse).</p>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">4) Conservazione</h2>
            <p className="text-sm text-muted">Conserviamo i dati per il tempo necessario alle finalità e agli obblighi di legge. Completa le tempistiche: <span className="text-foreground">[INSERIRE]</span>.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">5) Diritti</h2>
            <p className="text-sm text-muted">Puoi esercitare i diritti GDPR (artt. 15–22). Contatto: <span className="text-foreground">[INSERIRE EMAIL]</span>.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">6) Cookie</h2>
            <p className="text-sm text-muted">Vedi anche la Cookie Policy nella pagina dedicata.</p>
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
