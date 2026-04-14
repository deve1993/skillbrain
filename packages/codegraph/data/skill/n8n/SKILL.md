---
name: n8n
description: n8n workflow automation - nodi, connessioni, MCP server, API REST, pattern di automazione. Use when building n8n workflows, creating automations, configuring webhooks, or integrating external services via n8n.
version: 1.0.0
---

# n8n Workflow Automation Knowledge Base

## Architettura

n8n e' una piattaforma di workflow automation self-hosted. Ogni workflow e' composto da:
- **Trigger**: Nodo iniziale che avvia il workflow (webhook, schedule, MCP, evento)
- **Nodi**: Azioni sequenziali o parallele (HTTP request, codice, integrazione)
- **Connessioni**: Collegamento tra nodi (main output -> input)
- **Impostazioni**: Timeout, retry, error handling, variabili

### Istanza Pixarts

| | |
|---|---|
| **URL** | `https://n8n-auto.fl1.it` |
| **MCP Server** | `https://n8n-auto.fl1.it/mcp-server/http` |
| **Transport** | Streamable HTTP via supergateway |
| **Auth** | Bearer JWT Token |

## MCP Server Built-in (n8n-auto.fl1.it)

Il MCP server built-in di n8n espone **3 tool** per AI agent:

### Tool Disponibili (verificati)

| Tool | Tipo | Descrizione |
|------|------|-------------|
| `search_workflows` | Read-only | Cerca workflow con filtri (query, limit, projectId) |
| `get_workflow_details` | Read-only | Dettagli completi: nodi, connessioni, trigger info, tags |
| `execute_workflow` | Esecuzione | Esegui workflow per ID con input (chat/form/webhook) |

### execute_workflow - Input Types

```json
// Chat input
{ "type": "chat", "chatInput": "messaggio" }

// Form input
{ "type": "form", "formData": { "campo1": "valore1" } }

// Webhook input
{ "type": "webhook", "webhookData": { "method": "POST", "body": {...}, "headers": {...} } }
```

### Limitazioni Built-in
Il server built-in NON supporta creazione/modifica/eliminazione workflow.
Per CRUD completo serve la REST API n8n (`/api/v1/workflows`) o un MCP builder third-party.

### Come aggiungere tool MCP custom
1. Crea un workflow con nodo **MCP Server Trigger** come trigger
2. Collega i nodi **Tool** al trigger
3. Attiva il workflow
4. Il workflow diventa un **tool MCP** disponibile per gli agent

### Configurazione Client MCP

```json
{
  "mcpServers": {
    "n8n-mcp": {
      "command": "npx",
      "args": [
        "-y", "supergateway",
        "--streamableHttp", "https://n8n-auto.fl1.it/mcp-server/http",
        "--header", "authorization:Bearer <TOKEN>"
      ]
    }
  }
}
```

## Struttura Workflow JSON

```json
{
  "name": "Nome Workflow",
  "nodes": [
    {
      "id": "trigger-1",
      "name": "Webhook Trigger",
      "type": "n8n-nodes-base.webhook",
      "position": [250, 300],
      "parameters": {
        "path": "my-webhook",
        "httpMethod": "POST",
        "responseMode": "onReceived"
      }
    },
    {
      "id": "action-1",
      "name": "Process Data",
      "type": "n8n-nodes-base.code",
      "position": [450, 300],
      "parameters": {
        "jsCode": "return items.map(item => ({ json: { processed: true, ...item.json } }));"
      }
    }
  ],
  "connections": {
    "Webhook Trigger": {
      "main": [[{ "node": "Process Data", "type": "main", "index": 0 }]]
    }
  },
  "settings": {
    "saveExecutionProgress": true,
    "saveManualExecutions": true,
    "executionTimeout": 3600
  }
}
```

## Nodi Principali

### Trigger Nodes

| Nodo | Tipo | Uso |
|------|------|-----|
| `n8n-nodes-base.webhook` | Trigger | Riceve HTTP requests |
| `n8n-nodes-base.scheduleTrigger` | Trigger | Cron/interval schedule |
| `n8n-nodes-base.manualTrigger` | Trigger | Esecuzione manuale |
| `n8n-nodes-langchain.mcpTrigger` | Trigger | MCP Server endpoint |
| `n8n-nodes-base.emailTrigger` | Trigger | Ricezione email IMAP |

### Action Nodes

| Nodo | Tipo | Uso |
|------|------|-----|
| `n8n-nodes-base.httpRequest` | Action | Chiamate HTTP/REST API |
| `n8n-nodes-base.code` | Action | JavaScript/Python custom |
| `n8n-nodes-base.set` | Action | Imposta/trasforma dati |
| `n8n-nodes-base.if` | Action | Condizione if/else |
| `n8n-nodes-base.switch` | Action | Switch multi-branch |
| `n8n-nodes-base.merge` | Action | Unisci dati da piu branch |
| `n8n-nodes-base.splitInBatches` | Action | Processa in batch |
| `n8n-nodes-base.wait` | Action | Pausa/delay |
| `n8n-nodes-base.noOp` | Action | No operation (placeholder) |

### Integration Nodes

| Nodo | Uso |
|------|-----|
| `n8n-nodes-base.slack` | Messaggi Slack |
| `n8n-nodes-base.telegram` | Bot Telegram |
| `n8n-nodes-base.gmail` | Invio email Gmail |
| `n8n-nodes-base.googleSheets` | Lettura/scrittura Google Sheets |
| `n8n-nodes-base.mongodb` | Query MongoDB |
| `n8n-nodes-base.postgres` | Query PostgreSQL |
| `n8n-nodes-base.discord` | Messaggi Discord |
| `n8n-nodes-base.airtable` | CRUD Airtable |
| `n8n-nodes-base.notion` | CRUD Notion |
| `n8n-nodes-base.stripe` | Pagamenti Stripe |

### AI Nodes

| Nodo | Uso |
|------|-----|
| `@n8n/n8n-nodes-langchain.agent` | AI Agent con tools |
| `@n8n/n8n-nodes-langchain.chainLlm` | LLM Chain |
| `@n8n/n8n-nodes-langchain.toolMcp` | MCP Client Tool |
| `@n8n/n8n-nodes-langchain.mcpTrigger` | MCP Server Trigger |

## Pattern di Automazione

### 1. Webhook -> Processo -> Notifica

```
Webhook Trigger -> Code (process) -> IF (condition)
                                      |-> Slack (notify success)
                                      |-> Email (notify error)
```

### 2. Schedule -> Fetch -> Store

```
Schedule Trigger -> HTTP Request (fetch API) -> MongoDB (store data) -> Slack (report)
```

### 3. CMS Revalidation (Payload CMS)

```
Webhook Trigger (/revalidate)
  -> Code (extract path from payload)
  -> HTTP Request (GET site.com/api/revalidate?path=X&secret=Y)
  -> Slack (notify: "Page X revalidated")
```

### 4. Deploy Notification

```
Webhook Trigger (/deploy)
  -> HTTP Request (trigger Coolify deploy)
  -> Wait (30s)
  -> HTTP Request (health check)
  -> IF (status == 200)
    |-> Slack ("Deploy OK")
    |-> Slack ("Deploy FAILED") + Email alert
```

### 5. Lead Capture (Form -> CRM -> Email)

```
Webhook Trigger (/lead)
  -> Code (validate + sanitize)
  -> HTTP Request (POST to CRM/Airtable)
  -> Email (send confirmation to lead)
  -> Slack (notify sales team)
```

### 6. Content Pipeline (CMS -> Social)

```
Schedule Trigger (daily)
  -> HTTP Request (fetch new posts from Payload CMS)
  -> IF (new posts exist)
    -> Code (format for social)
    -> Telegram (post to channel)
    -> Slack (notify team)
```

### 7. Monitoring & Alerts

```
Schedule Trigger (every 5 min)
  -> HTTP Request (health check site1.com)
  -> HTTP Request (health check site2.com)
  -> IF (any failed)
    -> Telegram (ALERT: site down)
    -> Email (alert to admin)
```

### 8. MCP Tool Workflow

```
MCP Server Trigger
  -> Tool: list_workflows (n8n API)
  -> Tool: execute_workflow (run specific workflow)
  -> Tool: create_workflow (build new workflow)
```

## API REST n8n

### Endpoints Principali

| Method | Endpoint | Descrizione |
|--------|----------|-------------|
| `GET` | `/api/v1/workflows` | Lista workflow |
| `POST` | `/api/v1/workflows` | Crea workflow |
| `GET` | `/api/v1/workflows/{id}` | Dettaglio workflow |
| `PUT` | `/api/v1/workflows/{id}` | Aggiorna workflow |
| `DELETE` | `/api/v1/workflows/{id}` | Elimina workflow |
| `POST` | `/api/v1/workflows/{id}/activate` | Attiva workflow |
| `POST` | `/api/v1/workflows/{id}/deactivate` | Disattiva workflow |
| `GET` | `/api/v1/executions` | Lista esecuzioni |
| `GET` | `/api/v1/executions/{id}` | Dettaglio esecuzione |
| `DELETE` | `/api/v1/executions/{id}` | Elimina esecuzione |

## Espressioni e Data Access

```javascript
// Input data
$input.item          // Item corrente
$input.all()         // Tutti gli item
$json                // Shorthand per $input.item.json

// Dati da altri nodi
$('Node Name').item              // Item dal nodo
$('Node Name').first()           // Primo item
$('Node Name').all()             // Tutti gli item

// Metadata
$workflow.id              // Workflow ID
$workflow.name            // Nome workflow
$execution.id             // ID esecuzione
$execution.mode           // 'manual' | 'trigger' | 'webhook'

// Variabili
$env.VARIABLE_NAME        // Environment variable
$vars.variableName        // Workflow variable

// Date (Luxon)
$now                      // DateTime corrente
$today                    // Inizio di oggi
DateTime.now().toFormat('yyyy-MM-dd')

// AI Expression (per MCP tools)
$fromAI('paramName', 'description', 'string')
```

## Connessioni tra Nodi

```json
{
  "connections": {
    "Source Node Name": {
      "main": [
        [
          {
            "node": "Target Node Name",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

Per nodi con output multipli (IF, Switch):
```json
{
  "IF Node": {
    "main": [
      [{ "node": "True Branch", "type": "main", "index": 0 }],
      [{ "node": "False Branch", "type": "main", "index": 0 }]
    ]
  }
}
```

## Best Practices

1. **Naming**: Nomi descrittivi per nodi (non "Code1", "HTTP Request2")
2. **Error Handling**: Usa error workflow + try/catch nei Code node
3. **Credentials**: Mai hardcodare API keys, usa n8n Credentials
4. **Timeout**: Imposta executionTimeout per evitare workflow bloccati
5. **Retry**: Configura retry on fail per nodi HTTP
6. **Logging**: Usa Code node per log strutturati
7. **Testing**: Testa sempre in modalita manuale prima di attivare
8. **Modularita**: Workflow piccoli e composibili > un workflow gigante
9. **Variables**: Usa $vars per valori condivisi tra nodi
10. **Batch**: splitInBatches per processare grandi dataset
