# Simple Mode Guide

## Modalità Semplificata

Per ridurre la complessità del sistema multi-agente, puoi interagire principalmente con due "super-agenti":

### @planner (The Architect)

**Cosa fa**: Pensa, pianifica, analizza, definisce strategia.

**Quando usare**:
- "Crea un piano per..."
- "Analizza questo sito..."
- "Definisci la strategia per..."
- "Che approccio consigli per..."

**Agenti che coordina internamente**:
- @ux-designer (user flows, wireframes)
- @growth-architect (strategy, funnel)
- @cro-designer (conversion optimization)
- @tech-seo-specialist (SEO strategy)

**Esempi concreti:**

```
@planner Crea un piano per il sito di un dentista a Milano.
  → Analizza settore, propone struttura pagine, definisce copy strategy.

@planner Analizza il sito competitor https://example.com e dimmi
  cosa fanno bene e cosa potremmo migliorare.

@planner Strategia SEO per posizionarsi su 'avvocato divorzista Milano'.
  → Ricerca keyword, piano contenuti, struttura URL.
```

---

### @builder (The Maker)

**Cosa fa**: Costruisce, scrive codice, fissa bug, deploya.

**Quando usare**:
- "Implementa..."
- "Costruisci..."
- "Correggi..."
- "Deploya..."
- "Aggiungi..."

**Agenti che coordina internamente**:
- @component-builder (UI components)
- @api-developer (backend, API)
- @i18n-engineer (translations)
- @site-builder (full page implementation)
- @devops-engineer (deployment)

**Esempi concreti:**

```
@builder Implementa la pagina Chi Siamo per il progetto ristorante-da-mario.
  → Crea il file, componenti hero + team + CTA, traduce IT/EN/CZ.

@builder Correggi l'errore TypeScript in Progetti/studio-legale-rossi/src/...
  → Legge l'errore, applica il fix minimale, verifica build.

@builder Aggiungi un form di contatto con invio a Odoo CRM.
  → Chiede endpoint, implementa OdooLeadForm, configura Server Action.
```

---

## Quando Usare la Modalità Completa

Se hai bisogno di più controllo, puoi invocare direttamente qualsiasi agente specializzato o usare i comandi:

- `/frontend` — Workflow completo design → dev → deploy
- `/marketing` — Strategy + copy + CRO + SEO
- `/new-client "Nome"` — Workflow nuovo cliente (intake → CMS → scaffold → deploy → QA)
- `/update-project "Nome"` — Aggiorna progetto esistente (deps, automation, check)
- `/audit` — Security + Performance + SEO audit
- `/video` — Video con Remotion
- `/cms-setup` — Configurazione CMS

## Tips

1. **Input ricco = meno domande** — Più dettagli dai, prima si parte
2. **Usa i comandi per task specifici** — Sono workflow pre-configurati
3. **Per fix veloci** — Descrivi il problema direttamente, verrà risolto senza brief
4. **Per nuovi siti** — Usa `/new-client` per il workflow completo
5. **@planner prima, @builder dopo** — Prima pianifica, poi costruisce
