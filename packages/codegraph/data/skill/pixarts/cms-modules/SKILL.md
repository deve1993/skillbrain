---
name: pixarts/cms-modules
description: Pixarts CMS modules pattern - reservations, ecommerce, events, portfolio, newsletter. Use when adding functional modules to Payload CMS tenant, implementing reservations, e-commerce, or event management.
version: 1.0.0
---

# Pixarts CMS Modules

Pattern per aggiungere moduli funzionali al CMS Payload multi-tenant.

## Architettura Moduli

Ogni modulo è un pacchetto self-contained che aggiunge:
1. **Collections** Payload con access control multi-tenant
2. **Fields** riutilizzabili
3. **Hooks** per side effects (email, revalidation, ecc.)
4. **Frontend components** per rendering

## Moduli Disponibili

### 1. Reservations (Prenotazioni)

**Use case**: Ristoranti, saloni, studi professionali, hotel

**Collections:**

```typescript
// collections/bookings.ts
export const Bookings: CollectionConfig = {
  slug: 'bookings',
  admin: { useAsTitle: 'customerName' },
  fields: [
    tenantField,
    { name: 'customerName', type: 'text', required: true },
    { name: 'customerEmail', type: 'email', required: true },
    { name: 'customerPhone', type: 'text' },
    { name: 'service', type: 'relationship', relationTo: 'services', required: true },
    { name: 'date', type: 'date', required: true },
    { name: 'timeSlot', type: 'text', required: true },
    { name: 'status', type: 'select', options: ['pending', 'confirmed', 'cancelled', 'completed'], defaultValue: 'pending' },
    { name: 'notes', type: 'textarea' },
  ],
  access: { read: tenantReadAccess, create: () => true, update: tenantWriteAccess },
}

// collections/services.ts
export const Services: CollectionConfig = {
  slug: 'services',
  fields: [
    tenantField,
    { name: 'name', type: 'text', required: true, localized: true },
    { name: 'description', type: 'textarea', localized: true },
    { name: 'duration', type: 'number', required: true }, // minuti
    { name: 'price', type: 'number' },
    { name: 'active', type: 'checkbox', defaultValue: true },
  ],
}

// collections/availability.ts
export const Availability: CollectionConfig = {
  slug: 'availability',
  fields: [
    tenantField,
    { name: 'dayOfWeek', type: 'select', options: ['mon','tue','wed','thu','fri','sat','sun'] },
    { name: 'startTime', type: 'text', required: true }, // "09:00"
    { name: 'endTime', type: 'text', required: true },   // "18:00"
    { name: 'slotDuration', type: 'number', defaultValue: 30 }, // minuti
    { name: 'active', type: 'checkbox', defaultValue: true },
  ],
}
```

### 2. E-commerce

**Use case**: Negozi online, vendita prodotti

**Collections:**
- `products`: name, slug, description, price, compareAtPrice, images, categories, inventory, variants, active
- `orders`: orderNumber, customer (name, email, phone, address), items[], total, status (pending/paid/shipped/delivered/cancelled), paymentMethod
- `customers`: name, email, phone, addresses[], orderHistory

### 3. Events (Eventi)

**Use case**: Teatri, conferenze, corsi, workshop

**Collections:**
- `events`: title, slug, description, date, endDate, location, capacity, price, image, categories, status (draft/published/cancelled)
- `registrations`: event (rel), attendee (name, email, phone), ticketType, quantity, status (pending/confirmed/cancelled), paymentStatus
- `tickets`: event (rel), type (name, price, quantity, description)

### 4. Portfolio

**Use case**: Agenzie, freelancer, studi creativi

**Collections:**
- `projects`: title, slug, client, description, featuredImage, gallery[], technologies[], url, year, featured, order

### 5. FAQ

**Use case**: Qualsiasi sito con domande frequenti

**Collections:**
- `faqs`: question (localized), answer (richText, localized), category (rel), order, active
- `faq-categories`: name (localized), slug, order

### 6. Newsletter

**Use case**: Blog, marketing, e-commerce

**Collections:**
- `subscribers`: email, name, status (active/unsubscribed), source, subscribedAt
- `campaigns`: subject, content, sentAt, status (draft/sent), recipientCount

### 7. Reviews (Recensioni)

**Use case**: E-commerce, ristoranti, servizi

**Collections:**
- `reviews`: author, email, rating (1-5), title, content, product/service (rel), status (pending/approved/rejected), featured

### 8. Jobs (Lavoro)

**Use case**: Aziende che assumono

**Collections:**
- `job-listings`: title, slug, department, location, type (full-time/part-time/contract/remote), description (richText), requirements, salary, active
- `applications`: job (rel), name, email, phone, coverLetter, resume (upload), status (new/reviewed/interviewed/hired/rejected)

### 9. Memberships

**Use case**: Palestre, club, SaaS

**Collections:**
- `plans`: name, slug, description, price, interval (monthly/yearly), features[], active, order
- `subscriptions`: user (rel), plan (rel), status (active/cancelled/expired), startDate, endDate, stripeId

### 10. Affiliates

**Use case**: E-commerce, SaaS

**Collections:**
- `affiliates`: name, email, code, commissionRate, status (active/inactive), totalEarnings
- `referrals`: affiliate (rel), order (rel), commission, status (pending/paid)

---

## Pattern di Installazione

```bash
# Comando
/cms-module <modulo> <tenant-slug>
```

**Workflow:**
1. Crea le collection files in `cms/collections/modules/<modulo>/`
2. Registra le collections in `payload.config.ts`
3. Aggiungi access control multi-tenant
4. Crea hooks per notifiche/revalidation
5. Genera i tipi TypeScript
6. Crea i componenti frontend per il rendering

## Access Control Standard per Moduli

```typescript
// Tutti i moduli usano lo stesso pattern
import { tenantField, tenantReadAccess, tenantWriteAccess } from '../fields/tenant';

// Lettura pubblica (sito frontend)
const publicRead: Access = ({ req }) => {
  // Utenti autenticati: filtro tenant
  if (req.user?.tenant) return { tenant: { equals: req.user.tenant } };
  // Utenti non autenticati: solo dati pubblicati
  return { _status: { equals: 'published' } };
};
```
