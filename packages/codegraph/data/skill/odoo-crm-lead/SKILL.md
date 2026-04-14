---
name: odoo-crm-lead
description: Integrazione Odoo CRM Lead via API - form frontend, webhook, protocollo invio dati. Use when building forms that submit to Odoo CRM, creating lead capture integrations, or implementing Odoo webhook connections.
version: 1.0.0
---

# Odoo CRM Lead API - Knowledge Base

## Overview

Modulo Odoo 18 `api_crm_lead` di FL1 sro che espone endpoint REST pubblici per creare Lead CRM da qualsiasi fonte esterna (form web, webhook, automazioni).

**Istanza Odoo**: `https://fl1.cz/odoo`
**Base endpoint**: `https://fl1.cz/odoo/api/crm/<endpoint-slug>`
**Metodo**: `POST`
**Auth**: Header `apikey` (opzionale, configurabile per endpoint)

---

## PROTOCOLLO FORM (REGOLA FERREA)

**Questa regola ha priorità MASSIMA per qualsiasi agente che costruisce form.**

### Quando si attiva

Ogni volta che un task richiede la creazione di un **form** in qualsiasi progetto (contatto, preventivo, prenotazione, candidatura, newsletter, qualsiasi raccolta dati), l'agente DEVE:

### Step 1: FERMARSI e CHIEDERE

Prima di implementare il form, chiedere all'utente:

```
FORM DETECTED: Sto per costruire un form. Dove vuoi inviare i dati?

1. Odoo CRM Lead (crea lead automatico in Odoo)
2. Payload CMS (salva nel CMS multi-tenant)
3. Email (invio email con i dati)
4. Custom endpoint (URL specifico)
5. Multiplo (es. Odoo + Email)
```

### Step 2: Se l'utente sceglie ODOO

Chiedere:

```
ODOO INTEGRATION:
1. Endpoint slug? (es. "contatto", "preventivo-landing-x")
   → Verrà usato come: https://fl1.cz/odoo/api/crm/<slug>
2. Serve autenticazione apikey? (si/no)
   → Se sì, il token va in header "apikey"
3. Quali campi vuoi nel form? (es. nome, email, telefono, messaggio, servizio...)
   → I campi JSON devono matchare il mapping configurato in Odoo
4. Team vendita / Tag specifici? (opzionale, si configura lato Odoo)
```

### Step 3: Implementare

Usare il template di integrazione descritto sotto.

---

## API Reference

### Endpoint

```
POST https://fl1.cz/odoo/api/crm/<endpoint-slug>
```

### Headers

| Header | Valore | Obbligatorio |
|--------|--------|--------------|
| `Content-Type` | `application/json` | Sì |
| `apikey` | `<token-value>` | Solo se endpoint ha `is_token_required=True` |

### Request Body

JSON libero. Le chiavi vengono mappate ai campi CRM in Odoo tramite la configurazione endpoint.

```json
{
  "name": "Mario Rossi",
  "email": "mario@example.com",
  "phone": "+39 333 1234567",
  "message": "Vorrei un preventivo per...",
  "service": "web-development"
}
```

### JSON annidati

Il modulo **appiattisce automaticamente** JSON annidati:

```json
{
  "contact": {
    "name": "Mario",
    "surname": "Rossi"
  },
  "request": {
    "type": "quote",
    "services": ["web", "seo"]
  }
}
```

Diventa (con strategia `join`):
```
contact_name → "Mario"
contact_surname → "Rossi"
request_type → "quote"
request_services → "web, seo"
```

### Strategie array

| Strategia | Comportamento |
|-----------|---------------|
| `join` (default) | Concatena con virgola: `"web, seo"` |
| `first` | Prende solo il primo elemento |
| `skip` | Ignora campi array |

### Response

**Successo (200)**:
```json
{
  "status": "ok",
  "webhook_code": "000042"
}
```

**Errori comuni**:

| Status | Errore | Causa |
|--------|--------|-------|
| 404 | `Missing endpoint` | URL senza slug |
| 400 | `invalid Endpoint or not confirmed` | Endpoint non esiste o non confermato |
| 400 | `Missing apikey` | Token richiesto ma non inviato |
| 400 | `Invalid apikey` | Token non valido |
| 400 | `Invalid JSON format` | Body non è JSON valido |
| 400 | `Empty array payload not allowed` | Body è `[]` vuoto |
| 500 | `Internal server error` | Errore lato Odoo |

---

## Flusso interno Odoo

```
POST /api/crm/<slug>
  │
  ├─ Cerca endpoint confermato con slug
  ├─ Verifica token (se richiesto)
  ├─ Parsa JSON (supporta form-urlencoded e JSON)
  ├─ Crea record api.crm.webhook (log della chiamata)
  │
  ├─ Se is_send_other → forward a endpoint esterni
  │
  └─ Se is_create_lead → crea crm.lead:
       ├─ Appiattisce JSON con strategia configurata
       ├─ Mappa chiavi JSON → campi CRM (via field_ids)
       ├─ Campi "description" → aggregati in nota HTML
       ├─ Campi "is_name" → compongono il nome del lead
       ├─ Assegna team vendita e tag dall'endpoint
       └─ Salva lead e collega a webhook
```

---

## Template Integrazione Frontend (Next.js)

### Environment Variables

```env
# .env.local
NEXT_PUBLIC_ODOO_URL=https://fl1.cz/odoo
ODOO_API_KEY=<token-se-richiesto>
```

**NOTA**: `ODOO_API_KEY` è SENZA `NEXT_PUBLIC_` perché deve restare server-side.

### Server Action (consigliato)

```typescript
// app/actions/submit-to-odoo.ts
'use server';

import { z } from 'zod';

// Schema dinamico - adattare ai campi del form specifico
const formSchema = z.object({
  name: z.string().min(2, 'Nome richiesto'),
  email: z.string().email('Email non valida'),
  phone: z.string().optional(),
  message: z.string().min(10, 'Messaggio troppo corto'),
});

type FormState = {
  success: boolean;
  error?: string;
  webhookCode?: string;
};

export async function submitToOdoo(
  endpoint: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  // Validazione
  const parsed = formSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    message: formData.get('message'),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors.map(e => e.message).join(', '),
    };
  }

  const odooUrl = process.env.NEXT_PUBLIC_ODOO_URL;
  const apiKey = process.env.ODOO_API_KEY;

  if (!odooUrl) {
    console.error('NEXT_PUBLIC_ODOO_URL not configured');
    return { success: false, error: 'Configurazione server mancante' };
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Aggiunge apikey solo se configurata
    if (apiKey) {
      headers['apikey'] = apiKey;
    }

    const response = await fetch(`${odooUrl}/api/crm/${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(parsed.data),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Odoo API error:', result);
      return {
        success: false,
        error: result.error || 'Errore invio dati',
      };
    }

    return {
      success: true,
      webhookCode: result.webhook_code,
    };
  } catch (error) {
    console.error('Network error:', error);
    return {
      success: false,
      error: 'Errore di connessione. Riprova.',
    };
  }
}
```

### Form Component (Client)

```tsx
// components/forms/odoo-lead-form.tsx
'use client';

import { useActionState } from 'react';
import { submitToOdoo } from '@/app/actions/submit-to-odoo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface OdooLeadFormProps {
  endpoint: string;
  fields: Array<{
    name: string;
    label: string;
    type: 'text' | 'email' | 'tel' | 'textarea' | 'select';
    required?: boolean;
    placeholder?: string;
    options?: Array<{ value: string; label: string }>;
  }>;
  successMessage?: string;
}

export function OdooLeadForm({
  endpoint,
  fields,
  successMessage = 'Messaggio inviato con successo!',
}: OdooLeadFormProps) {
  const submitAction = submitToOdoo.bind(null, endpoint);
  const [state, formAction, isPending] = useActionState(submitAction, {
    success: false,
  });

  if (state.success) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
        <p className="text-green-800 font-medium">{successMessage}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-red-800 text-sm">{state.error}</p>
        </div>
      )}

      {fields.map((field) => (
        <div key={field.name} className="space-y-2">
          <Label htmlFor={field.name}>{field.label}</Label>
          {field.type === 'textarea' ? (
            <Textarea
              id={field.name}
              name={field.name}
              placeholder={field.placeholder}
              required={field.required}
            />
          ) : field.type === 'select' ? (
            <select
              id={field.name}
              name={field.name}
              required={field.required}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2"
            >
              <option value="">{field.placeholder || 'Seleziona...'}</option>
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <Input
              id={field.name}
              name={field.name}
              type={field.type}
              placeholder={field.placeholder}
              required={field.required}
            />
          )}
        </div>
      ))}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Invio in corso...' : 'Invia'}
      </Button>
    </form>
  );
}
```

### Esempio di utilizzo

```tsx
// In qualsiasi pagina
<OdooLeadForm
  endpoint="contatto-sito-x"
  fields={[
    { name: 'name', label: 'Nome', type: 'text', required: true, placeholder: 'Mario Rossi' },
    { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'phone', label: 'Telefono', type: 'tel' },
    { name: 'service', label: 'Servizio', type: 'select', options: [
      { value: 'web', label: 'Sviluppo Web' },
      { value: 'seo', label: 'SEO' },
      { value: 'design', label: 'Design' },
    ]},
    { name: 'message', label: 'Messaggio', type: 'textarea', required: true },
  ]}
  successMessage="Grazie! Ti ricontatteremo entro 24h."
/>
```

---

## Configurazione lato Odoo

Per ogni nuovo form/integrazione, lato Odoo serve:

1. **Creare un Endpoint** in `CRM > Configurazione > Api CRM Endpoint`
   - Name: nome descrittivo (es. "Sito Cliente X - Contatto")
   - Endpoint: slug univoco (es. `contatto-sito-x`)
   - Type: Lead
   - Tags: per filtrare i lead
   - Team vendita: assegnazione automatica

2. **Incollare un JSON Master** di esempio con la struttura dei dati che il form invierà

3. **Premere "Parse Fields"** → genera la matrice di mapping automatica

4. **Mappare i campi** → associare ogni chiave JSON al campo CRM corretto (es. `email` → `email_from`, `phone` → `phone`)

5. **Configurare token** (opzionale) → generare token e abilitare `is_token_required`

6. **Confermare l'endpoint** → stato da Draft a Confirmed

---

## Casi d'uso

| Caso | Endpoint slug suggerito | Campi tipici |
|------|------------------------|--------------|
| Form contatto generico | `contatto` | name, email, phone, message |
| Richiesta preventivo | `preventivo` | name, email, phone, service, budget, message |
| Candidatura lavoro | `candidatura` | name, email, phone, position, experience, message |
| Prenotazione | `prenotazione` | name, email, phone, date, time, service, notes |
| Newsletter | `newsletter` | email, name |
| Landing page campagna | `landing-<campaign>` | name, email, phone, interest |
| Form multi-step | `wizard-<name>` | step1_*, step2_*, step3_* (JSON annidato) |
| Facebook Lead Ads | `fb-leads` | full_name, email, phone_number (via n8n/Zapier) |
| Google Ads | `gads-leads` | name, email, phone (via n8n) |
| Chatbot | `bot-<platform>` | user_name, user_message, platform, session_id |
| E-commerce richiesta info | `product-inquiry` | name, email, product_name, product_id, question |

---

## Troubleshooting

| Problema | Causa | Soluzione |
|----------|-------|-----------|
| 404 Missing endpoint | Slug sbagliato nell'URL | Verificare slug in Odoo |
| 400 not confirmed | Endpoint in stato Draft | Confermare endpoint in Odoo |
| 400 Missing apikey | Token richiesto ma non inviato | Aggiungere header `apikey` |
| 400 Invalid apikey | Token sbagliato | Verificare token in Odoo |
| Lead creato senza dati | Mapping campi non configurato | Controllare field_ids in Odoo |
| CORS error dal browser | Chiamata diretta dal client | Usare Server Action (server-side) |
| JSON nested non mappato | Struttura diversa dal master | Ri-parsare JSON Master in Odoo |

### CORS

**IMPORTANTE**: Le chiamate a Odoo devono essere **server-side** (Server Actions o API Route).
Non chiamare direttamente da client-side per evitare problemi CORS e per proteggere l'apikey.

---

## Checklist Integrazione

- [ ] Endpoint creato e confermato in Odoo
- [ ] JSON Master incollato e fields parsati
- [ ] Mapping campi CRM configurato
- [ ] Token generato (se richiesto)
- [ ] `NEXT_PUBLIC_ODOO_URL` in `.env.local`
- [ ] `ODOO_API_KEY` in `.env.local` (se serve)
- [ ] Server Action creata con validazione Zod
- [ ] Form component implementato
- [ ] Test invio → verificare lead in Odoo CRM
- [ ] Gestione errori frontend (messaggi utente)
