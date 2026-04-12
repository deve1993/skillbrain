# /clone — Website Cloning Pipeline v2.0

> Clona un sito web esistente come progetto Next.js + Tailwind con accuratezza pixel-perfect.

## Trigger

`/clone <url>` oppure "clona", "reverse engineer", "ricrea questo sito"

## ⛔ REGOLA DIRECTORY (FERREA)

L'output del clone va in `Progetti/<slug-sito>/`. Se il nome non è specificato, deriva dallo hostname dell'URL:
- `https://example.com` → `Progetti/clone-example/`
- `https://studio-rossi.it` → `Progetti/clone-studio-rossi/`

**TUTTI gli agenti in questo workflow ricevono il `workdir` = `Progetti/<slug>/`**

## Input Richiesto

| Campo | Richiesto | Default |
|-------|-----------|---------|
| URL del sito | 🔴 Sì | — |
| Output directory | 🟡 No | `Progetti/clone-<hostname>/` |
| Full mode (assets) | 🟡 No | `--full` |

## Workflow

### Step 1: Multi-Source Scraping (Firecrawl + Design Copier)

Esegui **in parallelo** per massima accuratezza:

#### 1a. Firecrawl — Struttura, Contenuto e Brand Identity

```
1. firecrawl_map(url) → Scopri tutte le pagine del sito
2. firecrawl_scrape(url, formats=["markdown", "html", "branding"]) → Homepage con:
   - markdown: contenuto testuale pulito
   - html: struttura HTML reale (non semplificata)
   - branding: brand identity automatica (colori, font, typography, spacing, UI components)
3. Per ogni pagina chiave: firecrawl_scrape(page_url, formats=["markdown", "html"])
4. Salva metadata: title, description, OG image, links interni
```

**Output**: Markdown + HTML strutturale + Brand identity di ogni pagina.

#### 1b. Design Copier MCP — CSS-to-Tailwind Diretto

```
1. designcopier_snapshot(url) → Cattura stili completi della pagina
2. designcopier_extract(html, styles, "tailwind") → Conversione diretta CSS→Tailwind
3. Per sezioni chiave (header, hero, footer):
   designcopier_snapshot(url, selector="header") → Stili per-sezione
   designcopier_extract(sectionHtml, sectionStyles, "tailwind")
4. designcopier_apply(styles, "react", "ComponentName") → Genera componenti React base
```

**Output**: Mapping CSS→Tailwind diretto per-sezione, componenti React scheletro.

### Step 2: Design Token Extraction (Playwright v2.0)

Esegui lo script Playwright migliorato:

```bash
node .Claude/templates/clone-pipeline/extract-design.mjs <url> --output ./clone-output --full
```

**Output v2.0** (6 file invece di 2):
- `design-tokens.json` — Token globali + CSS vars da TUTTI i selettori (`:root`, `.dark`, `[data-theme]`, `prefers-color-scheme`)
- `section-styles.json` — Mappa per-sezione: ogni sezione ha i PROPRI colori, spacing, font, layout
- `interactive-states.json` — Hover/focus/active states + CSS rules per pseudo-classi
- `structure.json` — Albero DOM profondità 6 con layout completo (flex/grid/position con TUTTI i parametri)
- `screenshots/` — 4 viewport (375, 768, 1024, 1440)
- `assets/` — Immagini (max 80), SVG (max 50), font

### Step 3: AI Analysis (@web-analyst)

Delega a `@web-analyst` con `load_skills=["playwright", "dev-browser"]`:

```
TASK: Analizza il sito [URL] usando TUTTI i dati estratti.

CONTEXT:
- design-tokens.json: [path] — token globali + dark mode vars
- section-styles.json: [path] — token per-sezione con layout completo
- interactive-states.json: [path] — hover/focus states e CSS rules
- structure.json: [path] — albero DOM depth 6
- Firecrawl branding data: [branding output]
- Firecrawl HTML: [raw html]
- Design Copier Tailwind: [tailwind conversion output]
- Screenshots: [paths]

EXPECTED OUTCOME: Report strutturato con:
1. Tech stack rilevato
2. Design system completo con mapping Tailwind per-sezione
3. Tailwind @theme config (incluse dark mode vars)
4. Component map (sezione → tipo → complessità → layout details)
5. Animazioni rilevate con mapping Framer Motion
6. Interactive states mapping (hover → Tailwind hover: classes)
7. Assets necessari (conteggio, formato)
8. Cross-reference: design-copier output vs playwright extraction (resolve conflicts)
```

### Step 4: Scaffold Progetto

Delega a `@project-architect` con `load_skills=["frontend-ui-ux"]`:

```
TASK: Crea scaffold Next.js per clone di [URL].

CONTEXT:
- Clone analysis report: [report da Step 3]
- Design tokens: [da Step 2]
- Section styles: [section-styles.json]

EXPECTED OUTCOME:
- Progetto Next.js 15 con App Router
- globals.css con @theme popolato dai design tokens (light + dark)
- Struttura cartelle per componenti sezione
- next.config.ts
- Tailwind configurato
```

### Step 5: Component Building

Delega a `@component-builder` con `load_skills=["frontend-ui-ux"]`:

```
TASK: Implementa i componenti del sito [URL].

CONTEXT:
- Clone analysis report: [report]
- Screenshot reference: [paths to 4 viewport screenshots]
- Section styles: [section-styles.json — USA QUESTO per colori/spacing per-sezione]
- Interactive states: [interactive-states.json — USA QUESTO per hover/focus]
- Design tokens: [design-tokens.json]
- Page structure: [structure.json — depth 6 con layout completo]
- Design Copier components: [React component skeletons da Step 1b]

EXPECTED OUTCOME:
- Componenti sezione (Header, Hero, Features, etc.)
- Responsive (mobile-first)
- Animazioni (Framer Motion)
- Hover/focus states accurati
- Dark mode (se presente)
- Immagini placeholder dove servono
- Accessibilità (ARIA, semantic HTML)

MUST DO:
- Seguire ESATTAMENTE i token per-sezione da section-styles.json
- Usare i layout flex/grid completi da structure.json (justify, align, wrap, gap, position)
- Implementare hover/focus states da interactive-states.json
- Cross-reference con design-copier Tailwind output per validare classi
- Usare shadcn/ui dove possibile
- Pixel-perfect rispetto agli screenshot
- Ogni sezione = componente separato

MUST NOT:
- Non inventare colori o spacing non presenti nei tokens
- Non aggiungere funzionalità non presenti nell'originale
- Non ignorare dark mode se presente nel sito originale
```

### Step 6: Quality Check (Automatico + Manuale)

#### 6a. Screenshot Comparison Automatico

```bash
node .Claude/templates/clone-pipeline/compare-screenshots.mjs \
  --original ./clone-output/screenshots \
  --clone ./Progetti/<slug>/screenshots \
  --output ./clone-output/comparison
```

**Output**: `comparison-report.json` con diff percentuali per viewport.

#### 6b. Verifica QA

Delega a `@project-checker` con `load_skills=["cms-setup"]`:

```
TASK: Verifica qualità del clone di [URL].

CONTEXT:
- comparison-report.json: [da Step 6a]
- Original screenshots: [paths]

EXPECTED OUTCOME:
- Confronto screenshot originale vs clone (con diff score)
- Verifica colori: diff < 5% su hex
- Verifica font: family, weight, size match
- Verifica spacing: ± 4px tolerance
- Verifica hover states: tutti implementati
- Lighthouse score >= originale
- Checklist clone quality (vedi skill website-cloning)
```

## Output Finale

```
clone-output/
├── design-tokens.json          ← Token globali + dark mode + CSS vars per selector
├── section-styles.json         ← Token per-sezione (colori, layout, spacing)
├── interactive-states.json     ← Hover/focus/active states
├── structure.json              ← Albero DOM depth 6 con layout completo
├── analysis-report.md          ← Report AI
├── comparison/                 ← Screenshot diff results
│   └── comparison-report.json
├── screenshots/
│   ├── mobile-375.png
│   ├── tablet-768.png
│   ├── desktop-1024.png
│   └── wide-1440.png
├── assets/
│   ├── images/
│   ├── svgs/
│   └── fonts/
└── project/                    ← Progetto Next.js completo
    ├── src/
    │   ├── app/
    │   ├── components/
    │   └── lib/
    ├── public/
    ├── package.json
    └── ...
```

## Note

- **Etica**: Solo analisi di siti pubblici. Non bypassare auth o paywall.
- **Copyright**: Le immagini e i testi non vengono copiati per uso commerciale — solo come reference per la struttura.
- **Durata stimata**: 10-20 minuti per sito semplice (5-10 pagine).
- **Requisiti**: Playwright installato, Firecrawl API key configurata, Design Copier MCP configurato.
