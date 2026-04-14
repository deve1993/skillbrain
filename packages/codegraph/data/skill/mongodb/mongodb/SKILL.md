---
name: mongodb
description: MongoDB MCP - query dirette a Payload CMS collections, debug dati, analisi tenant, aggregazioni
---

# MongoDB MCP Skill

## MCP Server

`mongodb-mcp-server` (ufficiale MongoDB) — Accesso diretto al database MongoDB di Payload CMS via MCP.

## Configurazione

```
ENV: MDB_MCP_CONNECTION_STRING = mongodb+srv://user:pass@cluster.mongodb.net/dbname
```

Il connection string è lo stesso usato in `MONGODB_URI` di Payload CMS.

## Collections Standard Payload CMS

| Collection Payload | MongoDB Collection | Tenant-scoped |
|-------------------|-------------------|---------------|
| Tenants | `tenants` | No (admin only) |
| Users | `users` | Sì |
| Pages | `pages` | Sì |
| Posts | `posts` | Sì |
| Media | `media` | Sì |
| Categories | `categories` | Sì |
| Preferences | `payload-preferences` | No |
| Migrations | `payload-migrations` | No |
| Versions (drafts) | `_pages_versions`, `_posts_versions` | Sì |

## Tool MCP Disponibili

### list-databases
Lista tutti i database nel cluster.

### list-collections
```
list-collections(database: "pixarts-cms")
```

### find — Query documenti
```
find(
  collection: "pages",
  database: "pixarts-cms",
  filter: { "tenant": { "$oid": "6507..." }, "status": "published" },
  limit: 10,
  projection: { "title": 1, "slug": 1, "status": 1, "updatedAt": 1 }
)
```

> **Nota**: Gli ObjectId in Payload si scrivono come `{ "$oid": "..." }` nelle query MCP.

### aggregate — Pipeline avanzate
```
aggregate(
  collection: "pages",
  database: "pixarts-cms",
  pipeline: [
    { "$match": { "status": "published" } },
    { "$group": { "_id": "$tenant", "count": { "$sum": 1 } } },
    { "$sort": { "count": -1 } }
  ]
)
```

### count — Conta documenti
```
count(
  collection: "pages",
  database: "pixarts-cms",
  filter: { "status": "draft" }
)
```

### create-index — Crea indice (solo dev/staging)
```
create-index(
  collection: "pages",
  database: "pixarts-cms",
  keys: { "tenant": 1, "slug": 1 },
  options: { "unique": true }
)
```

## Query Patterns Comuni

### Trovare tenant per slug
```json
{
  "collection": "tenants",
  "filter": { "slug": "nome-cliente" }
}
```

### Tutte le pagine pubblicate di un tenant
```json
{
  "collection": "pages",
  "filter": {
    "tenant": { "$oid": "ID_TENANT" },
    "status": "published"
  },
  "projection": { "title": 1, "slug": 1, "updatedAt": 1 }
}
```

### Utenti di un tenant con ruoli
```json
{
  "collection": "users",
  "filter": { "tenant": { "$oid": "ID_TENANT" } },
  "projection": { "email": 1, "roles": 1, "loginAttempts": 1, "lockUntil": 1 }
}
```

### Media non utilizzati (orfani)
```json
{
  "collection": "media",
  "pipeline": [
    { "$lookup": {
      "from": "pages",
      "localField": "_id",
      "foreignField": "featuredImage",
      "as": "usedInPages"
    }},
    { "$match": { "usedInPages": { "$size": 0 } } },
    { "$project": { "filename": 1, "filesize": 1, "createdAt": 1 } }
  ]
}
```

### Stats per tenant (pagine pubblicate vs bozze)
```json
{
  "collection": "pages",
  "pipeline": [
    { "$group": {
      "_id": { "tenant": "$tenant", "status": "$status" },
      "count": { "$sum": 1 }
    }},
    { "$sort": { "_id.tenant": 1 } }
  ]
}
```

### Trovare draft non pubblicati da più di X giorni
```json
{
  "collection": "pages",
  "filter": {
    "status": "draft",
    "updatedAt": { "$lt": { "$date": "2026-01-01T00:00:00Z" } }
  },
  "projection": { "title": 1, "tenant": 1, "updatedAt": 1 }
}
```

## Debug Scenari Comuni

### "La pagina non appare sul frontend"
```
1. find(collection: "pages", filter: { "slug": "nome-pagina" })
   → Controlla: status = "published"? tenant corretto? slug esiste?

2. Se draft: verifica che Payload non stia servendo la versione draft
   → Guarda _pages_versions per il documento corrispondente

3. Se slug duplicato: cerca slug con filter multi-tenant
   → Verifica unicità per tenant
```

### "Utente non riesce ad accedere / account bloccato"
```
1. find(collection: "users", filter: { "email": "user@example.com" })
   → Controlla: loginAttempts, lockUntil, _verified, roles, tenant

2. Se lockUntil è nel futuro → account bloccato da troppi tentativi
   → update-one per resettare loginAttempts e lockUntil (solo se autorizzato)
```

### "Media non si carica"
```
1. find(collection: "media", filter: { "filename": "nome-file.jpg" })
   → Controlla: url, filesize, mimeType, tenant

2. Verifica che il file esista fisicamente sul server (via devops)
```

### "CMS lento su una collection"
```
1. Usa aggregate con $indexStats per verificare indici usati
2. Controlla con list-indexes gli indici esistenti
3. Se mancano indici su campi filtrati frequentemente → crea con create-index
```

## Struttura Documento Payload

Ogni documento Payload ha questi campi standard:

```json
{
  "_id": { "$oid": "..." },
  "tenant": { "$oid": "..." },       // solo se tenant-scoped
  "status": "published|draft",
  "createdAt": { "$date": "..." },
  "updatedAt": { "$date": "..." },
  "_status": "published|draft",      // campo interno Payload per versioning
  "__v": 0                           // MongoDB versioning
}
```

## Best Practices

1. **Read-first sempre** — Usa `find`/`aggregate` per analisi; `insert-one`/`update-one` solo se esplicitamente richiesto
2. **Mai modificare prod senza backup** — Ambiente prod: solo lettura salvo emergenze
3. **ObjectId syntax** — In query MCP usa `{ "$oid": "..." }` non stringhe plain
4. **Tenant isolation** — Filtra SEMPRE per `tenant` in collection tenant-scoped
5. **Versioning** — Non modificare `_pages_versions` direttamente — Payload gestisce i draft
6. **Projection** — Usa sempre `projection` per limitare i campi e ridurre il payload
7. **Limit** — Su collection grandi usa sempre `limit` (default suggerito: 20-50)

## Integrazione con Agenti

| Agente | Quando usa MongoDB MCP |
|--------|------------------------|
| @mongodb-analyst | Analisi dati, debug, query su richiesta |
| @payload-cms | Debug specifico Payload (access control, hooks) |
| @site-qa | Verifica dati inseriti durante QA |
| @devops-engineer | Monitor dimensioni collection, indici mancanti |
