---
name: legal-templates
description: Legal document templates - Privacy Policy, Cookie Policy, Terms & Conditions in IT/EN/CZ. Use when generating legal documents, writing privacy policies, or creating cookie/T&C pages for websites.
version: 1.0.0
---

# Legal Templates Skill

Template documenti legali per siti web multilingua (IT/EN/CZ).

## Documenti Richiesti

| Documento | Obbligatorio | Lingue |
|-----------|-------------|--------|
| Privacy Policy | SI (GDPR) | Tutte le lingue del sito |
| Cookie Policy | SI (ePrivacy) | Tutte le lingue del sito |
| Terms of Service | Consigliato | Tutte le lingue del sito |
| Impressum | SI (se .de/.at) | DE obbligatorio |

---

## 1. Privacy Policy Template

### Italiano

```markdown
# Informativa sulla Privacy

**Ultimo aggiornamento**: [DATA]

## 1. Titolare del Trattamento

[NOME AZIENDA]
Sede legale: [INDIRIZZO]
P.IVA: [PARTITA IVA]
Email: [EMAIL]
PEC: [PEC]

## 2. Tipi di Dati Raccolti

### Dati forniti volontariamente
- Nome e cognome
- Indirizzo email
- Numero di telefono
- [ALTRI DATI DA FORM]

### Dati raccolti automaticamente
- Indirizzo IP (anonimizzato)
- Tipo di browser e dispositivo
- Pagine visitate e tempo di permanenza
- Fonte di traffico

## 3. Finalità del Trattamento

| Finalità | Base Giuridica | Dati |
|----------|---------------|------|
| Rispondere a richieste di contatto | Esecuzione contrattuale | Nome, email, messaggio |
| Invio newsletter | Consenso esplicito | Email |
| Analisi statistiche anonime | Legittimo interesse | Dati di navigazione anonimi |
| [ALTRE FINALITÀ] | [BASE] | [DATI] |

## 4. Conservazione dei Dati

| Dato | Periodo |
|------|---------|
| Dati contatto | 24 mesi dall'ultimo contatto |
| Dati newsletter | Fino a revoca consenso |
| Log di navigazione | 14 mesi |
| Dati contrattuali | 10 anni (obbligo fiscale) |

## 5. Destinatari dei Dati

I dati possono essere comunicati a:
- Provider di hosting: [NOME] (UE/Extra-UE)
- Servizio email: [NOME]
- Servizio analytics: [NOME] (con IP anonimizzato)

## 6. Trasferimento Extra-UE

[Se applicabile: descrivere le garanzie - Decisione di adeguatezza, SCC, ecc.]

## 7. Diritti dell'Interessato

Ai sensi degli artt. 15-22 del GDPR, hai diritto di:
- **Accesso**: ottenere conferma del trattamento e copia dei dati
- **Rettifica**: correggere dati inesatti
- **Cancellazione**: richiedere l'eliminazione dei dati
- **Limitazione**: limitare il trattamento
- **Portabilità**: ricevere i dati in formato strutturato
- **Opposizione**: opporti al trattamento
- **Revoca consenso**: ritirare il consenso in qualsiasi momento

Per esercitare i tuoi diritti: [EMAIL]

Hai diritto di proporre reclamo al Garante per la protezione dei dati personali (www.garanteprivacy.it).

## 8. Cookie

Per informazioni dettagliate sui cookie, consulta la nostra [Cookie Policy](/cookie-policy).

## 9. Modifiche

Questa informativa può essere aggiornata. L'ultima versione è sempre disponibile su questa pagina.
```

---

## 2. Cookie Policy Template

### Struttura

```markdown
# Cookie Policy

**Ultimo aggiornamento**: [DATA]

## Cosa sono i Cookie

I cookie sono piccoli file di testo che i siti web salvano sul tuo dispositivo.

## Tipi di Cookie Utilizzati

### Cookie Necessari (sempre attivi)
| Nome | Provider | Scopo | Durata |
|------|----------|-------|--------|
| cookie-consent | Questo sito | Memorizza preferenze cookie | 12 mesi |
| NEXT_LOCALE | Questo sito | Preferenza lingua | Sessione |

### Cookie Analitici (previo consenso)
| Nome | Provider | Scopo | Durata |
|------|----------|-------|--------|
| _ga | Google Analytics | Distingue utenti | 24 mesi |
| _ga_[ID] | Google Analytics | Mantiene stato sessione | 24 mesi |

### Cookie di Marketing (previo consenso)
| Nome | Provider | Scopo | Durata |
|------|----------|-------|--------|
| _fbp | Facebook | Tracciamento conversioni | 3 mesi |

## Come Gestire i Cookie

Puoi modificare le tue preferenze in qualsiasi momento cliccando su [Gestisci Cookie].

Puoi anche gestire i cookie tramite il tuo browser:
- [Chrome](https://support.google.com/chrome/answer/95647)
- [Firefox](https://support.mozilla.org/kb/cookies)
- [Safari](https://support.apple.com/guide/safari/manage-cookies)
- [Edge](https://support.microsoft.com/microsoft-edge/cookies)
```

---

## 3. Terms of Service Template

### Struttura Minima

```markdown
# Termini e Condizioni

1. **Definizioni** - Sito, Titolare, Utente, Servizio
2. **Accettazione** - Uso del sito = accettazione termini
3. **Servizi offerti** - Descrizione di cosa offre il sito
4. **Proprietà intellettuale** - Copyright contenuti
5. **Limitazione responsabilità** - Disclaimer
6. **Privacy** - Rimando a Privacy Policy
7. **Legge applicabile** - Legge italiana, foro competente
8. **Contatti** - Come contattare il titolare
9. **Modifiche** - Diritto di modificare i termini
```

---

## Implementazione Next.js

### Route Structure

```
app/[locale]/(legal)/
├── privacy/page.tsx
├── cookie-policy/page.tsx
└── terms/page.tsx
```

### Pattern: Documenti legali dal CMS

```tsx
// I documenti legali possono essere:
// 1. Statici in markdown (più semplice)
// 2. Dal CMS Payload (aggiornabili senza deploy)
// 3. Generati da Iubenda (automatici ma meno personalizzabili)

// Opzione 1: Markdown statico
import { getTranslations } from 'next-intl/server';

export default async function PrivacyPage() {
  const t = await getTranslations('legal.privacy');
  return (
    <article className="prose prose-slate mx-auto max-w-3xl px-4 py-16">
      <h1>{t('title')}</h1>
      {/* Contenuto dal file di traduzione */}
    </article>
  );
}
```

## Footer Links (Obbligatori)

```tsx
<footer>
  {/* ... */}
  <div className="text-sm text-muted-foreground">
    <Link href="/privacy">{t('footer.privacy')}</Link>
    <Link href="/cookie-policy">{t('footer.cookies')}</Link>
    <Link href="/terms">{t('footer.terms')}</Link>
  </div>
  <p>© {year} {companyName}. P.IVA {vatNumber}</p>
</footer>
```

**Nota legale**: La P.IVA nel footer è obbligatoria per legge italiana per i siti di aziende.
