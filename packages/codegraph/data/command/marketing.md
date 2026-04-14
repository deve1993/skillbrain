# /marketing Command

Attiva il sistema multi-agente marketing per progettare landing page, funnel di conversione e strategie di lead generation.

## Trigger

```
/marketing [la tua richiesta]
```

**Esempi:**
```
/marketing crea una landing page per il nostro servizio di Design System enterprise
/marketing ottimizza la landing page esistente per aumentare le conversioni
/marketing strategia SEO per posizionarci su "sviluppo app React"
/marketing A/B test per migliorare il conversion rate del hero
```

## Parametri Opzionali

```
/marketing --target [CTO|Developer|PM|Founder]
/marketing --goal [lead|demo|signup|purchase]
/marketing --industry [fintech|saas|agency|ecommerce]
/marketing --locale [it|en|cs]
```

## Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    /marketing WORKFLOW                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. STRATEGY         @growth-architect                       │
│       │              → StrategyBrief.md                      │
│       ▼                                                      │
│  2. PARALLEL EXECUTION                                       │
│       ├── @saas-copywriter      → CopyDeck.md                │
│       ├── @cro-designer         → PageSpec.md                │
│       ├── @tech-seo-specialist  → SEOChecklist.md            │
│       └── @analytics-specialist → Tracking Plan              │
│       ▼                                                      │
│  3. INTEGRATION      @growth-architect verifica allineamento │
│       ▼                                                      │
│  4. HANDOFF          Brief per Dev Team                      │
│       │              → @ui-designer + @component-builder     │
│       ▼                                                      │
│  5. OPTIMIZATION     @analytics-specialist (post-launch)     │
│                      Monitor KPIs, A/B testing, iteration    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

Agenti, skills e template: vedi **Delegation Map** in `AGENTS.md`.

## Quando Usare

| /marketing | /frontend |
|------------|-----------|
| Focus su conversione e lead generation | Workflow completo design → dev → deploy |
| Include SEO, copywriting, CRO, analytics | Include UX research, motion design |
| Output: Strategy + Specs + Copy + Tracking | Output: App/Sito funzionante |

**Usa /marketing quando:**
- Landing page per lead generation o demo booking
- Ottimizzare conversioni di una pagina esistente
- Copy tecnico per audience B2B
- Strategia SEO per servizi tech
- Email sequences, A/B testing

**NON usare /marketing quando:**
- Applicazione completa → `/frontend`
- Solo design visivo → `@ui-designer`
- Solo implementazione → `@component-builder`
