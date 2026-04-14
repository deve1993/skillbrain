#!/usr/bin/env python3
"""Inspect a specific model: fields, methods, and their signatures."""
import json
from odoo_client import get_base_parser, api_get

parser = get_base_parser("Inspect an Odoo model in detail")
parser.add_argument("model", help="Model technical name (e.g. res.partner)")
parser.add_argument("--fields-only", action="store_true", help="Show only fields")
parser.add_argument("--methods-only", action="store_true", help="Show only methods")
parser.add_argument("--method", "-m", help="Show detail for a specific method")
parser.add_argument("--field", "-f", help="Show detail for a specific field")
args = parser.parse_args()

data = api_get(args.base_url, f"doc-bearer/{args.model}.json", args.api_key)

print(f"=== {data['model']} — {data['name']} ===\n")

# Specific method detail
if args.method:
    methods = data.get("methods", {})
    if args.method in methods:
        m = methods[args.method]
        print(f"  {args.method}{m.get('signature', '()')}")
        if m.get("api"):
            print(f"    @api: {', '.join(m['api'])}")
        if m.get("doc"):
            print(f"    Doc: {m['doc'][:200]}")
        if m.get("parameters"):
            print("    Parameters:")
            for pname, pinfo in m["parameters"].items():
                default = f" = {pinfo['default']}" if "default" in pinfo else ""
                annotation = f": {pinfo['annotation']}" if "annotation" in pinfo else ""
                print(f"      {pname}{annotation}{default}")
        if m.get("return"):
            r = m["return"]
            ann = r.get("annotation", "")
            print(f"    Returns: {ann}")
    else:
        print(f"  Method '{args.method}' not found. Available: {', '.join(sorted(methods.keys())[:20])}...")
    exit()

# Specific field detail
if args.field:
    fields = data.get("fields", {})
    if args.field in fields:
        print(json.dumps(fields[args.field], indent=2, ensure_ascii=False))
    else:
        print(f"  Field '{args.field}' not found. Available: {', '.join(sorted(fields.keys())[:20])}...")
    exit()

# Fields summary
if not args.methods_only:
    fields = data.get("fields", {})
    print(f"--- Fields ({len(fields)}) ---")
    print(f"{'Name':<30} {'Type':<15} {'String':<30} {'Required':>8}")
    print("-" * 90)
    for fname, finfo in sorted(fields.items()):
        ftype = finfo.get("type", "?")
        fstring = finfo.get("string", "")
        freq = "Yes" if finfo.get("required") else ""
        relation = f" → {finfo['relation']}" if finfo.get("relation") else ""
        print(f"{fname:<30} {ftype:<15} {fstring:<30} {freq:>8}{relation}")
    print()

# Methods summary
if not args.fields_only:
    methods = data.get("methods", {})
    print(f"--- Methods ({len(methods)}) ---")
    for mname in sorted(methods.keys()):
        m = methods[mname]
        sig = m.get("signature", "()")
        api_tags = f" [@{'|'.join(m['api'])}]" if m.get("api") else ""
        module = m.get("module", "")
        print(f"  {mname}{sig}{api_tags}  [{module}]")
