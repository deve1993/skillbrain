---
name: gdpr
description: GDPR compliance knowledge base - cookie audit, form consent, user rights, privacy checklist. Use when auditing GDPR compliance, implementing cookie consent, reviewing form data collection, or checking privacy requirements.
version: 1.0.0
---

# GDPR Compliance Skill

Knowledge base per audit e implementazione compliance GDPR su siti web.

## Checklist GDPR Completa

### 1. Cookie & Tracking

| Requisito | Dettaglio | Priority |
|-----------|-----------|----------|
| Cookie banner | Consenso PRIMA di caricare cookie non essenziali | 🔴 CRITICO |
| Granularità consenso | Categorie separate: necessari, analytics, marketing, preferenze | 🔴 CRITICO |
| Rifiuto facile | "Rifiuta tutti" visibile quanto "Accetta tutti" | 🔴 CRITICO |
| Nessun pre-check | Checkbox NON pre-selezionate | 🔴 CRITICO |
| Consenso registrato | Log di chi ha acconsentito, quando, a cosa | 🟡 IMPORTANTE |
| Revoca consenso | Possibilità di cambiare preferenze in qualsiasi momento | 🔴 CRITICO |
| Script condizionali | GA4, GTM, Facebook Pixel caricati SOLO dopo consenso | 🔴 CRITICO |

### 2. Privacy Policy

| Requisito | Dettaglio |
|-----------|-----------|
| Titolare trattamento | Nome, indirizzo, email, PEC del titolare |
| Dati raccolti | Lista completa di tutti i dati personali raccolti |
| Base giuridica | Per ogni trattamento: consenso, contratto, legittimo interesse |
| Finalità | Perché ogni dato viene raccolto |
| Durata conservazione | Per quanto tempo vengono conservati i dati |
| Diritti interessato | Accesso, rettifica, cancellazione, portabilità, opposizione |
| Trasferimento extra-UE | Se si usano servizi USA (Google, Cloudflare, ecc.) |
| Cookie policy | Dettaglio di ogni cookie, durata, scopo |
| Contatto DPO | Se applicabile (obbligatorio per aziende >250 dipendenti) |

### 3. Form & Dati

| Requisito | Dettaglio |
|-----------|-----------|
| Checkbox consenso | Checkbox esplicita per privacy policy (non pre-checked) |
| Link privacy | Link alla privacy policy vicino al form |
| Minimizzazione dati | Raccogli SOLO i dati necessari |
| Doppio opt-in newsletter | Email di conferma prima di iscrivere |
| Dati sensibili | MAI raccogliere dati sensibili senza consenso esplicito |
| Crittografia | HTTPS obbligatorio, dati sensibili cifrati |

### 4. Diritti Utente

| Diritto | Implementazione |
|---------|-----------------|
| Accesso | Endpoint/pagina per scaricare propri dati |
| Rettifica | Possibilità di modificare i propri dati |
| Cancellazione | "Right to be forgotten" - eliminare account e dati |
| Portabilità | Export dati in formato leggibile (JSON/CSV) |
| Opposizione | Opt-out da marketing/profilazione |

---

## Implementazione Cookie Banner

### Pattern con Iubenda

```tsx
// components/cookie-banner.tsx
'use client';

export function CookieBanner() {
  return (
    <Script
      src={`https://cs.iubenda.com/autoblocking/${siteId}.js`}
      strategy="beforeInteractive"
    />
    <Script
      src="//cdn.iubenda.com/cs/iubenda_cs.js"
      strategy="afterInteractive"
    />
  );
}
```

### Pattern Custom (senza Iubenda)

```tsx
// Pattern cookie consent custom
// 1. Mostra banner al primo accesso
// 2. Blocca TUTTI gli script di tracking
// 3. Al consenso, carica script in base alle categorie accettate
// 4. Salva preferenze in localStorage + cookie
// 5. Fornisci UI per revocare/modificare consenso

const CONSENT_KEY = 'cookie-consent';

type ConsentCategories = {
  necessary: true;      // Sempre true, non disattivabile
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
};

// Caricamento condizionale GA4
function loadAnalytics(consent: ConsentCategories) {
  if (consent.analytics) {
    // Carica GA4 script
    window.gtag?.('consent', 'update', {
      analytics_storage: 'granted',
    });
  }
}
```

---

## Audit GDPR Automatico

### Check da eseguire su ogni sito:

```
1. COOKIE SCAN
   - Quali cookie vengono impostati prima del consenso?
   - Ci sono cookie di terze parti senza consenso?
   - Il banner è presente e funzionante?

2. SCRIPT SCAN
   - GA4/GTM caricato prima del consenso? → VIOLAZIONE
   - Facebook Pixel caricato prima del consenso? → VIOLAZIONE
   - Hotjar/analytics caricati prima del consenso? → VIOLAZIONE

3. FORM SCAN
   - Checkbox privacy presente?
   - Link a privacy policy presente?
   - Dati minimi richiesti?
   - Double opt-in per newsletter?

4. DOCUMENT SCAN
   - Privacy policy presente e aggiornata?
   - Cookie policy presente?
   - Terms of service presenti?
   - Documenti in tutte le lingue del sito?

5. SECURITY SCAN
   - HTTPS attivo?
   - Headers di sicurezza (CSP, X-Frame-Options)?
   - Dati sensibili cifrati?
```

---

## Template Privacy Policy

Struttura minima richiesta per legge italiana + GDPR:

```
1. Titolare del trattamento
2. Tipi di dati raccolti
3. Modalità di trattamento
4. Base giuridica del trattamento
5. Finalità del trattamento
6. Destinatari dei dati
7. Trasferimento dati extra-UE
8. Periodo di conservazione
9. Diritti dell'interessato
10. Cookie policy (può essere separata)
11. Modifiche alla policy
12. Data ultimo aggiornamento
```

## Sanzioni

| Violazione | Sanzione massima |
|------------|-----------------|
| Mancata informativa | Fino a €20M o 4% fatturato |
| Cookie senza consenso | Fino a €20M o 4% fatturato |
| Data breach non notificato | Fino a €10M o 2% fatturato |
| Mancata nomina DPO | Fino a €10M o 2% fatturato |
