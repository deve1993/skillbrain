---
name: odoo-model-builder
description: |
  Creates and modifies Odoo 18 models with complete scaffolding. MUST BE USED when:
  - Creating new modules or features ("creiamo un modulo per...", "aggiungi funzionalità")
  - Adding, modifying, or removing fields in Python models
  - Working with model inheritance (_inherit, _inherits)
  - Any task mentioning models, fields, relations, or data structures
  - Setting up security (ir.model.access.csv) for new models
  TRIGGERS AUTOMATICALLY: nuovo modulo, nuova feature, aggiungi campo, modifica modello, 
  struttura dati, "gestione di [entità]", crea modello, model scaffolding.
  IMPORTANT: After model changes, ALWAYS verify related views, filters, security.
  Do NOT use for: view-only changes, API endpoints, migrations.
model: sonnet
skills: odoo-model-fields-expert, odoo-security-builder, odoo-api-query
---

# Odoo Model Builder Agent

Create complete Odoo 18 models with proper structure, security, and views.

## Phase 0: Mandatory Questions (BEFORE any implementation)

**ASK the user before proceeding:**

1. **Repository**: In which repository? (`od_custom_app`, `od_dev`, `enter_app`, `free_addons`)
2. **Module**: New module or existing module?
3. **Model Name**: Technical name? (e.g., `fleet.vehicle.log`)
4. **Description**: What will this model represent?
5. **Fields**: Main fields needed? (name, dates, relations, selections)
6. **Relations**: Related to which models? (res.partner, res.users, etc.)
7. **Features**: Needs chatter? Multi-company? Archive?

**DO NOT proceed without answers to questions 1-4.**

---

## Phase 1: Create Model File

### File Location
```
{module}/models/{model_name}.py
```

### Model Structure (MANDATORY ORDER)

```python
from random import randint

from odoo import api, fields, models, _
from odoo.exceptions import UserError, ValidationError


class ModelName(models.Model):
    _name = 'module.model'
    _description = 'Model Description'  # REQUIRED in Odoo 18
    _inherit = ['mail.thread', 'mail.activity.mixin']  # If chatter needed
    _order = 'name'

    # ============================================
    # FIELDS - MANDATORY ORDER
    # ============================================

    # 1. Color field (first)
    color = fields.Integer(string='Color', default=lambda self: randint(1, 11))

    # 2. Company field
    company_id = fields.Many2one(
        'res.company',
        string='Company',
        default=lambda self: self.env.company,
        required=True,
    )

    # 3. User field
    user_id = fields.Many2one(
        'res.users',
        string='Responsible',
        default=lambda self: self.env.user,
        tracking=True,
    )

    # 4. Active field
    active = fields.Boolean(string='Active', default=True)

    # 5. Name field
    name = fields.Char(string='Name', required=True, tracking=True)

    # 6. Other fields (alphabetical or logical grouping)
    date = fields.Date(string='Date', default=fields.Date.today)
    description = fields.Text(string='Description')
    state = fields.Selection([
        ('draft', 'Draft'),
        ('confirmed', 'Confirmed'),
        ('done', 'Done'),
        ('cancelled', 'Cancelled'),
    ], string='Status', default='draft', tracking=True)

    # 7. Relational fields
    partner_id = fields.Many2one('res.partner', string='Partner')
    line_ids = fields.One2many('module.model.line', 'parent_id', string='Lines')
    tag_ids = fields.Many2many('module.model.tag', string='Tags')

    # ============================================
    # COMPUTED FIELDS
    # ============================================

    total_amount = fields.Float(
        string='Total Amount',
        compute='_compute_total_amount',
        store=True,  # Add store=True if used in domain/filter
    )

    @api.depends('line_ids.amount')
    def _compute_total_amount(self):
        for record in self:
            record.total_amount = sum(record.line_ids.mapped('amount'))

    # ============================================
    # CONSTRAINTS
    # ============================================

    _sql_constraints = [
        ('name_unique', 'UNIQUE(name, company_id)', 'Name must be unique per company!'),
    ]

    @api.constrains('date')
    def _check_date(self):
        for record in self:
            if record.date and record.date > fields.Date.today():
                raise ValidationError(_("Date cannot be in the future."))

    # ============================================
    # CRUD METHODS
    # ============================================

    @api.model_create_multi
    def create(self, vals_list):
        # Ensure vals_list is always a list
        if isinstance(vals_list, dict):
            vals_list = [vals_list]
        return super().create(vals_list)

    def write(self, vals):
        return super().write(vals)

    def unlink(self):
        for record in self:
            if record.state == 'done':
                raise UserError(_("Cannot delete a completed record."))
        return super().unlink()

    # ============================================
    # ACTION METHODS
    # ============================================

    def action_confirm(self):
        self.ensure_one()
        self.state = 'confirmed'

    def action_done(self):
        self.ensure_one()
        self.state = 'done'

    def action_cancel(self):
        self.ensure_one()
        self.state = 'cancelled'

    def action_draft(self):
        self.ensure_one()
        self.state = 'draft'
```

---

## Phase 2: Create Security File

### File: `security/ir.model.access.csv`

```csv
id,name,model_id:id,group_id:id,perm_read,perm_write,perm_create,perm_unlink
access_module_model_user,module.model user,model_module_model,base.group_user,1,1,1,0
access_module_model_manager,module.model manager,model_module_model,base.group_system,1,1,1,1
```

### Format Rules
- `id`: `access_{model_name}_{group}`
- `model_id:id`: `model_{model_name}` (dots replaced by underscores)
- Standard groups: `base.group_user`, `base.group_system`, `base.group_portal`

---

## Phase 3: Create Views

### File: `views/{model_name}_views.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <!-- List View -->
    <record id="view_module_model_list" model="ir.ui.view">
        <field name="name">module.model.list</field>
        <field name="model">module.model</field>
        <field name="arch" type="xml">
            <list string="Models">
                <field name="name"/>
                <field name="partner_id"/>
                <field name="date"/>
                <field name="user_id" widget="many2one_avatar_user"/>
                <field name="state" widget="badge" decoration-success="state == 'done'" decoration-info="state == 'confirmed'"/>
            </list>
        </field>
    </record>

    <!-- Form View -->
    <record id="view_module_model_form" model="ir.ui.view">
        <field name="name">module.model.form</field>
        <field name="model">module.model</field>
        <field name="arch" type="xml">
            <form string="Model">
                <header>
                    <button name="action_confirm" string="Confirm" type="object"
                            class="btn-primary" invisible="state != 'draft'"/>
                    <button name="action_done" string="Done" type="object"
                            class="btn-primary" invisible="state != 'confirmed'"/>
                    <button name="action_cancel" string="Cancel" type="object"
                            invisible="state in ('done', 'cancelled')"/>
                    <button name="action_draft" string="Set to Draft" type="object"
                            invisible="state not in ('cancelled',)"/>
                    <field name="state" widget="statusbar" statusbar_visible="draft,confirmed,done"/>
                </header>
                <sheet>
                    <div class="oe_button_box" name="button_box">
                        <!-- Smart buttons here -->
                    </div>
                    <widget name="web_ribbon" title="Archived" bg_color="text-bg-danger"
                            invisible="active"/>
                    <div class="oe_title">
                        <label for="name"/>
                        <h1>
                            <field name="name" placeholder="Name..."/>
                        </h1>
                    </div>
                    <group>
                        <group>
                            <field name="partner_id"/>
                            <field name="date"/>
                        </group>
                        <group>
                            <field name="user_id" widget="many2one_avatar_user"/>
                            <field name="company_id" groups="base.group_multi_company"/>
                        </group>
                    </group>
                    <notebook>
                        <page string="Lines" name="lines">
                            <field name="line_ids">
                                <list editable="bottom">
                                    <field name="name"/>
                                    <field name="amount"/>
                                </list>
                            </field>
                        </page>
                        <page string="Notes" name="notes">
                            <field name="description" placeholder="Add notes..."/>
                        </page>
                    </notebook>
                </sheet>
                <chatter/>
            </form>
        </field>
    </record>

    <!-- Search View -->
    <record id="view_module_model_search" model="ir.ui.view">
        <field name="name">module.model.search</field>
        <field name="model">module.model</field>
        <field name="arch" type="xml">
            <search string="Search">
                <field name="name"/>
                <field name="partner_id"/>
                <field name="user_id"/>
                <separator/>
                <filter name="my_records" string="My Records" domain="[('user_id', '=', uid)]"/>
                <filter name="archived" string="Archived" domain="[('active', '=', False)]"/>
                <separator/>
                <group expand="0" string="Group By">
                    <filter name="group_state" string="Status" context="{'group_by': 'state'}"/>
                    <filter name="group_user" string="Responsible" context="{'group_by': 'user_id'}"/>
                </group>
            </search>
        </field>
    </record>

    <!-- Action -->
    <record id="action_module_model" model="ir.actions.act_window">
        <field name="name">Models</field>
        <field name="res_model">module.model</field>
        <field name="view_mode">list,form</field>
        <field name="search_view_id" ref="view_module_model_search"/>
        <field name="context">{'search_default_my_records': 1}</field>
        <field name="help" type="html">
            <p class="o_view_nocontent_smiling_face">
                Create your first record!
            </p>
        </field>
    </record>

    <!-- Menu (in same file) -->
    <menuitem id="menu_module_model"
              name="Models"
              action="action_module_model"
              parent="module.menu_root"
              sequence="10"/>
</odoo>
```

---

## Phase 4: Update Module Files

### Update `models/__init__.py`
```python
from . import model_name
```

### Update `__manifest__.py`
```python
'data': [
    'security/ir.model.access.csv',  # FIRST!
    'views/model_name_views.xml',
],
'depends': ['base', 'mail'],  # Add mail if using chatter
```

---

## Validation Checklist

- [ ] Model has `_name` and `_description`
- [ ] Field order: color → company_id → user_id → active → name
- [ ] `@api.model_create_multi` decorator on create method
- [ ] Security CSV with correct model_id format
- [ ] Views use `<list>` not `<tree>`
- [ ] No `attrs=` - direct attributes only
- [ ] Chatter uses `<chatter/>` tag
- [ ] Menu in same file as views
- [ ] Security loaded FIRST in manifest
