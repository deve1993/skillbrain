#!/usr/bin/env python3
"""List all installed modules on the Odoo instance."""
from odoo_client import get_base_parser, api_get, pp

parser = get_base_parser("List installed Odoo modules")
args = parser.parse_args()

data = api_get(args.base_url, "doc-bearer/index.json", args.api_key)
modules = data.get("modules", [])

print(f"=== {len(modules)} installed modules ===")
for i, mod in enumerate(modules, 1):
    print(f"  {i:3d}. {mod}")
