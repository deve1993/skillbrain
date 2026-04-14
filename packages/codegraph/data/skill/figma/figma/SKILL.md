---
name: figma
description: Figma MCP integration - leggi file Figma, estrai design tokens, genera codice Tailwind/shadcn pixel-perfect
---

# Figma MCP Skill

## MCP Server

`figma-developer-mcp` (Framelink) — Accesso diretto ai file Figma. Legge struttura, layout, stili e componenti da qualsiasi frame o nodo.

## Tool Principale: get_figma_data

```
get_figma_data(fileKey, nodeId?)
```

- `fileKey` — Estratto dall'URL Figma: `figma.com/design/XXXXXX/Nome-File` → prendi `XXXXXX`
- `nodeId` — (opzionale) ID del frame/componente specifico: `?node-id=1-2` → prendi `1-2`

**Sempre preferisci nodeId specifico** — Carica solo il frame necessario, non l'intero file.

## Come Estrarre fileKey e nodeId dall'URL

```
URL: https://www.figma.com/design/AbCdEf123/Nome-Progetto?node-id=14-892

fileKey = "AbCdEf123"
nodeId  = "14-892"  (sostituisci - con : se necessario: "14:892")
```

## Workflow Design → Codice

### Step 1: Leggi il design
```
get_figma_data("AbCdEf123", "14-892")
```

### Step 2: Analizza la risposta
La risposta contiene struttura semplificata con:
- **Layout**: `layoutMode` (HORIZONTAL/VERTICAL), `paddingLeft/Right/Top/Bottom`, `itemSpacing`, `primaryAxisAlignItems`, `counterAxisAlignItems`
- **Size**: `width`, `height`, `constraints`
- **Style**: `fills` (colori), `strokes` (bordi), `cornerRadius`, `effects` (ombre)
- **Typography**: `fontSize`, `fontWeight`, `lineHeightPx`, `letterSpacing`, `textAlignHorizontal`
- **Children**: lista ricorsiva dei nodi figli

### Step 3: Mappa a Tailwind

| Figma | Tailwind |
|-------|---------|
| `layoutMode: HORIZONTAL` | `flex flex-row` |
| `layoutMode: VERTICAL` | `flex flex-col` |
| `paddingLeft: 16, paddingRight: 16` | `px-4` |
| `paddingTop: 24, paddingBottom: 24` | `py-6` |
| `itemSpacing: 12` | `gap-3` |
| `primaryAxisAlignItems: CENTER` | `justify-center` |
| `counterAxisAlignItems: CENTER` | `items-center` |
| `cornerRadius: 8` | `rounded-lg` |
| `cornerRadius: 9999` | `rounded-full` |
| `fontSize: 14` | `text-sm` |
| `fontSize: 16` | `text-base` |
| `fontSize: 20` | `text-xl` |
| `fontSize: 24` | `text-2xl` |
| `fontSize: 32` | `text-3xl` |
| `fontWeight: 400` | `font-normal` |
| `fontWeight: 500` | `font-medium` |
| `fontWeight: 600` | `font-semibold` |
| `fontWeight: 700` | `font-bold` |
| `opacity: 0.5` | `opacity-50` |

### Step 4: Mappa colori Figma → Tailwind/CSS var

```typescript
// Figma fill: { r: 0.231, g: 0.510, b: 0.965, a: 1 }
// → rgb(59, 130, 246) → text-blue-500 o bg-blue-500

// Se il colore è in Figma Variables → usa CSS custom property
// --color-brand: #3B82F6; → bg-[var(--color-brand)]
```

### Step 5: Identifica componenti shadcn/ui

| Pattern Figma | Componente shadcn |
|--------------|-------------------|
| Rettangolo + testo clickable | `Button` con variant |
| Input con label sopra | `Input` + `Label` + `Form` |
| Container con header e body | `Card`, `CardHeader`, `CardContent` |
| Overlay con backdrop | `Dialog` |
| Menu a tendina | `DropdownMenu` |
| Lista selezione | `Select` |
| Pannello laterale | `Sheet` |
| Elemento selezionabile | `Checkbox`, `Switch`, `RadioGroup` |
| Lista paginata | `Table` con `DataTable` |
| Tag/etichetta | `Badge` |
| Separatore visivo | `Separator` |
| Accordion | `Accordion` |
| Tab navigation | `Tabs` |
| Tooltip al hover | `Tooltip` |
| Alert/notice | `Alert` |

## Estrazione Design Tokens (Figma Variables)

Se il progetto usa Figma Variables o Styles, mappa a `@theme` in `globals.css`:

```css
/* globals.css */
@import 'tailwindcss';

@theme {
  --color-brand-primary: #3B82F6;
  --color-brand-secondary: #10B981;
  --color-brand-accent: #F59E0B;
  --font-display: "Inter Variable", sans-serif;
  --radius-card: 12px;
}
```

Poi usa in Tailwind: `bg-[var(--color-brand-primary)]` o crea utility class.

## Output Format Atteso

```markdown
## Figma → Spec: [Nome Frame/Componente]

### Layout
- Container: `flex flex-col gap-4 p-6 max-w-sm`
- Background: `bg-white dark:bg-slate-900`
- Border: `border border-slate-200 rounded-xl`

### Shadcn components necessari
- `Card`, `CardHeader`, `CardContent`, `CardFooter`
- `Button` (variant: "default")
- `Badge` (variant: "secondary")

### Implementation TSX
```tsx
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function NomeComponente() {
  return (
    <Card className="max-w-sm">
      <CardHeader className="gap-2">
        <h3 className="text-xl font-semibold">Titolo</h3>
        <p className="text-sm text-muted-foreground">Descrizione</p>
      </CardHeader>
      <CardContent>
        <Button className="w-full">Azione principale</Button>
      </CardContent>
    </Card>
  )
}
```

### Design Tokens custom
```css
@theme {
  --color-brand: #3B82F6;
}
```

### Note per @component-builder
- [ ] Dark mode: usare CSS vars shadcn (già incluse)
- [ ] Mobile: aggiungere breakpoints `sm:` per layout responsive
- [ ] Animazione: fade-in al mount (passare a @motion-designer se richiesto)
- [ ] i18n: testi hardcoded da spostare in messages/it.json
```

## Best Practices

1. **Frame specifico > file intero** — Usa sempre `nodeId` per evitare di caricare l'intero file
2. **shadcn/ui first** — Prima verifica se esiste un componente shadcn, poi crea custom
3. **Tailwind-only** — Solo classi Tailwind, mai CSS inline o arbitrario senza motivo
4. **Mobile-first** — Figma tipicamente mostra desktop; aggiungi sempre varianti mobile
5. **Dark mode by default** — Usa sempre `dark:` variants o CSS vars shadcn
6. **Verifica visiva** — Dopo implementazione, usa Playwright per screenshot e comparazione

## Integrazione con Agenti

| Da | A | Cosa |
|----|---|------|
| Utente fornisce URL Figma | @figma-designer | legge il design via MCP |
| @figma-designer | @component-builder | spec componente con classi Tailwind |
| @figma-designer | @ui-designer | design tokens se non estratti da Figma |
| @figma-designer | @motion-designer | animation brief per transizioni |
