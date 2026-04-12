---
name: tailwind
description: Tailwind CSS 4 knowledge base - utility classes, configuration, best practices. Use when styling components, configuring design tokens, implementing responsive layouts, or managing dark mode.
version: 1.0.0
---

# Tailwind CSS 4 Knowledge Base

## Setup

```bash
npm install tailwindcss @tailwindcss/postcss postcss
```

```javascript
// postcss.config.js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

```css
/* globals.css */
@import 'tailwindcss';
```

## Configuration (CSS-first in v4)

```css
/* globals.css */
@import 'tailwindcss';

@theme {
  --color-primary: #3b82f6;
  --color-secondary: #10b981;
  --font-display: "Inter", sans-serif;
  --breakpoint-3xl: 1920px;
}
```

## cn() Utility (Merge Classes Safely)

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Usage
<div className={cn(
  'base-classes',
  condition && 'conditional-classes',
  className
)}>
```

## Best Practices

1. **Mobile-first** - Start with mobile, add breakpoints (sm, md, lg, xl)
2. **Use cn()** - Merge classes safely to avoid conflicts
3. **Design tokens** - Use CSS variables for consistency
4. **Consistent spacing** - Stick to scale (4, 8, 12, 16, 20, 24...)
5. **Dark mode** - Always add dark: variants for theme support
