#!/usr/bin/env python3
"""Search and read records from any Odoo model via /json/2."""
import json
from odoo_client import get_base_parser, api_post, pp

parser = get_base_parser("Search and read Odoo records")
parser.add_argument("model", help="Model name (e.g. res.partner)")
parser.add_argument("--domain", "-d", default="[]", help='Domain filter as JSON (e.g. \'[["is_company","=",true]]\')')
parser.add_argument("--fields", "-f", default="", help="Comma-separated field names")
parser.add_argument("--limit", "-l", type=int, default=10, help="Max records (default: 10)")
parser.add_argument("--offset", "-o", type=int, default=0, help="Offset for pagination")
parser.add_argument("--order", default="", help='Sort order (e.g. "name asc")')
parser.add_argument("--count-only", action="store_true", help="Only return count")
args = parser.parse_args()

domain = json.loads(args.domain)
fields = [f.strip() for f in args.fields.split(",") if f.strip()] if args.fields else []

if args.count_only:
    result = api_post(args.base_url, f"json/2/{args.model}/search_count", args.api_key, {
        "args": [domain],
    })
    print(f"Count: {result}")
else:
    kwargs = {
        "domain": domain,
        "limit": args.limit,
        "offset": args.offset,
    }
    if fields:
        kwargs["fields"] = fields
    if args.order:
        kwargs["order"] = args.order

    result = api_post(args.base_url, f"json/2/{args.model}/search_read", args.api_key, kwargs)
    
    if isinstance(result, list):
        print(f"=== {len(result)} records from {args.model} ===")
        pp(result)
    else:
        pp(result)
