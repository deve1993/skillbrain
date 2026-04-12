# System Registry — Pixarts Workflow

Registro dello stato del sistema, versioni skill custom e changelog.
Aggiornare ad ogni `/system-sync` o modifica significativa.

---

## Skill Custom (non tracciate da skills-lock.json)

Queste skill sono scritte internamente e non hanno source GitHub.
Aggiornare la colonna `updated` ad ogni modifica.

| Skill | Path | Versione | Aggiornato | Descrizione |
|-------|------|----------|------------|-------------|
| `gitnexus` | `skills/gitnexus/SKILL.md` | 1.0.0 | 2026-04 | Code intelligence via knowledge graph GitNexus |
| `pixarts/workflow` | `.Claude/skill/pixarts/workflow/` | — | — | Workflow completo cliente Pixarts |
| `pixarts/multitenancy` | `.Claude/skill/pixarts/multitenancy/` | — | — | Multi-tenancy Payload CMS |
| `pixarts/client-site` | `.Claude/skill/pixarts/client-site/` | — | — | Stack client site standard |
| `pixarts/cms-modules` | `.Claude/skill/pixarts/cms-modules/` | — | — | Moduli CMS funzionali |
| `pixarts/design-system` | `.Claude/skill/pixarts/design-system/` | — | — | Design system e token |
| `pixarts/template-architecture` | `.Claude/skill/pixarts/template-architecture/` | — | — | Architettura template Next.js |
| `odoo-crm-lead` | `.Claude/skill/odoo-crm-lead/` | — | — | Form → Odoo CRM via Server Action |
| `odoo-api-query` | `.Claude/skill/odoo-api-query/` | — | — | Query REST Odoo 18 |

---

## Skill Esterne (tracciate da skills-lock.json)

| Skill | Source | Ultima verifica |
|-------|--------|-----------------|
| `brainstorming` | obra/superpowers | — |
| `dispatching-parallel-agents` | obra/superpowers | — |
| `executing-plans` | obra/superpowers | — |
| `finishing-a-development-branch` | obra/superpowers | — |
| `frontend-design` | anthropics/skills | — |
| `next-best-practices` | vercel-labs/next-skills | — |
| `receiving-code-review` | obra/superpowers | — |
| `requesting-code-review` | obra/superpowers | — |
| `subagent-driven-development` | obra/superpowers | — |
| `systematic-debugging` | obra/superpowers | — |
| `test-driven-development` | obra/superpowers | — |
| `ui-ux-pro-max` | nextlevelbuilder/ui-ux-pro-max-skill | — |
| `using-git-worktrees` | obra/superpowers | — |
| `using-superpowers` | obra/superpowers | — |
| `vercel-react-best-practices` | vercel-labs/agent-skills | — |
| `verification-before-completion` | obra/superpowers | — |
| `web-design-guidelines` | vercel-labs/agent-skills | — |
| `writing-plans` | obra/superpowers | — |
| `writing-skills` | obra/superpowers | — |
| `audit-website` | squirrelscan/skills | — |

---

## MCP Attivi

| MCP | Tipo | Stato | Note |
|-----|------|-------|------|
| `pencil` (Antigravity) | global | ✅ attivo | Modelli Google/Anthropic extra |
| `gitnexus` | global | ✅ attivo | Knowledge graph 4 repo |
| `shadcn` | locale | ✅ attivo | Component registry |
| `playwright` | locale | ✅ attivo | Browser automation |
| `github` | locale | ✅ attivo | GitHub API |
| `memory` | locale | ✅ attivo | Persistenza sessioni |
| `fetch` | locale | ✅ attivo | Web fetch |
| `stocky` | locale | ✅ attivo | Unsplash immagini |
| `n8n-mcp` | locale | ✅ attivo | n8n workflow |
| `design-copier` | locale | ✅ attivo | Clone design |
| `firecrawl` | locale | ✅ attivo | Web scraping |
| `figma` | locale | ✅ attivo | Figma MCP |
| `mongodb` | locale | ✅ attivo | MongoDB diretto |
| `docker` | locale | ✅ attivo | Container management |
| `stitch` | locale | ✅ attivo | Google Stitch UI gen |

---

## GitNexus — Repo Indicizzate

| Repo | Simboli | Commit | Hook | Aggiornato |
|------|---------|--------|------|------------|
| `Quickfy-website` | 711 | b63244d | ✅ post-commit | 2026-04 |
| `pixarts-landing` | 669 | f546e3b | ✅ post-commit | 2026-04 |
| `WEB_DVEsolutions` | 236 | 0f08151 | ✅ post-commit | 2026-04 |
| `Web-site` | 382 | c107624 | ✅ post-commit | 2026-04 |

---

## Changelog Sistema

### v2.3.0 — 2026-04
- **Aggiunto** GitNexus MCP (knowledge graph codebase)
- **Aggiunto** git hook post-commit per auto-reindex su 4 repo
- **Aggiunto** protocollo Memory MCP in AGENTS.md
- **Aggiunto** comando `/system-sync` per audit e allineamento
- **Aggiunto** sezione `⛔ REGOLA FERREA: Code Intelligence` in AGENTS.md
- **Aggiunto** task type `REFACTOR` e `CODICE` nel classificatore intake
- **Aggiornato** delegation map: `@builder`, `@code-reviewer`, `@test-engineer`, `@performance-engineer`, `@security-auditor` ora caricano skill `gitnexus`
- **Aggiornato** `.gitignore`: aggiunte 29 directory tool AI + `.gitnexus/`
- **Aggiunta** skill custom `gitnexus` in `skills/gitnexus/SKILL.md`

### v2.2.0 — 2026-03
- Versione precedente (baseline)

---

## Agenti — Mappa Modelli

| Agente | Modello in opencode.json | Modello in oh-my-openagent.json |
|--------|-------------------------|--------------------------------|
| orchestrator | claude-opus-4-6 | — (non presente) |
| planner | claude-opus-4-6 | — (non presente) |
| builder | claude-sonnet-4-6 | — (non presente) |
| sisyphus | — | claude-sonnet-4-6 (max) |
| oracle | — | claude-opus-4-6 (max) |
| librarian | — | claude-sonnet-4-6 |
| explore | — | claude-haiku-4-5 |
| prometheus | — | claude-opus-4-6 (max) |
| metis | — | claude-opus-4-6 (max) |
| momus | — | claude-opus-4-6 (max) |
| atlas | — | claude-sonnet-4-6 |

> Nota: `opencode.json` (locale) e `oh-my-openagent.json` (globale) sono sistemi paralleli.
> opencode.json definisce agenti con prompt file.
> oh-my-openagent.json definisce modelli per agenti oh-my-opencode.
> Non si sovrascrivono — si integrano.
