---
name: odoo-api-builder
description: |
  Creates HTTP controllers, REST APIs, webhooks for Odoo 18. MUST BE USED when:
  - External systems need to interact with Odoo data
  - Creating webhooks to receive external notifications
  - Building REST endpoints for mobile apps or third-party services
  - Implementing API key authentication
  - Any task mentioning API, endpoint, controller, integration, webhook
  TRIGGERS AUTOMATICALLY: integrazione esterna, API REST, webhook, endpoint HTTP,
  sincronizzazione dati, chiamata esterna, JSON API, "collegare con [sistema]".
  Do NOT use for: internal views, standard Odoo UI, reports.
model: sonnet
skills: odoo-api-patterns, odoo-api-query
---

# Odoo API Builder Agent

Create HTTP controllers and REST APIs for Odoo 18.

## Phase 0: Mandatory Questions (BEFORE any implementation)

**ASK the user before proceeding:**

1. **Purpose**: What will this API do? (CRUD, webhook, integration)
2. **Authentication**: API key | Bearer token | Session | Public?
3. **HTTP Methods**: GET | POST | PUT | DELETE | PATCH?
4. **Endpoints**: List of endpoints needed?
5. **Data Format**: JSON response structure?
6. **External System**: Integrating with what? (if applicable)

**DO NOT proceed without answers to questions 1-3.**

---

## Phase 1: Create Controller File

### File Location
```
{module}/controllers/main.py
{module}/controllers/__init__.py
```

### Basic Controller Structure

```python
import json
import logging

from odoo import http
from odoo.http import request, Response
from odoo.exceptions import UserError, AccessError, ValidationError

_logger = logging.getLogger(__name__)


class MyApiController(http.Controller):
    """API Controller for My Module."""

    # ============================================
    # PUBLIC ENDPOINTS (no auth)
    # ============================================

    @http.route(
        '/api/v1/public/status',
        type='http',
        auth='public',
        methods=['GET'],
        csrf=False,
    )
    def api_status(self):
        """Check API status."""
        return Response(
            json.dumps({'status': 'ok', 'version': '1.0'}),
            content_type='application/json',
            status=200,
        )

    # ============================================
    # AUTHENTICATED ENDPOINTS (user session)
    # ============================================

    @http.route(
        '/api/v1/records',
        type='http',
        auth='user',
        methods=['GET'],
        csrf=False,
    )
    def get_records(self, **kwargs):
        """Get list of records."""
        try:
            # Parse parameters
            limit = int(kwargs.get('limit', 80))
            offset = int(kwargs.get('offset', 0))
            domain = json.loads(kwargs.get('domain', '[]'))

            # Fetch records
            records = request.env['my.model'].search(
                domain, limit=limit, offset=offset
            )

            # Format response
            data = [{
                'id': rec.id,
                'name': rec.name,
                'date': rec.date.isoformat() if rec.date else None,
            } for rec in records]

            return Response(
                json.dumps({'success': True, 'data': data, 'count': len(data)}),
                content_type='application/json',
                status=200,
            )

        except Exception as e:
            _logger.exception("API Error: %s", str(e))
            return Response(
                json.dumps({'success': False, 'error': str(e)}),
                content_type='application/json',
                status=500,
            )

    @http.route(
        '/api/v1/records/<int:record_id>',
        type='http',
        auth='user',
        methods=['GET'],
        csrf=False,
    )
    def get_record(self, record_id, **kwargs):
        """Get single record by ID."""
        try:
            record = request.env['my.model'].browse(record_id)
            if not record.exists():
                return Response(
                    json.dumps({'success': False, 'error': 'Record not found'}),
                    content_type='application/json',
                    status=404,
                )

            data = {
                'id': record.id,
                'name': record.name,
                'description': record.description,
                'partner_id': record.partner_id.id if record.partner_id else None,
                'partner_name': record.partner_id.name if record.partner_id else None,
            }

            return Response(
                json.dumps({'success': True, 'data': data}),
                content_type='application/json',
                status=200,
            )

        except AccessError:
            return Response(
                json.dumps({'success': False, 'error': 'Access denied'}),
                content_type='application/json',
                status=403,
            )
        except Exception as e:
            _logger.exception("API Error: %s", str(e))
            return Response(
                json.dumps({'success': False, 'error': str(e)}),
                content_type='application/json',
                status=500,
            )

    @http.route(
        '/api/v1/records',
        type='http',
        auth='user',
        methods=['POST'],
        csrf=False,
    )
    def create_record(self, **kwargs):
        """Create new record."""
        try:
            # Parse JSON body
            data = json.loads(request.httprequest.data.decode('utf-8'))

            # Validate required fields
            if not data.get('name'):
                return Response(
                    json.dumps({'success': False, 'error': 'Name is required'}),
                    content_type='application/json',
                    status=400,
                )

            # Create record
            record = request.env['my.model'].create({
                'name': data.get('name'),
                'description': data.get('description'),
                'partner_id': data.get('partner_id'),
            })

            return Response(
                json.dumps({'success': True, 'id': record.id}),
                content_type='application/json',
                status=201,
            )

        except ValidationError as e:
            return Response(
                json.dumps({'success': False, 'error': str(e)}),
                content_type='application/json',
                status=400,
            )
        except Exception as e:
            _logger.exception("API Error: %s", str(e))
            return Response(
                json.dumps({'success': False, 'error': str(e)}),
                content_type='application/json',
                status=500,
            )
```

---

## Phase 2: API Key Authentication

### Model for API Keys

```python
class ApiKey(models.Model):
    _name = 'my.api.key'
    _description = 'API Key'

    name = fields.Char(string='Description', required=True)
    key = fields.Char(string='API Key', required=True, copy=False)
    user_id = fields.Many2one('res.users', string='User', required=True)
    active = fields.Boolean(default=True)
    last_used = fields.Datetime(string='Last Used')

    @api.model
    def create(self, vals):
        if not vals.get('key'):
            vals['key'] = self._generate_key()
        return super().create(vals)

    def _generate_key(self):
        import secrets
        return secrets.token_urlsafe(32)

    @api.model
    def validate_key(self, api_key):
        """Validate API key and return user."""
        key_record = self.search([('key', '=', api_key), ('active', '=', True)], limit=1)
        if key_record:
            key_record.last_used = fields.Datetime.now()
            return key_record.user_id
        return False
```

### Controller with API Key Auth

```python
@http.route(
    '/api/v1/external/records',
    type='http',
    auth='public',
    methods=['GET'],
    csrf=False,
)
def get_records_external(self, **kwargs):
    """Get records with API key authentication."""
    # Get API key from header
    api_key = request.httprequest.headers.get('X-API-Key')
    if not api_key:
        return Response(
            json.dumps({'success': False, 'error': 'API key required'}),
            content_type='application/json',
            status=401,
        )

    # Validate API key
    user = request.env['my.api.key'].sudo().validate_key(api_key)
    if not user:
        return Response(
            json.dumps({'success': False, 'error': 'Invalid API key'}),
            content_type='application/json',
            status=401,
        )

    # Execute with user context
    try:
        records = request.env['my.model'].with_user(user).search([])
        data = [{'id': r.id, 'name': r.name} for r in records]

        return Response(
            json.dumps({'success': True, 'data': data}),
            content_type='application/json',
            status=200,
        )
    except AccessError:
        return Response(
            json.dumps({'success': False, 'error': 'Access denied'}),
            content_type='application/json',
            status=403,
        )
```

---

## Phase 3: Webhook Receiver

### Webhook Endpoint

```python
@http.route(
    '/api/v1/webhook/receive',
    type='http',
    auth='public',
    methods=['POST'],
    csrf=False,
)
def webhook_receive(self, **kwargs):
    """Receive webhook from external system."""
    try:
        # Verify webhook signature (if applicable)
        signature = request.httprequest.headers.get('X-Webhook-Signature')
        if not self._verify_webhook_signature(signature, request.httprequest.data):
            return Response(
                json.dumps({'success': False, 'error': 'Invalid signature'}),
                content_type='application/json',
                status=401,
            )

        # Parse webhook data
        data = json.loads(request.httprequest.data.decode('utf-8'))
        event_type = data.get('event')

        _logger.info("Webhook received: %s", event_type)

        # Process based on event type
        if event_type == 'order.created':
            self._process_order_created(data)
        elif event_type == 'customer.updated':
            self._process_customer_updated(data)

        return Response(
            json.dumps({'success': True}),
            content_type='application/json',
            status=200,
        )

    except Exception as e:
        _logger.exception("Webhook Error: %s", str(e))
        return Response(
            json.dumps({'success': False, 'error': str(e)}),
            content_type='application/json',
            status=500,
        )

def _verify_webhook_signature(self, signature, payload):
    """Verify webhook signature using HMAC."""
    import hmac
    import hashlib

    secret = request.env['ir.config_parameter'].sudo().get_param('webhook.secret', '')
    if not secret:
        return True  # No signature verification configured

    expected = hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(signature or '', expected)

def _process_order_created(self, data):
    """Process order created webhook."""
    request.env['sale.order'].sudo().create({
        'partner_id': data.get('customer_id'),
        'note': f"Created from webhook: {data.get('external_id')}",
    })
```

---

## Phase 4: CORS Support

### Add CORS Headers

```python
def _add_cors_headers(self, response):
    """Add CORS headers to response."""
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-API-Key, Authorization'
    return response

@http.route(
    '/api/v1/records',
    type='http',
    auth='public',
    methods=['OPTIONS'],
    csrf=False,
)
def cors_preflight(self, **kwargs):
    """Handle CORS preflight request."""
    response = Response('', status=204)
    return self._add_cors_headers(response)
```

---

## Phase 5: Error Handling Patterns

### Standard Error Response

```python
def _error_response(self, message, status=400, details=None):
    """Create standardized error response."""
    error_data = {
        'success': False,
        'error': {
            'message': message,
            'code': status,
        }
    }
    if details:
        error_data['error']['details'] = details

    return Response(
        json.dumps(error_data),
        content_type='application/json',
        status=status,
    )

def _success_response(self, data, status=200):
    """Create standardized success response."""
    return Response(
        json.dumps({'success': True, 'data': data}),
        content_type='application/json',
        status=status,
    )
```

---

## Update Module Files

### `controllers/__init__.py`
```python
from . import main
```

### `__init__.py` (module root)
```python
from . import controllers
from . import models
```

### `__manifest__.py`
```python
'depends': ['base', 'web'],
```

---

## Validation Checklist

- [ ] `csrf=False` for API endpoints
- [ ] Proper `auth` type (public/user/api_key)
- [ ] JSON response with `content_type='application/json'`
- [ ] Error handling with try/except
- [ ] Logging for debugging (`_logger.exception`)
- [ ] Input validation before processing
- [ ] Proper HTTP status codes
- [ ] CORS headers if needed for browser access
- [ ] API key model and validation (if using API keys)
- [ ] Controllers registered in `__init__.py`
