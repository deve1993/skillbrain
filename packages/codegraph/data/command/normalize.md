# /normalize Command

Allinea il codice al design system del progetto.
Corregge inconsistenze di spacing, token, tipografia e colori.

## Trigger

```
/normalize [area opzionale]
```

**Esempi:**
```
/normalize                   → Intero progetto
/normalize buttons           → Solo i bottoni
/normalize blog              → Solo le pagine blog
/normalize typography        → Solo la tipografia
/normalize spacing           → Solo lo spacing
```

## Cosa fa

### 1. Spacing Audit

- Trova tutti i valori di spacing hardcoded fuori dalla scala (4/8/12/16/24/32/48/64/96px)
- Sostituisce con CSS variables o Tailwind classes del design system
- Uniforma `padding` e `gap` incoerenti tra componenti simili

### 2. Color Token Compliance

- Identifica colori hardcoded (`#333`, `rgba(0,0,0,0.8)`)
- Sostituisce con i token del design system (`var(--color-text)`, `text-gray-800`)
- Corregge gray su sfondo colorato (usa shade della background invece)
- Elimina pure black e pure white (tinta con hue brand)

### 3. Typography Standardization

- Uniforma font sizes alla scala modulare del progetto
- Corregge font weights inconsistenti per lo stesso ruolo visivo
- Allinea line-height ai valori del sistema
- Sostituisce font generici (Inter/Roboto) con quello scelto nel design

### 4. Border Radius Consistency

- Uniforma border-radius ai valori del sistema (non >12px su cards, >8px su buttons)
- Elimina valori arbitrari (17px, 23px, 30px)
- Standardizza pill shapes dove non appropriati

### 5. Component Consistency

- Trova varianti dello stesso componente con implementazioni diverse
- Standardizza la versione più corretta
- Estrae pattern ripetuti in componenti riusabili se >3 occorrenze

## Output

Applica le modifiche direttamente, poi riporta:

```
NORMALIZE COMPLETE — [area]
━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Fixed
  - 12 spacing values fuori scala → standardizzati
  - 8 colori hardcoded → token
  - 3 font sizes anomali → corretti
  - border-radius inconsistenti → uniformati

📁 Files modificati:
  - src/components/ui/Card.tsx
  - src/styles/globals.css
  - ...
```

## Nota

Questo comando è automaticamente eseguito dal workflow `/frontend` dopo il DESIGN QUALITY GATE.
Richiede che il progetto abbia un design system definito (CSS variables, Tailwind config, o tokens).
