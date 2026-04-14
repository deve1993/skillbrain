---
name: odoo-api-query
description: Query any Odoo 18 instance via REST/JSON APIs with bearer token auth. Implements a discovery-first approach that prevents invalid queries by introspecting models, fields, and methods before executing. Supports /json/2 (modern RPC for any ORM method), /doc-bearer (model/field/method introspection), and /json/1 (read-only views). Use when performing any data operation on Odoo - reading, writing, searching, or exploring the schema. Always run discovery scripts before composing queries.
version: 1.0.0
---

# Odoo 18 API Query Skill

## Golden Rule: DISCOVER → VALIDATE → EXECUTE

**Never compose a query without first knowing the target model's fields and types.**
Every interaction with an unknown Odoo instance follows this mandatory flow:

1. **DISCOVER** — What models exist? What fields/methods does the target model have?
2. **VALIDATE** — Is my domain valid? Do the fields I'm requesting exist? Are types correct?
3. **EXECUTE** — Run the actual query with confidence.

## API Endpoints Available

| Endpoint | Verb | Auth | Use Case |
|----------|------|------|----------|
| `POST /json/2/<model>/<method>` | POST | Bearer | **Primary**. Call any ORM method (CRUD, search, custom) |
| `GET /doc-bearer/index.json` | GET | Bearer | List ALL modules, models, fields, methods |
| `GET /doc-bearer/<model>.json` | GET | Bearer | Full model detail (field types, method signatures) |
| `GET /json/1/<action>` | GET | Bearer | Read-only via Odoo views (limited to view fields) |

**Always prefer `/json/2/` for data operations and `/doc-bearer/` for discovery.**

## Scripts

All scripts are in `scripts/`. They use `odoo_client.py` as shared HTTP client.
Pass `--base-url` and `--api-key` or set `ODOO_BASE_URL` / `ODOO_API_KEY` env vars.

### Discovery Scripts (run FIRST)

```bash
# What modules are installed?
python scripts/list_modules.py

# What models exist? (filterable)
python scripts/list_models.py --filter sale
python scripts/list_models.py --filter partner

# What fields and methods does a model have?
python scripts/inspect_model.py res.partner
python scripts/inspect_model.py res.partner --fields-only
python scripts/inspect_model.py res.partner --method search_read
python scripts/inspect_model.py res.partner --field country_id
```

### Query Scripts

```bash
# Search records
python scripts/search_read.py res.partner \
  --domain '[["is_company","=",true]]' \
  --fields name,email,phone \
  --limit 10

# Count records
python scripts/search_read.py res.partner --domain '[["active","=",true]]' --count-only

# Call any ORM method
python scripts/call_method.py res.partner search_count --args '[[["is_company","=",true]]]'
python scripts/call_method.py res.partner create --args '[[{"name":"Test"}]]'
python scripts/call_method.py res.partner write --ids 123 --args '[{"name":"Updated"}]'
python scripts/call_method.py res.partner unlink --ids 123

# Health check (test all endpoints)
python scripts/health_check.py
```

## Query Composition Rules

### Rule 1: Field Existence Check

Before using a field in domain or fields list, verify it exists via `inspect_model.py`.
Different Odoo instances have different modules installed → different fields available.

**Wrong**: `--domain '[["website","=","www.test.com"]]'` (field `website` may not exist if `website` module isn't installed)
**Right**: First run `inspect_model.py res.partner --field website`, then query.

### Rule 2: Domain Syntax

Domains are lists of triplets `[field, operator, value]` joined by `&` (AND, default) or `|` (OR).

```
# Simple
[["is_company", "=", true]]

# AND (implicit)
[["is_company", "=", true], ["country_id.code", "=", "IT"]]

# OR (prefix notation)
["|", ["email", "ilike", "gmail"], ["email", "ilike", "yahoo"]]

# Combined AND + OR
["|", ["state", "=", "draft"], "&", ["state", "=", "sale"], ["amount_total", ">", 1000]]
```

**Valid operators**: `=`, `!=`, `>`, `>=`, `<`, `<=`, `like`, `ilike`, `not like`, `not ilike`, `in`, `not in`, `=like`, `=ilike`, `child_of`, `parent_of`

### Rule 3: Field Types → Value Types

| Odoo Field Type | Python/JSON Value | Domain Example |
|-----------------|-------------------|----------------|
| `char`, `text`, `html` | `"string"` | `["name", "ilike", "test"]` |
| `integer` | `123` | `["sequence", ">", 5]` |
| `float`, `monetary` | `1.5` | `["amount_total", ">=", 100.0]` |
| `boolean` | `true` / `false` | `["active", "=", true]` |
| `date` | `"2024-01-15"` | `["date_order", ">=", "2024-01-01"]` |
| `datetime` | `"2024-01-15 10:30:00"` | `["create_date", ">=", "2024-01-01 00:00:00"]` |
| `selection` | `"key"` | `["state", "=", "draft"]` — use the key, not the label |
| `many2one` | `int` (ID) | `["partner_id", "=", 42]` |
| `one2many`, `many2many` | `[int]` (list of IDs) | `["tag_ids", "in", [1,2,3]]` |

### Rule 4: Relational Field Navigation

You can traverse relations with dot notation in domains:

```
# Partner's country code
["partner_id.country_id.code", "=", "IT"]

# Product category name
["product_id.categ_id.name", "ilike", "service"]
```

But **you cannot use dot notation in `fields` list** — only in domains.
To get related data, request the Many2one field and you'll get `[id, "display_name"]`.

### Rule 5: search_read Response Format

The `/json/2` endpoint returns raw ORM data:

```json
// Many2one fields → [id, "display_name"]  or false
"partner_id": [42, "Azure Interior"]
"country_id": false

// One2many / Many2many → list of IDs
"order_line": [1, 2, 3]
"tag_ids": [5, 8]

// Selection → string key
"state": "draft"

// Date/Datetime → string or false
"date_order": "2024-01-15 10:30:00"
```

### Rule 6: Selection Field Values

To discover valid values for a selection field, use `fields_get`:

```bash
python scripts/call_method.py sale.order fields_get \
  --kwargs '{"attributes": ["selection"], "allfields": ["state"]}'
```

Or inspect the field: `python scripts/inspect_model.py sale.order --field state`

### Rule 7: Method Signatures

Before calling a non-standard method, check its signature:

```bash
python scripts/inspect_model.py res.partner --method action_archive
```

This reveals required parameters, types, and whether it's `@api.model` (no ids) or recordset (needs ids).

- **`@api.model`** methods: pass `args` only, no `ids`
- **Recordset methods**: pass `ids` list + optional `args`

### Rule 8: Pagination

Always paginate large datasets:

```bash
# Page 1
python scripts/search_read.py res.partner --limit 100 --offset 0
# Page 2
python scripts/search_read.py res.partner --limit 100 --offset 100
```

First get the count, then paginate: `--count-only` returns total.

### Rule 9: Context for Localization

Pass context for language-specific data:

```bash
python scripts/call_method.py res.partner search_read \
  --kwargs '{"domain":[],"fields":["name"],"limit":5}' \
  --context '{"lang":"it_IT"}'
```

### Rule 10: Error Prevention Checklist

Before executing ANY query, verify:

- [ ] Model exists? → `list_models.py --filter <name>`
- [ ] Fields exist on this model? → `inspect_model.py <model> --field <name>`
- [ ] Field type matches value type? → See Rule 3 table
- [ ] Selection values are valid keys? → `fields_get` with selection attribute
- [ ] Method exists and has correct signature? → `inspect_model.py <model> --method <name>`
- [ ] For write/create: required fields included? → `inspect_model.py <model> --fields-only` (check Required column)

## Workflow Examples

### "I want to find all Italian customers"

```bash
# 1. DISCOVER: does res.partner have a country field?
python scripts/inspect_model.py res.partner --field country_id
# → type: many2one, relation: res.country ✓

# 2. DISCOVER: what's the ID for Italy?
python scripts/search_read.py res.country --domain '[["code","=","IT"]]' --fields name,code
# → [{"id": 113, "name": "Italy", "code": "IT"}]

# 3. EXECUTE with validated data
python scripts/search_read.py res.partner \
  --domain '[["country_id","=",113],["is_company","=",true]]' \
  --fields name,email,phone,city
```

### "I want to see all sale orders this month"

```bash
# 1. DISCOVER: is sale.order available?
python scripts/list_models.py --filter sale.order
# → sale.order exists ✓

# 2. DISCOVER: what date field to use?
python scripts/inspect_model.py sale.order --field date_order
# → type: datetime ✓

# 3. DISCOVER: what states exist?
python scripts/call_method.py sale.order fields_get \
  --kwargs '{"attributes":["selection"]}'
# → state: [["draft","Quotation"],["sale","Sales Order"],...]

# 4. EXECUTE
python scripts/search_read.py sale.order \
  --domain '[["date_order",">=","2025-02-01"],["date_order","<","2025-03-01"]]' \
  --fields name,partner_id,state,amount_total \
  --order 'date_order desc'
```

### "I want to explore a model I don't know"

```bash
# 1. Full inspection
python scripts/inspect_model.py crm.lead

# 2. Get a sample of data to understand content
python scripts/search_read.py crm.lead --fields name,stage_id,partner_id,expected_revenue --limit 5

# 3. Deep dive on a specific record
python scripts/call_method.py crm.lead read --ids 42
```

## Reference Files

- `reference/common_models.md` — Quick reference for frequently used models
- `reference/json2_api.md` — Complete /json/2 and /doc-bearer API specification
