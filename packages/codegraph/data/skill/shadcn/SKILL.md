---
name: shadcn
description: shadcn/ui knowledge base - installation, components, theming, MCP server integration. Use when building UI components, searching component registry, implementing accessible patterns, or customizing component styles.
version: 1.0.0
---

# shadcn/ui Knowledge Base

## Installation

```bash
npx shadcn@latest init
```

Configuration prompts:
- Style: Default
- Base color: Slate
- CSS variables: Yes

## Add Components

```bash
# Single component
npx shadcn@latest add button

# Multiple components
npx shadcn@latest add button card dialog form input

# All components
npx shadcn@latest add --all
```

## MCP Server Integration

```json
// .mcp.json
{
  "mcpServers": {
    "shadcn": {
      "command": "npx",
      "args": ["shadcn@latest", "mcp"]
    }
  }
}
```

**MCP Commands:**
- "Add button, card, and dialog components"
- "Find a login form from shadcn registry"
- "Install all form components"

## Component Categories

### Forms
- Button, Input, Textarea, Select, Checkbox, Radio Group
- Switch, Slider, Toggle, Form (with react-hook-form)
- Label, Calendar, Date Picker

### Feedback
- Alert, Alert Dialog, Toast, Sonner
- Progress, Skeleton, Badge, Avatar

### Layout
- Card, Separator, Accordion, Collapsible
- Tabs, Sheet, Scroll Area, Resizable

### Navigation
- Navigation Menu, Menubar, Dropdown Menu
- Context Menu, Command, Breadcrumb, Pagination

### Overlay
- Dialog, Drawer, Popover, Tooltip, Hover Card

### Data Display
- Table, Data Table, Carousel, Aspect Ratio

## Theming with CSS Variables

shadcn/ui uses CSS variables for theming. Configure in `globals.css`:

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    /* ... other variables */
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    /* ... dark variants */
  }
}
```

## cn() Utility (Merge Classes Safely)

```typescript
// lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

## Best Practices

1. **Copy, don't wrap** - Own your components, don't create wrappers
2. **Use cn()** - For conditional classes
3. **Extend variants** - With cva() for custom variants
4. **Accessibility** - Built on Radix primitives (ARIA compliant)
5. **Dark mode** - Use CSS variables for theme switching
