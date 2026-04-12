# /polish Command

Final pass prima del deploy. Elimina ogni rough edge.
Controlla ogni pixel, ogni stato, ogni dettaglio.

## Trigger

```
/polish [area opzionale]
```

**Esempi:**
```
/polish                       → Intero progetto
/polish feature modal         → Solo il modal di feature
/polish settings page         → Solo la pagina settings
/polish header navigation     → Solo header e navigation
```

## Quando usare

- Prima di qualsiasi deploy in produzione
- Prima di mostrare un lavoro al cliente
- Come ultima fase del workflow `/frontend`
- Quando il codice "funziona" ma non è ancora "rifinito"

## Cosa fa

### 1. Visual Polish

- Ogni margine è intenzionale? Nessun valore "quasi giusto" lasciato
- Ogni ombra è calibrata? Non troppo forte, non assente quando serve
- Ogni border-radius è coerente con il sistema?
- Ogni font weight è quello corretto per il ruolo?
- Nessun colore placeholder o default lasciato

### 2. Interaction Polish

- Hover states su TUTTI gli elementi interattivi (bottoni, link, card cliccabili, icone)
- Transizioni fluide? (100–300ms, ease appropriato, solo transform/opacity)
- Cursori corretti (`pointer` per clickable, `not-allowed` per disabled)
- Active states (pressed effect) su bottoni e controlli
- Focus rings visibili e coerenti

### 3. Typography Polish

- Nessun testo troncato senza motivo
- Nessun testo overflow fuori dal contenitore
- Line length ottimale (45–75 caratteri per body text, `max-width: 65ch`)
- Numeri tabular dove si allineano dati (`font-variant-numeric: tabular-nums`)

### 4. Responsiveness Polish

- Layout non si rompe a nessuna larghezza (da 320px a 1920px)
- Nessun scroll orizzontale indesiderato su mobile
- Immagini non distorte su nessun breakpoint
- Form usabili su mobile (font size ≥16px per inputs)

### 5. Animation Polish

- Nessuna animazione "dimentata" ancora in esecuzione
- Stagger animations con timing corretto (non troppo lento)
- `prefers-reduced-motion` implementato per tutte le animazioni
- Loading spinners non si sovrappongono a contenuto

### 6. Dark Mode Polish (se implementato)

- Nessun elemento rimasto con colori hardcoded che si rompono in dark
- Contrasto mantenuto in entrambe le modalità
- Immagini e icone visibili in dark mode
- `color-scheme: dark` dichiarato dove necessario

## Output

```
POLISH COMPLETE — [area]
━━━━━━━━━━━━━━━━━━━━━━━━

✅ Applied
  - 5 hover states mancanti → aggiunti
  - 3 font weight inconsistenti → corretti
  - 2 overflow issues mobile → fixati
  - Animation timing su hero → calibrato
  - Dark mode: 4 colori hardcoded → corretti

🚀 READY TO SHIP
```

Se vengono trovati problemi non risolvibili senza input del designer:
```
⚠️ NEEDS DECISION
  - [descrizione del problema + opzioni possibili]
```

## Nota

Questo comando è automaticamente eseguito dal workflow `/frontend` dopo il QUALITY PHASE
e prima del DEPLOY PHASE.
È l'ultima operazione di design prima che il codice vada in produzione.
