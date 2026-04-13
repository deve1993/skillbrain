# Frontend & Marketing Multi-Agent System v2.0

Sistema multi-agente per sviluppo frontend professionale e marketing digitale.

---

## 🚀 MODALITÀ SEMPLIFICATA ATTIVA

Per ridurre la complessità, interagisci principalmente con due agenti:

1. **`@planner` (The Architect)**
   - **Cosa fa**: Pensa, pianifica, analizza, strategia.
   - **Quando usare**: "Crea un piano", "Analizza", "Strategia".

2. **`@builder` (The Maker)**
   - **Cosa fa**: Costruisce, scrive codice, fissa bug, deploy.
   - **Quando usare**: "Implementa", "Correggi", "Deploya".

*(Vedi `.Claude/guides/SIMPLE_MODE.md` per dettagli)*

---

## SMART INTAKE PROTOCOL

**Questa sezione ha priorità massima.** Prima di eseguire qualsiasi richiesta, segui questo protocollo.

### Fase 0: Classifica (silenzioso, automatico)

Quando l'utente scrive qualsiasi cosa, classifica immediatamente:

| Segnali nel messaggio | Tipo | Complessità | Mostra Brief? |
|---|---|---|---|
| "landing page", "sito", "website", "homepage", "portfolio" | `NUOVO_SITO` | COMPLESSO | SI |
| "conversione", "funnel", "CRO", "lead gen", "ottimizza CR" | `MARKETING` | COMPLESSO | SI |
| "setup", "scaffold", "nuovo progetto", "inizializza" | `SETUP_PROGETTO` | COMPLESSO | SI |
| "design", "mockup", "wireframe", "UI" | `DESIGN` | MEDIO | SI |
| "componente", "implementa", "feature", "form", "button" | `COMPONENTE` | SEMPLICE | NO |
| "audit", "controlla", "verifica", "performance", "SEO" | `AUDIT` | SEMPLICE | NO |
| "clona", "analizza", "competitor", "reverse engineer" | `ANALISI` | MEDIO | NO |
| "fix", "bug", "errore", "non funziona", "broken" | `FIX` | SEMPLICE | NO |
| "refactor", "rinomina", "sposta", "estrai", "ristruttura", "split" | `REFACTOR` | MEDIO | NO |
| "dipendenze", "cosa usa", "chi chiama", "impatto", "blast radius" | `CODICE` | SEMPLICE | NO |
| "video", "remotion", "clip", "social" | `VIDEO` | MEDIO | SI |
| "cms", "payload", "collection", "tenant" | `CMS` | MEDIO | NO |
| "nuovo cliente", "client", "sito cliente", "sito per" | `CLIENT` | COMPLESSO | SI |
| "n8n", "workflow", "automazione", "webhook trigger" | `AUTOMATION` | MEDIO | NO |
| "gdpr", "privacy", "cookie policy", "legal", "terms" | `COMPLIANCE` | MEDIO | NO |
| "modulo", "prenotazioni", "e-commerce", "affiliati" | `CMS_MODULE` | SEMPLICE | NO |

### Fase 1: Estrai Info dal Messaggio (silenzioso)

Scansiona il messaggio ed estrai automaticamente:
- **target**: Chi è il destinatario/cliente finale?
- **prodotto**: Cosa si promuove/costruisce?
- **goal**: Qual è l'obiettivo? (lead, demo, vendita, awareness, funzionalità)
- **esiste**: C'è già un sito/brand/repo? (cerca URL, "da zero", "esistente")
- **tono**: Preferenze di stile? (tech, corporate, friendly, bold, minimal)
- **vincoli**: Budget, timeline, lingue, competitor, stack specifico

### Fase 2: Gap Analysis — Chiedi Solo il Mancante

Confronta le info estratte con la matrice sotto. Chiedi **SOLO** i campi 🔴 mancanti. **Max 3 domande.**

#### Matrice Info Critiche per Tipo

**Task COMPLESSI** (brief obbligatorio prima di partire):

| Campo | NUOVO_SITO | MARKETING | SETUP_PROGETTO | CLIENT |
|---|---|---|---|---|
| 🔴 target | Chi è il cliente finale | Chi convertire | Chi lo userà | Nome azienda/cliente |
| 🔴 prodotto | Cosa promuovi/mostri | Cosa ottimizzare | Tipo di app/sito | Tipo attività |
| 🔴 goal | Lead/demo/vendita/awareness | KPI target | Features principali | Obiettivi del sito |
| 🟡 esiste | Brand/assets esistenti | URL pagina attuale | Repo/stack esistente | Brand/logo/contenuti |
| 🟡 tono | Tech/corporate/friendly | — | — | Stile desiderato |
| 🟢 vincoli | Budget, lingue, competitor | Metriche attuali | Stack preferences | Timeline, lingue |

**Task SEMPLICI** (parti diretto se hai le 🔴):

| Campo | COMPONENTE | AUDIT | FIX | ANALISI |
|---|---|---|---|---|
| 🔴 cosa | Che componente | Tipo audit | Che errore/problema | Cosa analizzare |
| 🔴 dove | Quale progetto/pagina | URL o progetto | File/componente | URL target |
| 🟡 riferimento | Screenshot/esempio | Priorità | Logs/errore | Scopo dell'analisi |

**Task MEDI** (parti con le 🔴, chiedi se servono dettagli):

| Campo | COMPLIANCE | CMS_MODULE |
|---|---|---|
| 🔴 cosa | Tipo audit/documento | Quale modulo |
| 🔴 dove | Quale progetto/sito | Quale tenant |
| 🟡 riferimento | Lingue documenti | Configurazione specifica |

**Regole domande:**
- Se TUTTI i campi 🔴 sono presenti → non chiedere nulla
- Se mancano campi 🟡 → proponi default ragionevoli e parti
- Se mancano campi 🔴 → chiedi con domande mirate (usa il tool question)
- MAI chiedere più di 3 domande
- MAI chiedere info inferibili dal contesto (progetto attuale, conversazioni precedenti)

### Fase 3: Brief (solo per task COMPLESSI)

Per task COMPLESSI, compila e mostra all'utente:

```
BRIEF COMPILATO:
  Tipo:      [classificazione]
  Target:    [chi]
  Prodotto:  [cosa]
  Goal:      [obiettivo]
  Esiste:    [si/no + dettaglio]
  Tono:      [stile]
  Vincoli:   [lista]
  Workflow:   [quale comando/flusso attiverò]

Confermo e parto?
```

Per task SEMPLICI e MEDI → parti direttamente senza brief.

### Fase 4: Esecuzione

Delega al workflow appropriato con il brief come contesto:
- `NUOVO_SITO` → workflow `/frontend` 
- `MARKETING` → workflow `/marketing`
- `SETUP_PROGETTO` → subagent project-architect
- `COMPONENTE` → subagent component-builder
- `AUDIT` → workflow `/audit`
- `ANALISI` → subagent web-analyst
- `FIX` → risolvi direttamente
- `VIDEO` → workflow `/video`
- `CMS` → workflow `/cms-setup`
- `DESIGN` → subagent ui-designer / ux-designer
- `CLIENT` → workflow `/new-client`
- `COMPLIANCE` → workflow `/gdpr-audit` o `/generate-legal`
- `CMS_MODULE` → workflow `/cms-module`
- `AUTOMATION` → subagent n8n-workflow
- `REFACTOR` → carica skill `gitnexus`, esegui impact analysis → poi procedi
- `CODICE` → carica skill `gitnexus`, usa tool `gitnexus_query` / `gitnexus_context`

### Esempi Input

- **Eccellente** (0 domande): Include target, prodotto, goal, brand, tono, competitor, lingue
- **Buono** (1-2 domande): Manca solo qualche campo 🔴
- **Minimo** (parti diretto): Task semplice con cosa+dove chiari

---

## ⛔ REGOLA FERREA: Protocollo Form

**Questa regola ha priorità MASSIMA. Si applica OGNI VOLTA che si costruisce un form in qualsiasi progetto.**

### Quando si attiva

Ogni volta che un task richiede la creazione di un **form** (contatto, preventivo, prenotazione, candidatura, newsletter, qualsiasi raccolta dati), l'agente DEVE **fermarsi e chiedere** prima di implementare.

### Domanda obbligatoria

```
FORM DETECTED: Dove vuoi inviare i dati di questo form?

1. Odoo CRM Lead (crea lead automatico in Odoo via /api/crm/<endpoint>)
2. Payload CMS (salva nel CMS multi-tenant)
3. Email (invio email con i dati)
4. Custom endpoint (URL specifico)
5. Multiplo (es. Odoo + Email)
```

### Se l'utente sceglie Odoo

Caricare la skill `odoo-crm-lead` e seguire il protocollo documentato nella skill:
- Chiedere endpoint slug, apikey, campi custom
- Usare Server Action (mai client-side diretto per CORS)
- Template: `OdooLeadForm` componente riusabile
- ENV: `NEXT_PUBLIC_ODOO_URL`, `ODOO_API_KEY`
- Istanza Odoo: `https://fl1.cz/odoo`

### Skills da caricare per form

| Destinazione | Skills |
|--------------|--------|
| Odoo CRM | `odoo-crm-lead`, `forms` |
| Payload CMS | `forms`, `payload` |
| Email | `forms`, `email` |
| Custom | `forms` |

---

## ⛔ REGOLA FERREA: ESLint Auto-Fix

**Questa regola ha priorità MASSIMA. Si applica durante qualsiasi build, test o scaffolding.**

### Quando si attiva

Ogni volta che compare un errore ESLint o TypeScript durante:
- `npm run build` / `npm run dev`
- `npm run lint` / `npm run typecheck`
- Setup/scaffolding di un nuovo progetto
- Test E2E o unit test

### Comportamento obbligatorio

1. **Esegui immediatamente** `npm run lint:fix` nella directory del progetto
2. **Se rimangono errori** dopo l'auto-fix → correggi manualmente, file per file
3. **Non chiedere all'utente** — risolvi e continua
4. **Non ignorare** errori con `// eslint-disable` o `@ts-ignore` — mai
5. **Dopo la correzione** → riesegui il comando originale per verificare che passi

### Errori TypeScript

Stessa logica: correggi il tipo corretto. Mai usare `as any`, `as unknown`, `@ts-ignore`, `@ts-expect-error`.

---

## 🧠 PROTOCOLLO MEMORIA (Memory MCP)

Il MCP `memory` è attivo in ogni sessione. Usarlo sistematicamente è il meccanismo principale di **auto-evoluzione del sistema** — ogni sessione diventa più intelligente grazie a quelle precedenti.

### Regola: PRIMA di ogni task complesso

```
memory_search_nodes({query: "tipo di task o tecnologia coinvolta"})
```

Cerca pattern, decisioni architetturali, bug noti, soluzioni già trovate. Se trovi risultati rilevanti (score > 0.7), usali come punto di partenza invece di ricominciare da zero.

### Regola: DOPO ogni task completato con successo

Salva obbligatoriamente:

```
memory_create_entities([{
  name: "Pattern: [nome breve]",
  entityType: "pattern",
  observations: [
    "Contesto: qual era il problema",
    "Soluzione: cosa ha funzionato",
    "Progetto: nome-progetto",
    "Stack: tecnologie usate",
    "Data: YYYY-MM"
  ]
}])
```

### Cosa salvare (obbligatorio)

| Tipo | Quando | Esempio entity name |
|------|--------|---------------------|
| **Pattern** | Soluzione riusabile trovata | `Pattern: form Odoo con Server Action` |
| **Decisione** | Scelta architetturale importante | `Decision: i18n routing Quickfy` |
| **Bug** | Bug risolto con causa non ovvia | `Bug: hydration mismatch ExitIntentPopup` |
| **Config** | Configurazione che ha richiesto tempo | `Config: Coolify multi-stage arm64` |
| **Errore** | Approccio sbagliato da evitare | `Antipattern: client-side Odoo API call` |

### Cosa NON salvare

- Task banali o implementazioni standard
- Codice grezzo (solo il pattern e la decisione)
- Info specifiche del cliente (dati sensibili)

### Query utili

```
memory_search_nodes({query: "Quickfy form"})      # Trova pattern su Quickfy
memory_search_nodes({query: "Payload CMS hook"})  # Trova decisioni CMS
memory_search_nodes({query: "antipattern"})        # Trova errori da evitare
memory_read_graph()                                # Vista completa knowledge base
```

---

## ⛔ REGOLA FERREA: Code Intelligence (GitNexus)

**Questa regola ha priorità MASSIMA per qualsiasi task che tocca codice esistente.**

GitNexus indicizza il codebase in un knowledge graph (AST → dipendenze → flussi di esecuzione). I tool MCP sono disponibili in ogni sessione. **Usarli è obbligatorio prima di modificare codice esistente.**

### Repo Indicizzate

| Nome repo | Simboli | Cluster | Flussi | Progetto |
|-----------|---------|---------|--------|----------|
| `Quickfy-website` | 711 | 55 | 41 | Web_Quickfy/Quickfy-website |
| `pixarts-landing` | 669 | 35 | 41 | Web_Pixarts/pixarts-landing |
| `WEB_DVEsolutions` | 236 | 6 | 6 | Web_dvesolutions/WEB_DVEsolutions |
| `Web-site` | 382 | 27 | 22 | Web_biemme2/Web-site |

> Se stai lavorando su più repo, specifica sempre il parametro `repo` nei tool.

### Workflow Obbligatorio per Task su Codice

**Prima di QUALSIASI modifica a una funzione, classe o metodo esistente:**

```
1. gitnexus_impact({target: "NomeSymbol", direction: "upstream", repo: "nome-repo"})
   → Controlla depth=1 (WILL BREAK) e depth=2 (LIKELY AFFECTED)
   → Se risk=HIGH o CRITICAL: avvisa l'utente prima di procedere

2. gitnexus_context({name: "NomeSymbol", repo: "nome-repo"})
   → Vista 360°: chi chiama, chi viene chiamato, in quali flussi partecipa
```

**Prima di QUALSIASI commit:**

```
gitnexus_detect_changes({scope: "all"})
→ Verifica che solo i file attesi siano cambiati
→ Riporta i processi impattati
```

**Per debugging:**

```
1. gitnexus_query({query: "sintomo o concetto", repo: "nome-repo"})
   → Trova flussi di esecuzione legati al problema (meglio del grep)
2. gitnexus_context({name: "funzione sospetta"})
   → Vedi tutti i caller e capisce da dove arriva il bug
3. READ gitnexus://repo/{nome}/process/{processName}
   → Traccia il flusso completo step by step
```

**Per esplorare un'area sconosciuta:**

```
READ gitnexus://repo/{nome}/clusters
→ Lista di tutte le aree funzionali rilevate (con cohesion score)

READ gitnexus://repo/{nome}/cluster/{nomeCluster}
→ File chiave, simboli, entry point dell'area
```

### Regole Assolute

| Regola | Descrizione |
|--------|-------------|
| **R1** | MAI modificare una funzione/classe senza prima eseguire `gitnexus_impact` |
| **R2** | MAI rinominare con find-and-replace → usare `gitnexus_rename` (capisce il call graph) |
| **R3** | MAI ignorare warning HIGH o CRITICAL da impact analysis |
| **R4** | MAI fare commit senza `gitnexus_detect_changes` per verificare lo scope |
| **R5** | SEMPRE specificare il parametro `repo` quando si lavora su più progetti |

### Aggiornare l'Indice

Dopo sessioni di lavoro intense (molti file modificati), rieseguire:

```bash
gitnexus analyze   # dalla root del progetto
```

---

## Stack Tecnologico

| Componente | Tecnologia |
|------------|------------|
| **Framework** | Next.js 15+ (App Router, RSC) |
| **CMS** | Payload CMS 3.0 (Multi-tenant, `cms.pixarts.eu`) |
| **Database** | MongoDB (gestito dal CMS) |
| **UI** | shadcn/ui + Tailwind CSS 4 |
| **Deployment** | Coolify (Docker multi-stage) |
| **Lingue** | IT (default), EN, CZ — i18n fin dall'inizio |

---

## ⛔ REGOLA FERREA: Separazione Workflow / Progetti

**Questa regola ha priorità MASSIMA. Nessuna eccezione.**

### Struttura Directory

```
Lavori-Web/                          ← ROOT (SOLO config workflow)
├── .Claude/                         ← agents, skills, commands, templates
├── opencode.json                    ← config MCP/agenti
├── AGENTS.md                        ← istruzioni root
├── settings.local.json              ← settings OpenCode
└── Progetti/                        ← TUTTI i progetti client
    ├── nome-cliente-1/              ← progetto completo (src, package.json, .env, etc.)
    ├── nome-cliente-2/
    └── ...
```

### Regole

| Regola | Descrizione |
|--------|-------------|
| **R1** | Ogni progetto client va in `Progetti/<nome-progetto>/` |
| **R2** | MAI creare file di progetto (src/, package.json, .env, etc.) nella root di Lavori-Web |
| **R3** | MAI creare file di workflow (.Claude/, agents, skills) dentro Progetti/ |
| **R4** | Quando un comando o agente crea/scaffolda un progetto, il `workdir` DEVE essere `Progetti/<nome>/` |
| **R5** | Il nome cartella progetto = slug del client (lowercase, kebab-case) |

### Per gli Agenti

Quando ricevi un task che crea/modifica file di progetto:

1. **Verifica** che il `workdir` sia dentro `Progetti/`
2. **Se manca il nome progetto**, chiedi: "In quale progetto? (Progetti/???)"
3. **Se qualcuno chiede di creare file nella root**, rifiuta e spiega la regola
4. **Path pattern**: `Progetti/<slug>/src/...`, `Progetti/<slug>/package.json`, etc.

### Eccezioni

Solo questi file possono stare nella ROOT:
- `.Claude/` e tutto il suo contenuto (agents, skills, commands, templates)
- `opencode.json`, `AGENTS.md`, `settings.local.json`
- `.gitignore`, `README.md` del workspace
- `Progetti/` directory

**TUTTO IL RESTO → dentro `Progetti/<nome-progetto>/`**

---

## Comandi Disponibili

| Comando | Cosa fa | Quando usarlo |
|---------|---------|---------------|
| `/frontend` | Workflow completo: design → dev → deploy | Nuovo sito/app da zero |
| `/marketing` | Strategy + copy + CRO + SEO + tracking | Landing page per conversione |
| `/new-client "Nome"` | Workflow creazione sito cliente (intake → CMS → build → deploy → QA) | Sito per nuovo cliente |
| `/design` | Solo fase design (UX, UI, Motion) | Concept visivo senza code |
| `/audit` | Security + Performance + SEO audit | Verificare sito esistente |
| `/review` | Code review approfondita | Dopo implementazione |
| `/clone <url>` | Pipeline clonazione pixel-perfect: Firecrawl + Playwright + design tokens → Next.js | Ricreare sito esistente |
| `/analyze` | Analisi competitor e trend | Ricerca di mercato |
| `/cms-setup` | Configura integrazione Payload CMS | Setup CMS per progetto |
| `/cms-module <modulo> <tenant>` | Aggiunge modulo funzionale al CMS | Estendere funzionalità tenant |
| `/video` | Video programmatici con Remotion | Intro, social clip, OG video |
| `/gdpr-audit` | Audit compliance GDPR (tracking, cookies, form) | Pre-lancio compliance |
| `/generate-legal` | Genera Privacy, Cookie, T&C (IT/EN/CZ) | Documenti legali |
| `/generate-sitemap` | Sitemap XML human-readable con XSL | SEO tecnico |
| `/n8n <descrizione>` | Crea workflow n8n da descrizione | Automazione processi |
| `/check [target]` | Audit completo progetto/sistema (struttura, SEO, GDPR, i18n, TS, a11y, perf) | Verifica completezza |
| `/new-project "Nome"` | Bootstrap automatico progetto client (Next.js + i18n + shadcn + Dockerfile) | Nuovo progetto da zero senza design |
| `/update-project "Nome"` | Aggiorna progetto esistente: dipendenze, automation, build, check qualità | Aggiornare progetto già live |
| `/system-sync` | Audit sistema: drift AGENTS.md↔opencode.json, gitnexus stale, skill inventory, memory report | Inizio settimana / dopo modifiche sistema |

---

## Skills (Caricamento On-Demand)

Le skill forniscono knowledge base specializzata. **Caricare SOLO quelle pertinenti al task corrente.**

| Area | Skills disponibili |
|------|--------------------|
| **Code Intelligence** | `gitnexus` — knowledge graph, blast radius, call chains |
| **Framework** | `nextjs`, `astro`, `sveltekit`, `nuxt` |
| **UI/Design** | `shadcn`, `tailwind`, `animations`, `motion-system`, `fonts` |
| **CMS/DB** | `payload`, `database` |
| **MCP Tools** | `figma`, `mongodb`, `docker` |
| **Pixarts** | `pixarts/workflow`, `pixarts/multitenancy`, `pixarts/client-site`, `pixarts/cms-modules`, `pixarts/design-system`, `pixarts/template-architecture` |
| **Features** | `i18n`, `auth`, `state`, `forms` |
| **Integrations** | `payments`, `email`, `analytics`, `media` |
| **DevOps** | `coolify`, `scraping`, `testing`, `eslint`, `website-cloning` |
| **Video** | `remotion` |
| **Marketing** | `landing-architecture`, `copywriting`, `cro-patterns`, `analytics-tracking`, `email-sequence`, `ab-testing`, `mobile-first`, `product-marketing-context`, `content-strategy`, `launch-strategy`, `pricing-strategy`, `site-architecture`, `competitor-alternatives` |
| **SEO** | `seo`, `sitemap` |
| **Compliance** | `gdpr`, `legal-templates`, `iubenda` |
| **Automation** | `n8n` |

---

## Payload CMS

| | |
|---|---|
| **Admin** | `https://cms.pixarts.eu/admin` |
| **API** | `https://cms.pixarts.eu/api` |
| **Multi-tenant** | Ogni progetto = un tenant separato |

**Workflow**: Crea tenant → Configura collections → `/cms-setup` per connettere frontend → Fetch con filtro tenant → Revalidate on change

**Collections standard**: `tenants`, `users`, `pages`, `posts`, `media`, `categories`

### Moduli CMS Disponibili

Aggiungi funzionalità con `/cms-module <modulo> <tenant>`. Moduli: `reservations`, `ecommerce`, `events`, `portfolio`, `faq`, `newsletter`, `reviews`, `jobs`, `memberships`, `affiliates`. Dettagli in skill `pixarts/cms-modules`.

---

## Delegation Map

Mappa di delegazione per l'orchestrator. Ogni agente ha un'invocazione ottimale predefinita.

### Agenti con subagent_type (invocazione diretta)

| Agente | `subagent_type` | `load_skills` | Quando |
|--------|-----------------|---------------|--------|
| @planner | `planner` | `["frontend-ui-ux", "landing-architecture"]` | Analisi, pianificazione, strategia, design UX/UI |
| @builder | `builder` | `["frontend-ui-ux", "nextjs", "gitnexus"]` | Implementazione, bug fix, deploy, feature building |
| @ux-designer | `ux-designer` | `["frontend-ui-ux"]` | User flows, wireframes, architettura info |
| @ui-designer | `ui-designer` | `["frontend-ui-ux"]` | Visual design, color palette, typography |
| @motion-designer | `motion-designer` | `["frontend-ui-ux"]` | Animazioni, transizioni, micro-interactions |
| @video-creator | `video-creator` | `["frontend-ui-ux"]` | Video Remotion (intro, social, OG) |
| @project-architect | `project-architect` | `["frontend-ui-ux"]` | Setup progetto, scaffold, architettura |
| @component-builder | `component-builder` | `["frontend-ui-ux"]` | Componenti UI, shadcn/ui, Tailwind |
| @api-developer | `api-developer` | `["cms-setup"]` | Backend, API, validazione, CMS integration |
| @i18n-engineer | `i18n-engineer` | `["frontend-ui-ux"]` | Traduzioni IT/EN/CZ, localizzazione |
| @test-engineer | `test-engineer` | `["playwright", "gitnexus"]` | Unit, E2E, visual regression, a11y test |
| @code-reviewer | `code-reviewer` | `["gitnexus"]` | Code review approfondita |
| @documentation-writer | `documentation-writer` | `[]` | README, guide, docs tecniche |
| @web-analyst | `web-analyst` | `["playwright", "dev-browser"]` | Scraping, reverse engineering, competitor, `/clone` pipeline |
| @payload-cms | `payload-cms` | `["cms-setup"]` | Collections, access control, hooks, multi-tenancy |
| @seo-specialist | `seo-specialist` | `[]` | Meta tags, schema.org, sitemap, keyword |
| @performance-engineer | `performance-engineer` | `["frontend-ui-ux", "gitnexus"]` | Bundle size, CWV, lazy loading |
| @security-auditor | `security-auditor` | `["gitnexus"]` | Headers, CSP, vulnerabilità, audit |
| @devops-engineer | `devops-engineer` | `[]` | Docker, Coolify, CI/CD, monitoring |
| @accessibility-specialist | `accessibility-specialist` | `["frontend-ui-ux"]` | WCAG 2.1, ARIA, screen reader |
| @n8n-workflow | `n8n-workflow` | `["n8n"]` | Workflow automation, webhook, integrazioni, MCP tools |
| @project-checker | `project-checker` | `["cms-setup"]` | Audit progetto: struttura, i18n, SEO, GDPR, TS, a11y, perf |
| @figma-designer | `figma-designer` | `["figma", "frontend-ui-ux"]` | Legge design da URL Figma via MCP, genera spec + TSX per @component-builder |
| @stitch-designer | `stitch-designer` | `["stitch", "frontend-ui-ux"]` | Genera UI da prompt via Google Stitch MCP (alternativa a Figma), converte HTML/CSS → spec Next.js/shadcn per @component-builder |
| @mongodb-analyst | `mongodb-analyst` | `["mongodb", "payload"]` | Query MongoDB diretto per debug dati Payload CMS, analisi collections |
| @docker-manager | `docker-manager` | `["docker", "coolify"]` | Ispeziona container Coolify, log, stats, debug post-deploy via Docker MCP |

### Agenti Marketing (via category — no subagent_type dedicato)

| Agente | `category` | `load_skills` | `output_template` | Quando |
|--------|-----------|---------------|-------------------|--------|
| @growth-architect | `deep` | `["landing-architecture", "product-marketing-context", "launch-strategy"]` | `StrategyBrief.md` | Strategy, funnel design, brief |
| @saas-copywriter | `writing` | `["copywriting", "cro-patterns", "product-marketing-context"]` | `CopyDeck.md` | Copy persuasivo, headline, CTA |
| @cro-designer | `visual-engineering` | `["frontend-ui-ux", "cro-patterns", "ab-testing"]` | `PageSpec.md` | Layout CRO, A/B test design |
| @tech-seo-specialist | `deep` | `["seo-for-devs", "analytics-tracking", "site-architecture"]` | `SEOChecklist.md` | SEO tecnico, GEO, structured data |
| @analytics-specialist | `deep` | `["analytics-tracking", "ab-testing"]` | — | Tracking plan, GA4, conversioni |
| @mobile-specialist | `visual-engineering` | `["frontend-ui-ux", "mobile-first"]` | — | Mobile UX, touch, responsive |

### Agenti Odoo (via category — specializzati Odoo 18)

| Agente | `subagent_type` | `load_skills` | Quando |
|--------|-----------------|---------------|--------|
| @odoo-model-builder | `odoo-model-builder` | `[]` | Creare/modificare modelli Odoo 18, nuovi moduli |
| @odoo-view-creator | `odoo-view-creator` | `[]` | Creare viste (form, tree, kanban) e xpath |
| @odoo-api-builder | `odoo-api-builder` | `[]` | HTTP controllers, REST API, webhook per Odoo |
| @odoo-database-analyst | `odoo-database-analyst` | `[]` | Analisi modelli, query PostgreSQL, debug dati |
| @portal-developer | `portal-developer` | `[]` | Pagine portal/website customer-facing in Odoo |
| @odoo18-migration | `odoo18-migration` | `[]` | Migrazione moduli da v14/15/16/17 → Odoo 18 |
| @odoo-translation-specialist | `odoo-translation-specialist` | `[]` | Traduzione file .po, localizzazione moduli |
| @odoo-user-guide-writer | `odoo-user-guide-writer` | `[]` | Documentazione utente IT/EN per funzionalità Odoo |
| @odoo-store-documenter | `odoo-store-documenter` | `[]` | Docs per pubblicazione su Odoo Apps Store |
| @project-analysis-html-generator | `project-analysis-html-generator` | `[]` | Stime progetto, preventivi HTML professionali |
### Regole di Delegation

1. **Sempre `subagent_type`** se l'agente ce l'ha → invocazione più precisa
2. **Sempre `load_skills`** pertinenti → il subagent è stateless, non sa nulla senza skills
3. **Nel prompt**: specificare quale skill di progetto consultare (es. "segui la skill `tailwind` per lo styling")
4. **Session continuity**: dopo prima delegazione, usare `session_id` per follow-up

---

## Deployment

| | |
|---|---|
| **Piattaforma** | Coolify (self-hosted) |
| **Container** | Docker multi-stage |
| **CI/CD** | GitHub Actions |
| **SSL** | Let's Encrypt (auto) |
| **CMS** | `cms.pixarts.eu` (separato) |

---

## Quality Standards

### Engineering

| Metrica | Target |
|---------|--------|
| Lighthouse Performance | > 90 |
| Lighthouse Accessibility | > 95 |
| Lighthouse SEO | > 95 |
| TypeScript | Strict mode |
| Test Coverage | > 80% |

### Marketing (B2B Tech Benchmarks)

| Metrica | Target |
|---------|--------|
| Landing Page CR | 2.5% - 5% |
| Form Completion Rate | 40% - 60% |
| Bounce Rate | < 50% |
| Time on Page | > 2 min |
| CTA Click Rate | > 5% |
| Email Open Rate | 20% - 25% |
| Email CTR | 2% - 5% |

---

## Environment Variables

Master env: `~/.config/skillbrain/.env` — contiene tutte le API keys condivise tra progetti.

Per ogni progetto:
- `bash ~/.config/skillbrain/hooks/new-project.sh <path>` → genera `.env.local` con secrets + copia dal master
- `bash ~/.config/skillbrain/hooks/env-check.sh <path>` → valida env var obbligatorie

Variabili chiave: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CMS_URL`, `TENANT_SLUG`, `REVALIDATION_SECRET`.

---

## ⛔ REGOLA FERREA: Automation & Quality Gates

### Scripts disponibili (`~/.config/skillbrain/hooks/`)

| Script | Cosa fa | Quando usare |
|--------|---------|--------------|
| `secrets-scan.sh` | Scansiona per token/password/chiavi API nel codice | Prima di ogni commit |
| `env-check.sh <path>` | Valida env var obbligatorie per il progetto | Inizio sessione / prima di build |
| `new-project.sh <path>` | Bootstrap `.env.local` da master + genera secrets | Nuovo progetto |
| `pre-deploy.sh <path>` | Checklist completa: build, lint, test, env, security, bundle | Prima di deploy |
| `dep-audit.sh <path>` | Vulnerabilita, pacchetti outdated, bundle weight | Settimanale / on-demand |
| `commit-msg-check.sh` | Valida formato conventional commits | Ogni commit |

### Regole obbligatorie per Claude

#### Sicurezza
- **Mai hardcodare secrets** — sempre `process.env.VAR_NAME`, mai stringhe letterali per token/password/chiavi
- **Mai committare .env** — solo `.env.template` (senza valori) va nel repo
- **No `any`** — mai `as any`, `@ts-ignore`, `as unknown as X`. Usa type guard o generics
- **Sanitize input** — Zod validation su ogni API boundary (route handler, server action)
- **CSP headers** — ogni progetto in produzione deve avere Content-Security-Policy

#### Qualita Codice
- **Conventional commits** — `type(scope): description` (feat, fix, chore, refactor, perf, test, docs, build, ci)
- **Branch naming** — `feat/slug`, `fix/slug`, `chore/slug`, `refactor/slug`
- **No console.log in prod** — usa `logger` (Pino) per server-side, rimuovi console.log prima di merge
- **Error handling** — mai swallow errors. API routes: try/catch + log + proper HTTP status. Server Actions: try/catch + return error
- **Type-safe env** — usa Zod per validare `process.env` in `env.ts`, non accedere direttamente

#### Performance
- **Bundle budget** — first-load JS < 300KB per route. Se supera, segnala e suggerisci code splitting
- **No barrel imports da librerie heavy** — import diretto: `import { X } from 'lib/X'` non `import { X } from 'lib'`
- **Image optimization** — sempre `next/image` con `sizes` e `priority` su LCP
- **Dependency check** — prima di `pnpm add`, controlla se esiste alternativa leggera:
  - moment → dayjs/date-fns
  - lodash → lodash-es/native
  - axios → native fetch
  - uuid → crypto.randomUUID()
  - chalk → picocolors
  - node-fetch → native fetch (Node 18+)

#### Accessibilita
- **Semantic HTML** — `button` per azioni, `a` per navigazione, `h1-h6` in ordine
- **ARIA labels** — su tutti gli elementi interattivi senza testo visibile
- **Focus management** — tab order logico, focus trap su modali, visible focus ring
- **Color contrast** — WCAG AA minimo (4.5:1 testo, 3:1 large text)

#### Deploy
- **Sempre pre-deploy.sh** — prima di deploy a produzione: `bash ~/.config/skillbrain/hooks/pre-deploy.sh <path>`
- **Health check** — ogni progetto deve avere `/api/health` e `/api/ready`
- **Source maps** — upload a Sentry, non esporre pubblicamente

---

**Versione**: 2.4.0  
**Ultimo aggiornamento**: Aprile 2026  
**Registro completo**: `.Claude/SYSTEM.md`
