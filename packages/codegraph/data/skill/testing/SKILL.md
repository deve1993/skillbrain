---
name: testing
description: Testing knowledge base - Vitest, Playwright, Testing Library, accessibility testing. Use when setting up a test suite, writing unit/E2E tests, implementing visual regression tests, or testing accessibility.
version: 1.0.0
---

# Testing Knowledge Base

## Vitest Setup

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      thresholds: { global: { lines: 80 } },
    },
  },
});
```

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());
```

## Unit Tests

```typescript
// utils.test.ts
import { describe, it, expect } from 'vitest';
import { formatPrice } from './utils';

describe('formatPrice', () => {
  it('formats EUR correctly', () => {
    expect(formatPrice(1234.56)).toBe('1.234,56 €');
  });

  it('handles zero', () => {
    expect(formatPrice(0)).toBe('0,00 €');
  });
});
```

## Component Tests

```tsx
// Button.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('renders correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    
    await userEvent.click(screen.getByRole('button'));
    
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is disabled when loading', () => {
    render(<Button isLoading>Submit</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

## Playwright E2E

```bash
npm install -D @playwright/test
npx playwright install
```

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
  },
});
```

```typescript
// e2e/contact.spec.ts
import { test, expect } from '@playwright/test';

test('contact form submission', async ({ page }) => {
  await page.goto('/contact');
  
  await page.getByLabel(/nome/i).fill('Mario Rossi');
  await page.getByLabel(/email/i).fill('mario@test.com');
  await page.getByLabel(/messaggio/i).fill('Test message');
  
  await page.getByRole('button', { name: /invia/i }).click();
  
  await expect(page.getByText(/inviato/i)).toBeVisible();
});
```

## Visual Testing

```typescript
// e2e/visual.spec.ts
import { test, expect } from '@playwright/test';

test('homepage visual', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot('homepage.png', {
    maxDiffPixels: 100,
  });
});
```

## Accessibility Testing

```typescript
// e2e/a11y.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('homepage accessibility', async ({ page }) => {
  await page.goto('/');
  
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2aa'])
    .analyze();
  
  expect(results.violations).toEqual([]);
});
```

## Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:a11y": "playwright test --grep @a11y"
  }
}
```
