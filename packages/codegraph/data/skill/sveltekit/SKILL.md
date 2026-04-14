---
name: sveltekit
description: SvelteKit knowledge base - routing, load functions, Svelte 5 runes, best practices. Use when working on a SvelteKit project, implementing Svelte 5 runes, or building SSR/SSG with SvelteKit.
version: 1.0.0
---

# SvelteKit Knowledge Base

## Setup

```bash
npm create svelte@latest my-app
# Select: Skeleton, TypeScript, ESLint, Prettier
cd my-app
npm install
```

## Project Structure

```
src/
├── routes/
│   ├── +layout.svelte
│   ├── +page.svelte
│   ├── +page.ts            # Load function
│   ├── +page.server.ts     # Server load
│   ├── [locale]/
│   │   ├── +layout.svelte
│   │   └── +page.svelte
│   └── api/
│       └── contact/
│           └── +server.ts
├── lib/
│   ├── components/
│   └── utils.ts
├── app.html
└── app.css
```

## Svelte 5 Runes

```svelte
<script lang="ts">
  // State
  let count = $state(0);
  
  // Derived state
  let doubled = $derived(count * 2);
  
  // Props
  let { name, onClick }: { name: string; onClick: () => void } = $props();
  
  // Effect
  $effect(() => {
    console.log('count changed:', count);
  });
</script>

<button onclick={() => count++}>
  {count} (doubled: {doubled})
</button>
```

## Load Functions

```typescript
// +page.ts (runs on client and server)
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
  const res = await fetch(`/api/posts/${params.slug}`);
  const post = await res.json();
  
  return { post };
};
```

```typescript
// +page.server.ts (server only - can access DB)
import type { PageServerLoad } from './$types';
import { db } from '$lib/db';

export const load: PageServerLoad = async ({ params }) => {
  const post = await db.posts.findUnique({
    where: { slug: params.slug }
  });
  
  return { post };
};
```

## Form Actions

```typescript
// +page.server.ts
import type { Actions } from './$types';
import { fail } from '@sveltejs/kit';

export const actions: Actions = {
  default: async ({ request }) => {
    const data = await request.formData();
    const email = data.get('email');
    
    if (!email) {
      return fail(400, { email, missing: true });
    }
    
    // Process...
    
    return { success: true };
  }
};
```

```svelte
<!-- +page.svelte -->
<script lang="ts">
  import { enhance } from '$app/forms';
  
  let { form } = $props();
</script>

<form method="POST" use:enhance>
  <input name="email" value={form?.email ?? ''}>
  {#if form?.missing}
    <p class="error">Email required</p>
  {/if}
  <button>Submit</button>
</form>
```

## API Routes

```typescript
// src/routes/api/contact/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  const data = await request.json();
  
  // Process...
  
  return json({ success: true });
};
```

## Layouts

```svelte
<!-- +layout.svelte -->
<script lang="ts">
  import { page } from '$app/stores';
  
  let { children } = $props();
</script>

<nav>
  <a href="/" class:active={$page.url.pathname === '/'}>Home</a>
</nav>

<main>
  {@render children()}
</main>
```

## Hooks

```typescript
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  // Auth check, locale detection, etc.
  const locale = event.cookies.get('locale') || 'it';
  event.locals.locale = locale;
  
  return resolve(event);
};
```

## Best Practices

1. **Use Runes** - $state, $derived, $effect
2. **Server load** - For sensitive data
3. **Form actions** - For mutations
4. **Progressive enhancement** - use:enhance
5. **Preloading** - data-sveltekit-preload-data
