"""
Shared Odoo API client utilities.
All scripts use this module for HTTP calls and config.
"""
import argparse
import json
import os
import sys
import urllib.request
import urllib.error
import urllib.parse


DEFAULT_BASE_URL = os.environ.get("ODOO_BASE_URL", "https://fl1.cz")
DEFAULT_API_KEY = os.environ.get("ODOO_API_KEY", "")


def get_base_parser(description: str) -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=description)
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="Odoo base URL")
    parser.add_argument("--api-key", default=DEFAULT_API_KEY, help="Bearer API key")
    return parser


def api_get(base_url: str, path: str, api_key: str) -> dict:
    """HTTP GET with bearer auth, returns parsed JSON."""
    url = f"{base_url.rstrip('/')}/{path.lstrip('/')}"
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        print(f"ERROR {e.code}: {body}", file=sys.stderr)
        sys.exit(1)


def api_post(base_url: str, path: str, api_key: str, data: dict = None) -> any:
    """HTTP POST with bearer auth + JSON body, returns parsed JSON."""
    url = f"{base_url.rstrip('/')}/{path.lstrip('/')}"
    payload = json.dumps(data or {}).encode()
    req = urllib.request.Request(url, data=payload, method="POST", headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        print(f"ERROR {e.code}: {body}", file=sys.stderr)
        sys.exit(1)


def pp(data):
    """Pretty-print JSON data."""
    print(json.dumps(data, indent=2, ensure_ascii=False, default=str))
