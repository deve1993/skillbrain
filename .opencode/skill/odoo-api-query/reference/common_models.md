# Common Odoo 18 Models Reference

## Core / Base

| Model | Description | Key Fields |
|-------|-------------|------------|
| `res.partner` | Contacts (customers, vendors) | name, email, phone, is_company, parent_id, child_ids |
| `res.users` | Users | login, partner_id, groups_id |
| `res.company` | Companies | name, currency_id, partner_id |
| `res.country` | Countries | name, code |
| `ir.module.module` | Installed modules | name, state, shortdesc |
| `ir.model` | Model registry | model, name, field_id |
| `ir.model.fields` | Field definitions | name, model_id, ttype, relation |
| `ir.config_parameter` | System parameters | key, value |

## Sales

| Model | Description | Key Fields |
|-------|-------------|------------|
| `sale.order` | Quotations/Sales Orders | name, partner_id, state, amount_total, order_line |
| `sale.order.line` | SO Lines | order_id, product_id, product_uom_qty, price_unit |

## CRM

| Model | Description | Key Fields |
|-------|-------------|------------|
| `crm.lead` | Leads/Opportunities | name, partner_id, stage_id, expected_revenue, type |

## Accounting

| Model | Description | Key Fields |
|-------|-------------|------------|
| `account.move` | Invoices/Bills | name, partner_id, state, amount_total, move_type |
| `account.move.line` | Journal Items | move_id, account_id, debit, credit |

## Inventory

| Model | Description | Key Fields |
|-------|-------------|------------|
| `product.product` | Products (variants) | name, default_code, list_price, qty_available |
| `product.template` | Product Templates | name, type, categ_id |
| `stock.picking` | Transfers | name, partner_id, state, picking_type_id |

## Project

| Model | Description | Key Fields |
|-------|-------------|------------|
| `project.project` | Projects | name, partner_id, task_count |
| `project.task` | Tasks | name, project_id, stage_id, user_ids |

## Common ORM Methods (available on all models via /json/2)

| Method | Args | Description |
|--------|------|-------------|
| `search_read` | domain, fields, limit, offset, order | Search + read in one call |
| `search_count` | args=[[domain]] | Count matching records |
| `read` | ids=[], fields=[] | Read specific records |
| `create` | args=[[{values}]] | Create records |
| `write` | ids=[], args=[{values}] | Update records |
| `unlink` | ids=[] | Delete records |
| `fields_get` | kwargs={attributes:[...]} | Get field metadata |
| `name_search` | kwargs={name:"...",limit:10} | Search by display name |
| `default_get` | args=[["field1","field2"]] | Get default values |
