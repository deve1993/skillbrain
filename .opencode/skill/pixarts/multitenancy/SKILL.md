---
name: pixarts/multitenancy
description: Payload CMS multi-tenancy guide for Pixarts - tenant structure, access control, collections, hooks. Use when setting up multi-tenant CMS, configuring tenant access control, or implementing tenant-scoped data.
version: 1.0.0
---

# Payload CMS Multi-Tenancy Skill

Guida completa al sistema multi-tenant di Payload CMS per Pixarts.

## Architettura

```
┌──────────────────────────────────────────────────────────────┐
│                    cms.pixarts.eu                             │
│                    (Payload CMS 3.0)                          │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │  Tenant A   │  │  Tenant B   │  │  Tenant C   │  ...      │
│  │  (Cliente1) │  │  (Cliente2) │  │  (Cliente3) │           │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘           │
│         │                │                │                   │
│         ▼                ▼                ▼                   │
│  ┌─────────────────────────────────────────────────────┐     │
│  │              MongoDB Atlas (Database)                │     │
│  │  - Tutti i tenant nello stesso DB                    │     │
│  │  - Isolamento via campo "tenant" su ogni documento   │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
└──────────────────────────────────────────────────────────────┘
         │                │                │
         ▼                ▼                ▼
   ┌──────────┐    ┌──────────┐    ┌──────────┐
   │ Site A   │    │ Site B   │    │ Site C   │
   │ Next.js  │    │ Next.js  │    │ Next.js  │
   │ Coolify  │    │ Coolify  │    │ Coolify  │
   └──────────┘    └──────────┘    └──────────┘
```

## Sistema di Ruoli

| Ruolo | Accesso | Descrizione |
|-------|---------|-------------|
| `super-admin` | Tutti i tenant | Gestisce l'intero CMS |
| `admin` | Solo proprio tenant | Admin del cliente |
| `editor` | Solo proprio tenant | Crea/modifica contenuti |

## Collection: Tenants

```typescript
// src/collections/Tenants.ts
import type { CollectionConfig } from 'payload';

export const Tenants: CollectionConfig = {
  slug: 'tenants',
  admin: {
    useAsTitle: 'name',
    group: 'Admin',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => user?.roles?.includes('super-admin'),
    update: ({ req: { user } }) => user?.roles?.includes('super-admin'),
    delete: ({ req: { user } }) => user?.roles?.includes('super-admin'),
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Identificatore unico (es: ristorante-da-mario)',
      },
    },
    {
      name: 'domain',
      type: 'text',
      unique: true,
      admin: {
        description: 'Dominio del sito (es: ristorantedamario.it)',
      },
    },
    {
      name: 'settings',
      type: 'group',
      fields: [
        {
          name: 'primaryColor',
          type: 'text',
          defaultValue: '#000000',
        },
        {
          name: 'secondaryColor',
          type: 'text',
          defaultValue: '#ffffff',
        },
        {
          name: 'logo',
          type: 'upload',
          relationTo: 'media',
        },
        {
          name: 'favicon',
          type: 'upload',
          relationTo: 'media',
        },
      ],
    },
    {
      name: 'locales',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Italiano', value: 'it' },
        { label: 'English', value: 'en' },
        { label: 'Cestina', value: 'cs' },
      ],
      defaultValue: ['it'],
    },
  ],
};
```

## Tenant Field (Reusable)

```typescript
// src/fields/tenantField.ts
import type { Field } from 'payload';

export const tenantField: Field = {
  name: 'tenant',
  type: 'relationship',
  relationTo: 'tenants',
  required: true,
  admin: {
    position: 'sidebar',
    // Nascondi per super-admin (puo vedere/modificare tutto)
    condition: (data, siblingData, { user }) => {
      return !user?.roles?.includes('super-admin');
    },
  },
  // Auto-assegna tenant dell'utente corrente
  hooks: {
    beforeChange: [
      ({ req, value, operation }) => {
        if (operation === 'create' && !value && req.user?.tenant) {
          return req.user.tenant;
        }
        return value;
      },
    ],
  },
};
```

## Access Control: filterByTenant

```typescript
// src/access/filterByTenant.ts
import type { Access, Where } from 'payload';

// Read: filtra automaticamente per tenant
export const filterByTenant: Access = ({ req: { user } }) => {
  // Super-admin vede tutto
  if (user?.roles?.includes('super-admin')) {
    return true;
  }

  // Altri vedono solo il proprio tenant
  if (user?.tenant) {
    return {
      tenant: {
        equals: typeof user.tenant === 'object' 
          ? user.tenant.id 
          : user.tenant,
      },
    };
  }

  // Utenti non autenticati: accesso pubblico limitato
  return {
    status: {
      equals: 'published',
    },
  };
};

// Create/Update/Delete: solo proprio tenant
export const canModifyTenant: Access = ({ req: { user } }) => {
  if (user?.roles?.includes('super-admin')) {
    return true;
  }

  if (user?.roles?.includes('admin') || user?.roles?.includes('editor')) {
    return {
      tenant: {
        equals: typeof user.tenant === 'object' 
          ? user.tenant.id 
          : user.tenant,
      },
    };
  }

  return false;
};
```

## Applicazione su Collection

```typescript
// src/collections/Pages.ts
import type { CollectionConfig } from 'payload';
import { tenantField } from '../fields/tenantField';
import { filterByTenant, canModifyTenant } from '../access/filterByTenant';

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    useAsTitle: 'title',
  },
  access: {
    read: filterByTenant,
    create: canModifyTenant,
    update: canModifyTenant,
    delete: canModifyTenant,
  },
  fields: [
    tenantField, // SEMPRE includere
    {
      name: 'title',
      type: 'text',
      required: true,
      localized: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      options: ['draft', 'published'],
      defaultValue: 'draft',
    },
    // ... altri campi
  ],
};
```

## Query API con Filtro Tenant

### Dal Frontend (Next.js)

```typescript
// lib/payload.ts

// IMPORTANTE: Il CMS filtra automaticamente per utenti autenticati
// Per query pubbliche, usa sempre il filtro tenant esplicito

export async function getPages(tenantSlug: string, locale: string) {
  const tenant = await getTenantBySlug(tenantSlug);
  
  const response = await fetch(
    `${CMS_URL}/api/pages?` + new URLSearchParams({
      'where[tenant][equals]': tenant.id,
      'where[status][equals]': 'published',
      locale,
      depth: '2',
    }),
    { next: { tags: ['pages'] } }
  );
  
  return response.json();
}

export async function getPage(slug: string, tenantSlug: string, locale: string) {
  const tenant = await getTenantBySlug(tenantSlug);
  
  const response = await fetch(
    `${CMS_URL}/api/pages?` + new URLSearchParams({
      'where[slug][equals]': slug,
      'where[tenant][equals]': tenant.id,
      'where[status][equals]': 'published',
      locale,
      depth: '2',
    }),
    { next: { tags: [`page-${slug}`] } }
  );
  
  const { docs } = await response.json();
  return docs[0] ?? null;
}
```

### Sicurezza: Verifica Tenant

```typescript
// SEMPRE verificare che i dati richiesti appartengano al tenant corretto

export async function getPageSecure(slug: string, expectedTenant: string) {
  const page = await getPage(slug);
  
  // Verifica che il tenant corrisponda
  const pageTenant = typeof page.tenant === 'object' 
    ? page.tenant.slug 
    : page.tenant;
    
  if (pageTenant !== expectedTenant) {
    throw new Error('Tenant mismatch - access denied');
  }
  
  return page;
}
```

## Collections con Tenant

Tutte le collections che contengono dati specifici per cliente:

| Collection | Tenant Required | Note |
|------------|-----------------|------|
| `pages` | Si | Pagine del sito |
| `posts` | Si | Blog posts |
| `media` | Si | Upload immagini |
| `services` | Si | Servizi offerti |
| `team` | Si | Membri team |
| `projects` | Si | Portfolio |
| `testimonials` | Si | Recensioni |
| `faq` | Si | Domande frequenti |
| `forms` | Si | Form configurati |
| `formSubmissions` | Si | Invii form |
| `menus` | Si | Menu navigazione |
| `tenants` | No | Lista tenant (admin) |
| `users` | Special | Filtrato per tenant |

## Globals con Tenant

```typescript
// I Globals in Payload sono singleton
// Per multi-tenancy, salvare come array con tenant reference

// Alternativa: usare collection invece di global
export const Headers: CollectionConfig = {
  slug: 'headers',
  admin: {
    group: 'Layout',
  },
  access: {
    read: filterByTenant,
    // Solo 1 header per tenant
    create: async ({ req }) => {
      const existing = await req.payload.find({
        collection: 'headers',
        where: { tenant: { equals: req.user?.tenant } },
      });
      return existing.totalDocs === 0;
    },
    update: canModifyTenant,
  },
  fields: [
    tenantField,
    // ... campi header
  ],
};
```

## Hooks per Tenant

### Auto-assign Tenant

```typescript
// hooks/autoAssignTenant.ts
import type { CollectionBeforeChangeHook } from 'payload';

export const autoAssignTenant: CollectionBeforeChangeHook = async ({
  req,
  data,
  operation,
}) => {
  // Solo su create
  if (operation !== 'create') return data;
  
  // Se tenant gia presente, non modificare
  if (data.tenant) return data;
  
  // Assegna tenant dell'utente
  if (req.user?.tenant) {
    return {
      ...data,
      tenant: typeof req.user.tenant === 'object' 
        ? req.user.tenant.id 
        : req.user.tenant,
    };
  }
  
  return data;
};
```

### Validate Tenant Access

```typescript
// hooks/validateTenantAccess.ts
import type { CollectionBeforeChangeHook } from 'payload';

export const validateTenantAccess: CollectionBeforeChangeHook = async ({
  req,
  data,
  originalDoc,
}) => {
  const user = req.user;
  
  // Super-admin puo tutto
  if (user?.roles?.includes('super-admin')) return data;
  
  // Verifica che non stia cambiando tenant
  if (originalDoc?.tenant && data.tenant !== originalDoc.tenant) {
    throw new Error('Cannot change tenant of existing document');
  }
  
  // Verifica che stia accedendo al proprio tenant
  const userTenant = typeof user?.tenant === 'object' 
    ? user.tenant.id 
    : user?.tenant;
    
  if (data.tenant && data.tenant !== userTenant) {
    throw new Error('Cannot create/modify documents in other tenants');
  }
  
  return data;
};
```

## Best Practices

1. **SEMPRE includere tenantField** su collections con dati client
2. **SEMPRE usare filterByTenant** per access control
3. **SEMPRE verificare tenant** nelle query API
4. **MAI esporre tenant ID** al frontend (usa slug)
5. **Test isolamento** - verifica che tenant A non veda dati tenant B
6. **Logging** - traccia accessi cross-tenant per audit

## Troubleshooting

### "Data from wrong tenant"

```typescript
// Verifica che il filtro sia applicato
const { docs } = await payload.find({
  collection: 'pages',
  where: {
    tenant: { equals: tenantId }, // OBBLIGATORIO
  },
});
```

### "User can't see their data"

```typescript
// Verifica che l'utente abbia tenant assegnato
const user = await payload.findByID({
  collection: 'users',
  id: userId,
  depth: 1, // Per popolare tenant
});
console.log('User tenant:', user.tenant);
```

### "Super-admin can't create for other tenants"

```typescript
// Super-admin deve specificare tenant esplicitamente
await payload.create({
  collection: 'pages',
  data: {
    tenant: otherTenantId, // Specificare manualmente
    title: 'New Page',
    // ...
  },
});
```
