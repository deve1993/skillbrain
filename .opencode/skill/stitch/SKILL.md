---
name: stitch
description: Google Stitch MCP - generazione e modifica UI design da prompt, output React/TypeScript/HTML/CSS, estrazione design tokens. Use when generating UI from text prompts via Stitch, converting Stitch HTML/CSS to Tailwind/shadcn, or using Stitch as a Figma alternative.
version: 1.0.0
---

# Google Stitch MCP Knowledge Base

## Cos'è Stitch

Google Stitch (Google Labs) è un tool AI che genera UI design completi + codice da prompt testuali. Powered by Gemini 2.5 Pro. Free tier: **350 generazioni/mese**.

**Output supportati**: HTML, CSS, **React**, **TypeScript** — non solo HTML/CSS. Richiede minima conversione per Next.js.

**MCP Server**: Remote MCP cloud-side (`https://stitch.googleapis.com/mcp`). Autenticazione via API Key.

## Setup (una tantum)

1. Vai su [stitch.withgoogle.com](https://stitch.withgoogle.com) → Settings → Create API Key
2. Aggiungi in `.env.local`:
   ```
   STITCH_API_KEY=your-api-key
   ```
3. In `opencode.json` (già configurato):
   ```json
   "stitch": {
     "type": "http",
     "url": "https://stitch.googleapis.com/mcp",
     "headers": { "X-Goog-Api-Key": "{env:STITCH_API_KEY}" },
     "enabled": true
   }
   ```

## Tool MCP Disponibili

| Tool | Descrizione | Parametri chiave |
|------|-------------|-----------------|
| `generate_screen` | Genera uno screen da prompt | `prompt`, `projectId?` |
| `get_screen_code` | Ottieni codice dello screen (HTML/CSS/React/TS) | `screenId`, `format?` |
| `list_projects` | Lista progetti Stitch | — |
| `get_project` | Dettagli progetto e screens | `projectId` |
| `create_project` | Crea nuovo progetto | `name` |

## Iterazione / Modifica Layout

Per modificare un design esistente:

```
1. Hai già generato uno screen → nota il screenId
2. Chiama generate_screen() con:
   - prompt che descrive la MODIFICA: "same layout but dark background,
     remove the screenshot, add trust logos bar below the hero"
   - projectId del progetto esistente
3. Stitch genera un nuovo screen iterato
4. get_screen_code() → codice aggiornato
```

**Pattern iterazione**:
- "Keep the same structure but change [X] to [Y]"
- "Same layout, add [elemento] between [sezione A] and [sezione B]"
- "Make it more [minimal/bold/corporate], keep the content"
- "Adapt this for mobile, single column layout"

## Prompt Engineering per Stitch

Il prompt è il fattore più importante. Struttura ottimale:

```
[Tipo screen] + [Stile visivo] + [Contenuto] + [Device target]
```

### Template prompt per sezioni comuni

**Hero section**:
```
Design a modern SaaS landing page hero section. Clean minimal style with 
a bold headline, subtitle, primary CTA button, and secondary link. 
Dark background with blue accent. Desktop web layout.
```

**Pricing section**:
```
Create a pricing comparison section with 3 tiers (Starter, Pro, Enterprise). 
Card layout, monthly/yearly toggle, highlighted recommended plan. 
Clean light background, subtle shadows. Desktop web.
```

**Contact form**:
```
Design a clean contact form section with name, email, message fields 
and submit button. Minimal corporate style, white background, 
subtle border radius. Mobile-first layout.
```

**Navigation/header**:
```
Modern SaaS navigation bar with logo placeholder, nav links, 
CTA button. Sticky header, light background, subtle bottom border.
```

**Feature grid**:
```
Feature section with 6 cards in a 3x2 grid. Each card has an icon, 
title, and 2-line description. Light gray background, white cards, 
rounded corners. Tech startup aesthetic.
```

## Mappatura HTML/CSS → Tailwind

Quando leggi il codice HTML/CSS da `get_screen_code`:

### Colori
```
Cerca: background-color, color, border-color, fill
Mappa a variabili CSS di shadcn quando possibile:
  #fff → bg-background
  #0f172a → text-foreground
  #3b82f6 → bg-primary (o colore custom in @theme)
  #f8fafc → bg-muted
```

### Spacing
```
padding: 16px → p-4
padding: 24px → p-6
padding: 32px → p-8
margin: 8px → m-2
gap: 16px → gap-4
gap: 24px → gap-6
```

### Tipografia
```
font-size: 14px → text-sm
font-size: 16px → text-base
font-size: 20px → text-xl
font-size: 24px → text-2xl
font-size: 36px → text-4xl
font-weight: 400 → font-normal
font-weight: 600 → font-semibold
font-weight: 700 → font-bold
```

### Border-radius
```
4px → rounded
6px → rounded-md
8px → rounded-lg
12px → rounded-xl
16px → rounded-2xl
9999px → rounded-full
```

## Integrazione shadcn/ui

Mappa elementi HTML Stitch a componenti shadcn:

| HTML Stitch | shadcn Component |
|-------------|-----------------|
| `<button>` primario | `Button` (default) |
| `<button>` secondario | `Button variant="outline"` |
| Card con padding | `Card`, `CardHeader`, `CardContent` |
| `<input type="text">` | `Input` |
| `<select>` | `Select` |
| Badge/tag | `Badge` |
| `<form>` | `Form` (react-hook-form) |
| Tabs | `Tabs`, `TabsList`, `TabsTrigger` |
| Accordion | `Accordion` |

## Budget Management (350/mese)

- Non sprecare su variazioni minori — descrivi bene al primo tentativo
- Un prompt ben costruito vale 3 tentativi vaghi
- Per variazioni colore/tipografia: modifica il TSX manualmente invece di rigenerare
- Usa `list_projects` per tenere traccia degli screen già generati e riusarli

## Limitazioni da Comunicare

1. **React/TS output disponibile** — Richiede adattamento minimo per Next.js App Router (no `'use client'`, imports diversi), ma molto meno lavoro di conversione rispetto a HTML/CSS puro
2. **No design system awareness** — Non conosce il tuo Tailwind theme. I colori e spacing vanno normalizzati alle tue CSS vars
3. **Desktop-first** — I design generati sono tipicamente desktop. Documentare sempre mobile behavior
4. **No brand consistency automatica** — Non ricorda stili precedenti. Includere sempre brand colors e font nel prompt per coerenza
5. **Modifica = iterazione** — Non è WYSIWYG. Per modificare descrivi la modifica in un nuovo prompt
6. **Free tier** — 350 generazioni/mese. Pianifica l'uso su progetti grandi
