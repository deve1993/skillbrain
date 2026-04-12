# JSON/2 API Reference

## Endpoint

```
POST /json/2/<model>/<method>
Authorization: Bearer <api_key>
Content-Type: application/json
```

## Request Body

```json
{
  "ids": [1, 2, 3],          // optional: record IDs to operate on
  "args": [arg1, arg2],      // optional: positional arguments
  "context": {"lang": "it_IT"}, // optional: context override
  "kwarg1": "value1"         // any additional keyword arguments
}
```

## Rules

- `ids` must be a list of integers. If the method is `@api.model`, ids must be empty.
- `args` are positional args passed after `self` (the recordset).
- All other top-level keys are passed as keyword arguments.
- Returns the method's return value as JSON. If the return is a recordset, it's converted to `list[int]` (IDs).

## Error Responses

- `404 Not Found`: model doesn't exist or method is not public
- `422 Unprocessable Entity`: wrong arguments for the method signature
- `401 Unauthorized`: invalid bearer token

## Examples

### search_read
```json
POST /json/2/res.partner/search_read
{
  "domain": [["is_company", "=", true]],
  "fields": ["name", "email"],
  "limit": 5
}
// Returns: [{"id": 1, "name": "...", "email": "..."}, ...]
```

### search_count
```json
POST /json/2/res.partner/search_count
{
  "args": [[["active", "=", true]]]
}
// Returns: 42
```

### create
```json
POST /json/2/res.partner/create
{
  "args": [[{"name": "New Partner", "email": "new@test.com"}]]
}
// Returns: [123]  (new record ID)
```

### write (update)
```json
POST /json/2/res.partner/write
{
  "ids": [123],
  "args": [{"name": "Updated Name"}]
}
// Returns: true
```

### unlink (delete)
```json
POST /json/2/res.partner/unlink
{
  "ids": [123]
}
// Returns: true
```

### fields_get
```json
POST /json/2/res.partner/fields_get
{
  "kwargs": {"attributes": ["string", "type", "required", "relation"]}
}
// Returns: {"name": {"string": "Name", "type": "char", ...}, ...}
```

### name_search
```json
POST /json/2/res.partner/name_search
{
  "name": "Azure",
  "limit": 5
}
// Returns: [[7, "Azure Interior"], [14, "Azure Tech"]]
```

# Doc-Bearer API Reference

## /doc-bearer/index.json

Returns all modules, models, fields and methods.

```json
{
  "modules": ["base", "web", "sale", ...],
  "models": [
    {
      "model": "res.partner",
      "name": "Contact",
      "fields": {"name": {"string": "Name"}, ...},
      "methods": ["search_read", "create", ...]
    }
  ]
}
```

## /doc-bearer/<model>.json

Returns full model detail with method signatures.

```json
{
  "model": "res.partner",
  "name": "Contact",
  "fields": {
    "name": {"string": "Name", "type": "char", "required": true, ...}
  },
  "methods": {
    "search_read": {
      "signature": "(domain=None, fields=None, offset=0, limit=None, order=None)",
      "parameters": {...},
      "return": {"annotation": "list[dict]"},
      "api": ["model"],
      "module": "base"
    }
  }
}
```
