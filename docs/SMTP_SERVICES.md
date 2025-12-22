# Servizi SMTP consigliati per Bitora CRM

Questo documento elenca i servizi SMTP che puoi usare per inviare email marketing dal tuo CRM.

---

## 🏆 Raccomandato: **Resend**

**Perché sceglierlo:**
- Semplicissimo da configurare (5 minuti)
- 3.000 email/mese **gratis** (piano Free)
- API moderna, deliverability eccellente
- Supporta domini personalizzati
- Dashboard chiara con analytics

**Configurazione in Bitora CRM:**
```
SMTP Host: smtp.resend.com
SMTP Port: 465
SMTP Secure: true (SSL)
SMTP User: resend
SMTP Password: re_xxxxxxxx (la tua API key)
```

**Link:** https://resend.com

---

## 🥈 Alternative valide

### **Brevo (ex Sendinblue)**
- 300 email/giorno gratis
- Ottimo per l'Italia (server EU)
- Supporto in italiano

**Configurazione:**
```
SMTP Host: smtp-relay.brevo.com
SMTP Port: 587
SMTP Secure: false (usa STARTTLS)
SMTP User: la tua email Brevo
SMTP Password: la tua SMTP key (da Impostazioni → SMTP & API)
```

**Link:** https://www.brevo.com

---

### **Mailgun**
- 1.000 email/mese gratis (primi 3 mesi, poi pay-as-you-go)
- Ottima deliverability
- API potente

**Configurazione:**
```
SMTP Host: smtp.mailgun.org
SMTP Port: 587
SMTP Secure: false (usa STARTTLS)
SMTP User: postmaster@tuodominio.mailgun.org
SMTP Password: la tua password SMTP
```

**Link:** https://www.mailgun.com

---

### **Amazon SES**
- Il più economico a volume ($0.10 per 1.000 email)
- Richiede verifica del dominio
- Setup più tecnico

**Configurazione:**
```
SMTP Host: email-smtp.eu-west-1.amazonaws.com (o altra region)
SMTP Port: 587
SMTP Secure: false (usa STARTTLS)
SMTP User: la tua SMTP username AWS
SMTP Password: la tua SMTP password AWS
```

**Link:** https://aws.amazon.com/ses/

---

### **Postmark**
- Deliverability premium
- 100 email/mese gratis
- Ottimo per email transazionali

**Configurazione:**
```
SMTP Host: smtp.postmarkapp.com
SMTP Port: 587
SMTP Secure: false (usa STARTTLS)
SMTP User: il tuo Server API Token
SMTP Password: il tuo Server API Token
```

**Link:** https://postmarkapp.com

---

## 📋 Confronto rapido

| Servizio | Gratis | Prezzo base | Setup | Deliverability |
|----------|--------|-------------|-------|----------------|
| **Resend** | 3.000/mese | $20/mese (50k) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Brevo** | 300/giorno | €19/mese (20k) | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Mailgun** | 1.000/mese* | $35/mese (50k) | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Amazon SES** | Sandbox only | ~$1/10k | ⭐⭐ | ⭐⭐⭐⭐ |
| **Postmark** | 100/mese | $15/mese (10k) | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

*\* Mailgun: 1.000/mese gratis per i primi 3 mesi*

---

## 🚀 Setup consigliato

1. **Crea un account** su Resend (o il servizio scelto)
2. **Verifica il dominio** (aggiungi i record DNS richiesti)
3. **Genera una API key** o credenziali SMTP
4. **Configura in Bitora CRM:**
   - Vai su `/impostazioni`
   - Compila la sezione "Configurazione SMTP"
   - Salva
5. **Testa** inviando un'email di prova da `/email`

---

## ⚠️ Note importanti

- **Non usare Gmail/Outlook** per invii massivi: hanno limiti severi e potresti essere bloccato
- **Verifica sempre il dominio** del mittente per evitare che le email finiscano in spam
- **Imposta SPF, DKIM e DMARC** per massimizzare la deliverability
- **Monitora le statistiche** (bounce rate, open rate) dal pannello del servizio SMTP

---

## 🔒 Sicurezza

La password SMTP viene **cifrata** prima di essere salvata nel database usando AES-256-GCM.
Solo il server può decifrarla per inviare le email.

Assicurati di avere impostato `SMTP_ENCRYPTION_SECRET` nel tuo `.env`.
