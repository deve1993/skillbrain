# /n8n Command

Crea e gestisce workflow n8n: automazioni, webhook, integrazioni, trigger.

## Trigger

```
/n8n <descrizione workflow>
/n8n lista              # Lista workflows esistenti
/n8n edit <nome>        # Modifica workflow esistente
```

**Esempi:**
```
/n8n invia email di benvenuto quando un utente si registra su Payload CMS
/n8n notifica Slack quando arriva un lead dal form contatti
/n8n sincronizza i form submissions con Odoo CRM ogni ora
/n8n backup automatico database MongoDB ogni notte
```

## Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                      /n8n WORKFLOW                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. ANALISI RICHIESTA                                        │
│       → Identifica trigger (webhook, schedule, event)        │
│       → Identifica azioni (email, API, DB, notifica)         │
│       → Identifica integrazioni necessarie                   │
│       ▼                                                      │
│  2. DESIGN                                                   │
│       @n8n-workflow                                          │
│       → Struttura workflow JSON                              │
│       → Nodi e connessioni                                   │
│       → Error handling                                       │
│       ▼                                                      │
│  3. DEPLOY                                                   │
│       → Import su n8n-auto.fl1.it via API                    │
│       → Test workflow                                        │
│       → Attivazione                                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Istanza n8n

- **URL**: `https://n8n-auto.fl1.it`
- **MCP**: `n8n-mcp` (configurato in opencode.json)
- **API**: disponibile via MCP tools

## Skills Caricate

- `n8n` — Pattern n8n, nodi, best practices
