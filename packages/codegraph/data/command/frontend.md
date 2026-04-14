# /frontend Command

Attiva il workflow completo di sviluppo frontend: design → development → quality gates → deploy.

Il workflow integra automaticamente **Impeccable + Uncodixfy** come guardrail di design.
I comandi di qualità `/critique`, `/audit`, `/normalize`, `/harden`, `/polish` vengono eseguiti
**automaticamente** nelle fasi corrette — nessun intervento manuale richiesto.

## ⛔ REGOLA DIRECTORY (FERREA)

Il progetto viene creato in `Progetti/<slug-progetto>/`. Se il nome non è chiaro dal prompt, chiedi:
"Come vuoi chiamare il progetto? (verrà creato in Progetti/nome-progetto/)"

**TUTTI gli agenti in questo workflow ricevono il `workdir` = `Progetti/<slug>/`**

## Trigger

```
/frontend [la tua richiesta]
```

**Esempi:**
```
/frontend crea un sito portfolio per un'agenzia di design      → Progetti/portfolio-agenzia/
/frontend sito corporate per startup fintech con blog e contatti → Progetti/fintech-corporate/
/frontend landing page + blog per servizio SaaS                  → Progetti/saas-landing/
```

## Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    /frontend WORKFLOW v2                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  0. FIGMA PHASE (opzionale — se URL Figma fornito)              │
│       └── @figma-designer     → Legge design, estrae token      │
│           (produce spec per @component-builder)                  │
│       ▼                                                          │
│  1. DESIGN PHASE (Parallelo)                                    │
│       ├── @ux-designer        → Wireframes, User Flows           │
│       └── dopo UX:                                               │
│            ├── @ui-designer   → Visual Design, Design System     │
│            └── @motion-designer → Animation Specs                │
│                                                                  │
│       ── Tutti i designer caricano: frontend-design skill ──     │
│          (Impeccable guidelines + Uncodixfy anti-patterns)       │
│       ▼                                                          │
│  2. SETUP PHASE                                                  │
│       ├── @project-architect  → Scaffold Next.js + Config        │
│       ├── @tenant-setup       → CMS Tenant (se necessario)      │
│       └── → genera .impeccable.md con contesto progetto          │
│       ▼                                                          │
│  3. BUILD PHASE                                                  │
│       ├── @component-builder  → Componenti UI                    │
│       │    (carica: frontend-design con tutte le reference)      │
│       ├── @api-developer      → API + CMS Integration            │
│       └── @i18n-engineer      → Traduzioni IT/EN/CZ              │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  🎨 DESIGN QUALITY GATE (Automatico)                    │    │
│  │       ├── /critique  → UX review: gerarchia,            │    │
│  │       │               chiarezza, AI slop test            │    │
│  │       └── /audit     → Technical check: a11y,           │    │
│  │                        8 stati, responsive, contrasto    │    │
│  │   [Se issues trovati → fix immediato prima di          ] │    │
│  │   [procedere. Severity HIGH blocca. MEDIUM segnala.   ] │    │
│  └─────────────────────────────────────────────────────────┘    │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  🔧 REFINEMENT GATE (Automatico)                        │    │
│  │       ├── /normalize → Fix inconsistenze token/spacing   │    │
│  │       └── /harden    → Error states, empty states,       │    │
│  │                        i18n edge cases, loading states   │    │
│  └─────────────────────────────────────────────────────────┘    │
│       ▼                                                          │
│  4. QUALITY PHASE (Parallelo)                                   │
│       ├── @test-engineer      → Unit + E2E Tests                 │
│       ├── @seo-specialist     → Meta + Schema + Sitemap          │
│       ├── @performance-engineer → CWV + Bundle Optimization      │
│       └── @accessibility-specialist → WCAG 2.1 AA Audit         │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ✨ POLISH GATE (Automatico — pre-deploy)               │    │
│  │       └── /polish → Final pass: rimuovi ogni rough edge  │    │
│  │                     controlla ogni pixel, ogni stato     │    │
│  └─────────────────────────────────────────────────────────┘    │
│       ▼                                                          │
│  5. DEPLOY PHASE                                                 │
│       ├── @devops-engineer    → Docker + CI/CD                   │
│       ├── @site-deployer      → Coolify Deploy                   │
│       └── @site-qa            → QA Pre-Launch                    │
│       ▼                                                          │
│  6. CHECK PHASE (automatico, skip con --no-check)                │
│       └── @project-checker    → Audit completo pre-deploy        │
│           (struttura, i18n, SEO, GDPR, TS, a11y, perf)          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Design Quality Gate — Comportamento Dettagliato

### Come funziona il /critique automatico

Dopo che @component-builder completa il BUILD PHASE, l'orchestrator esegue automaticamente
una review UX usando le linee guida Impeccable:

1. **AI Slop Test**: Esiste anche solo uno dei pattern Uncodixfy "Hard No"?
   - Glassmorphism, pill shapes, gradient text, eyebrow labels, KPI grid → FIX OBBLIGATORIO
2. **Hierarchy check**: Il test della sfocatura funziona? Si vede la gerarchia?
3. **Tone consistency**: Il design segue la direzione scelta nel DESIGN PHASE?
4. **Interaction states**: Tutti gli 8 stati sono presenti?

**Output del /critique**: Lista prioritizzata di issues. HIGH = blocca. MEDIUM = fix consigliato.

### Come funziona il /audit automatico

Review tecnica immediata:

1. **Accessibility**: Contrast ratio su testo body e UI elements. Focus rings presenti?
2. **Responsive**: Container queries per componenti? Mobile-first? Safe areas?
3. **Motion**: `prefers-reduced-motion` implementato? Solo transform/opacity animati?
4. **Fonts**: Font generici usati (Inter, Roboto, Arial)? → sostituire
5. **Colors**: Gray su sfondo colorato? Pure black/white? → sistemare

### Come funziona il /normalize automatico

Allineamento sistematico post-critique:

1. Uniforma tutti i border-radius al sistema definito
2. Corregge spacing fuori dalla scala 4pt
3. Allinea colori ai token del design system
4. Standardizza tipografia alla scala modulare scelta

### Come funziona il /harden automatico

Robustezza pre-quality:

1. Tutti i form hanno validazione + error states visibili
2. Loading state per ogni azione asincrona
3. Empty state per ogni lista/collezione
4. Testi troppo lunghi gestiti (truncate con ellipsis o wrap corretto)
5. Strings pronte per l'i18n (nessun testo hardcoded in codice)
6. Input type corretto su mobile (email, tel, number)

### Come funziona il /polish automatico

Final pass pre-deploy:

1. Ogni pixel è intenzionale — nessun margine casuale
2. Ogni font weight è corretto per il ruolo
3. Ogni ombra è calibrata
4. Nessun colore "placeholder" rimasto
5. Hover states su tutti gli elementi interattivi
6. Consistent border-radius in tutto il progetto

---

## .impeccable.md — File di Contesto Progetto

Durante il SETUP PHASE, l'orchestrator genera automaticamente `.impeccable.md` nella root
del progetto con il contesto raccolto dal brief iniziale:

```markdown
# [Nome Progetto] — Design Context

## Audience
[Chi usa questo prodotto, device context, technical level]

## Brand Personality
[Formal/playful, minimal/rich, technical/consumer, tone of voice]

## Aesthetic Direction
[La direzione scelta nel DESIGN PHASE — es. "editorial minimal con accenti forti"]

## Existing Colors
[CSS variables o palette esistente, se presente]

## Technical Constraints
[Framework, performance budget, browser support, i18n languages]

## What Makes It Unforgettable
[Il punto di differenziazione principale — la cosa che l'utente ricorderà]
```

Questo file viene letto automaticamente da tutti i design agents in sessioni future,
eliminando la necessità di ripetere il contesto ogni volta.

---

## Flags Opzionali

| Flag | Effetto |
|------|---------|
| `--no-check` | Skip fase 6 (project-checker) |
| `--no-cms` | Skip tenant-setup |
| `--figma <url>` | Attiva fase 0 con URL Figma specificato |
| `--skip-gates` | Skip quality gates (solo per prototipi rapidi) |
| `--lang it,en` | Specifica lingue per i18n (default: it,en,cs) |

---

## Quando Usare

| /frontend | /marketing |
|-----------|------------|
| Sito/app completa | Focus conversione e lead gen |
| Include UX, UI, motion | Include SEO, copy, CRO, analytics |
| Output: App funzionante | Output: Strategy + Specs + Copy |

**Usa /frontend quando:**
- Nuovo sito web completo
- Applicazione web con multiple pagine
- Portfolio, corporate site, blog
- Include sia design che implementazione
