#!/usr/bin/env python3
"""Quick health check: test API connectivity and permissions."""
from odoo_client import get_base_parser, api_get, api_post
import json

parser = get_base_parser("Test Odoo API connectivity")
args = parser.parse_args()

print(f"Testing {args.base_url}...\n")

# Test 1: doc-bearer index
print("1. GET /doc-bearer/index.json ... ", end="", flush=True)
try:
    data = api_get(args.base_url, "doc-bearer/index.json", args.api_key)
    modules = data.get("modules", [])
    models = data.get("models", [])
    print(f"OK — {len(modules)} modules, {len(models)} models")
except SystemExit:
    print("FAIL")

# Test 2: json/2 RPC
print("2. POST /json/2/res.partner/search_count ... ", end="", flush=True)
try:
    result = api_post(args.base_url, "json/2/res.partner/search_count", args.api_key, {
        "args": [[]],
    })
    print(f"OK — {result} partners")
except SystemExit:
    print("FAIL")

# Test 3: json/2 search_read
print("3. POST /json/2/res.partner/search_read ... ", end="", flush=True)
try:
    result = api_post(args.base_url, "json/2/res.partner/search_read", args.api_key, {
        "domain": [],
        "fields": ["name", "email"],
        "limit": 1,
    })
    if isinstance(result, list) and len(result) > 0:
        print(f"OK — first: {result[0].get('name', '?')}")
    else:
        print(f"OK — {result}")
except SystemExit:
    print("FAIL")

# Test 4: json/1 (native read-only)
print("4. GET /json/1/contacts?limit=1 ... ", end="", flush=True)
try:
    data = api_get(args.base_url, "json/1/contacts?view_type=list&limit=1", args.api_key)
    print(f"OK — {data.get('length', '?')} total contacts")
except SystemExit:
    print("FAIL (may need web.json.enabled=True)")

print("\nDone.")
