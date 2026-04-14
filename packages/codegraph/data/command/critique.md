# /critique Command

Review UX di un componente, pagina o area specifica.
**Solo analisi — nessuna modifica al codice.**

## Trigger

```
/critique [area opzionale]
```

**Esempi:**
```
/critique                    → Review dell'intero progetto corrente
/critique hero               → Solo la sezione hero
/critique dashboard          → Solo il dashboard
/critique checkout flow      → Solo il flusso di checkout
/critique onboarding         → Solo l'onboarding
```

## Cosa fa

Il critique esegue questa sequenza di check, usando le linee guida di `frontend-design` skill:

### 1. AI Slop Test (Blocchi critici)

Controlla i pattern "Hard No" di Uncodixfy. Se presente anche solo UNO:
- Glassmorphism come linguaggio visuale di default
- Pill shapes su tutti i componenti
- Gradient text su metriche o heading
- Eyebrow labels (`<small>UPPERCASE</small>` sopra heading)
- KPI card grid come prima scelta per dashboard
- Hero section dentro UI interna
- Decorative copy come page header

→ **SEVERITY: HIGH** — blocca il progresso

### 2. Hierarchy Check

- Sfoca mentalmente il layout: si vede ancora la gerarchia?
- L'elemento più importante è visivamente dominante?
- Ci sono 2-3 livelli chiari di importanza?
- Ci sono aree dove tutto ha lo stesso peso visivo?

### 3. Aesthetic Consistency

- Il design segue la direzione stabilita in `.impeccable.md`?
- I font sono coerenti con la scelta iniziale?
- La palette è rispettata?
- Il tono (minimal/bold/editorial) è mantenuto?

### 4. Interaction States

- Tutti gli 8 stati sono presenti? (default, hover, focus, active, disabled, loading, error, success)
- Focus rings visibili per navigazione keyboard?
- Hover states su tutti gli elementi interattivi?
- Stati di loading per ogni azione asincrona?

### 5. Typography Violations

- Font generici usati? (Inter, Roboto, Arial, Open Sans)
- Scaling incoerente (troppe dimensioni troppo vicine)?
- Body text < 16px?
- Gerarchia affidata solo alla dimensione (senza weight e color)?

### 6. Layout Issues

- Cards nested dentro cards?
- Spacing identico ovunque (nessun ritmo)?
- Tutto centrato?
- Allineamento misto (alcuni elementi a sinistra, altri al centro)?

## Output

```
CRITIQUE REPORT — [area] — [data]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔴 HIGH (bloccanti)
  1. [Pattern + dove si trova + perché è un problema]
  2. ...

🟡 MEDIUM (raccomandati)
  1. [Pattern + dove + fix suggerito]
  2. ...

🟢 LOW (opzionali)
  1. [Piccolo miglioramento]
  2. ...

CONCLUSIONE: [PASS / FIX REQUIRED]
```

## Nota

Questo comando è automaticamente eseguito dal workflow `/frontend` dopo il BUILD PHASE.
Può essere invocato manualmente in qualsiasi momento su qualsiasi progetto.
