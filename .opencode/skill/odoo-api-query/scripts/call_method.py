#!/usr/bin/env python3
"""Call any ORM method on any Odoo model via /json/2."""
import json
from odoo_client import get_base_parser, api_post, pp

parser = get_base_parser("Call any ORM method on an Odoo model")
parser.add_argument("model", help="Model name (e.g. res.partner)")
parser.add_argument("method", help="Method name (e.g. search_read, create, write)")
parser.add_argument("--ids", default="", help="Comma-separated record IDs")
parser.add_argument("--args", default="[]", help="Positional args as JSON array")
parser.add_argument("--kwargs", default="{}", help="Keyword args as JSON object")
parser.add_argument("--context", default="{}", help="Context dict as JSON")
args = parser.parse_args()

payload = {}

if args.ids:
    payload["ids"] = [int(x.strip()) for x in args.ids.split(",")]

parsed_args = json.loads(args.args)
if parsed_args:
    payload["args"] = parsed_args

parsed_kwargs = json.loads(args.kwargs)
if parsed_kwargs:
    payload.update(parsed_kwargs)

parsed_context = json.loads(args.context)
if parsed_context:
    payload["context"] = parsed_context

result = api_post(args.base_url, f"json/2/{args.model}/{args.method}", args.api_key, payload)
pp(result)
