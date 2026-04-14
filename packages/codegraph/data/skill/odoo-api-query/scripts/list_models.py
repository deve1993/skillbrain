#!/usr/bin/env python3
"""List all available models with field/method counts."""
import argparse
from odoo_client import get_base_parser, api_get

parser = get_base_parser("List available Odoo models")
parser.add_argument("--filter", "-f", default="", help="Filter models by name substring")
parser.add_argument("--verbose", "-v", action="store_true", help="Show methods list")
args = parser.parse_args()

data = api_get(args.base_url, "doc-bearer/index.json", args.api_key)
models = data.get("models", [])

if args.filter:
    models = [m for m in models if args.filter.lower() in m["model"].lower() or args.filter.lower() in m["name"].lower()]

models.sort(key=lambda m: m["model"])
print(f"=== {len(models)} models {'(filtered)' if args.filter else ''} ===")
print(f"{'Model':<45} {'Name':<35} {'Fields':>6} {'Methods':>7}")
print("-" * 100)

for m in models:
    fields_count = len(m.get("fields", {}))
    methods_count = len(m.get("methods", []))
    print(f"{m['model']:<45} {m['name']:<35} {fields_count:>6} {methods_count:>7}")
    if args.verbose and m.get("methods"):
        for method in sorted(m["methods"]):
            print(f"    • {method}")
