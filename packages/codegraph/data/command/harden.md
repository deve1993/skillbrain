# /harden Command

Aggiunge robustezza: error states, empty states, loading states, edge cases, i18n safety.
Trasforma un UI che "funziona nel caso normale" in un UI che funziona sempre.

## Trigger

```
/harden [area opzionale]
```

**Esempi:**
```
/harden                      → Intero progetto
/harden forms                → Solo i form
/harden user profile         → Solo il profilo utente
/harden checkout             → Solo il checkout flow
```

## Cosa fa

### 1. Error States

Per ogni azione che può fallire:
- Form validation errors (field-level, non solo form-level)
- Network error (API down, timeout)
- Permission error (403, 401)
- Not found error (404)
- Server error (500)

Ogni error state deve avere:
- Messaggio chiaro (cosa è andato storto + come risolvere)
- Azione di recovery (retry, go back, contact support)
- Non bloccare l'utente su una pagina vuota

### 2. Empty States

Per ogni lista, collezione, o area di contenuto:
- Cosa vede l'utente quando non c'è nessun dato?
- Empty state educativo (spiega cosa va messo qui e come farlo)
- CTA per aggiungere il primo elemento
- Non una pagina bianca o un messaggio "No items found"

Esempi:
```
No projects yet.
Create your first project to start organizing your work.
[Create project]
```

### 3. Loading States

Per ogni azione asincrona:
- Loading state immediato (entro 100ms dall'azione)
- Skeleton screen per contenuto (non spinner generico dove possibile)
- Progressivo: mostra subito il layout, poi popola i dati
- Disabilita il bottone durante loading (previeni double-submit)
- Timeout handling (cosa succede se richiesta non risponde entro 10s?)

### 4. Edge Cases

**Testo lungo:**
- Nomi utente lunghi? (50+ chars)
- Titoli molto lunghi?
- Descrizioni senza spazi? (url, hash)
- Gestiti con truncate + tooltip, o word-wrap corretto

**Testo molto corto:**
- Una lettera come username?
- Titolo di 1 parola?
- Il layout regge?

**Numeri estremi:**
- 0 items, 1 item, 1000 items
- Prezzo €0, prezzo €999.999
- Percentuale 0%, 100%, 100.5%

**Multilingua:**
- Stringhe tedesche (30% più lunghe dell'inglese)?
- Testi RTL (arabo, ebraico) se supportati?
- Nessun testo hardcoded in componenti (tutto in file i18n)
- Pluralization corretta (0 items / 1 item / N items)

### 5. Input Safety

Ogni input form deve avere:
- `type` corretto (email, tel, number, password, url)
- Su mobile: keyboard appropriata per il tipo
- `autocomplete` attribute dove utile (email, name, address)
- `maxlength` per prevenire input infiniti
- `min`/`max` per numeri
- `pattern` per formati specifici (con esempio nel placeholder)

### 6. Accessibility Robustness

- Tutti i form hanno `<label>` visibili (non solo placeholder)
- Tutti i bottoni iconici hanno `aria-label`
- Tutti i dialog/modal hanno `role="dialog"` e `aria-labelledby`
- Focus management: quando apri modal, focus va dentro; quando chiudi, torna al trigger
- `aria-live` per notifiche dinamiche (toast, aggiornamenti status)

## Output

```
HARDEN COMPLETE — [area]
━━━━━━━━━━━━━━━━━━━━━━━━

✅ Added
  - Error states per 8 form fields
  - Empty state per: projects list, team members, notifications
  - Loading skeletons per: dashboard, user profile, feed
  - Edge cases: long text truncate su 5 componenti
  - i18n safety: 12 stringhe hardcoded → trasferite in messages/

⚠️ Needs attention
  - UserAvatar: nessuna gestione se immagine non carica → aggiunta fallback initials
  - PriceDisplay: non gestisce prezzi > 6 cifre → aggiunto formatter

📁 Files modificati:
  - src/components/forms/ContactForm.tsx
  - src/components/ui/EmptyState.tsx (new)
  - ...
```

## Nota

Questo comando è automaticamente eseguito dal workflow `/frontend` come parte del REFINEMENT GATE,
dopo `/normalize` e prima del QUALITY PHASE.
