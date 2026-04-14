---
name: nuxt
description: Nuxt 3 knowledge base - Vue 3, Composition API, Nitro server, auto-imports. Use when working on a Nuxt project, building Vue 3 applications, or implementing SSR/SSG with Nuxt.
version: 1.0.0
---

# Nuxt 3 Knowledge Base

## Setup

```bash
npx nuxi@latest init my-app
cd my-app
npm install
```

## Project Structure

```
├── app.vue
├── nuxt.config.ts
├── pages/
│   ├── index.vue
│   ├── [locale]/
│   │   └── index.vue
│   └── about.vue
├── components/
│   ├── Header.vue
│   └── Footer.vue
├── composables/
│   └── useAuth.ts
├── server/
│   ├── api/
│   │   └── contact.post.ts
│   └── middleware/
├── layouts/
│   └── default.vue
└── i18n/
    └── locales/
```

## Pages

```vue
<!-- pages/[locale]/index.vue -->
<script setup lang="ts">
const { locale } = useRoute().params;
const { t } = useI18n();

// Fetch data
const { data: posts } = await useFetch('/api/posts');
</script>

<template>
  <div>
    <h1>{{ t('home.title') }}</h1>
    <div v-for="post in posts" :key="post.id">
      {{ post.title }}
    </div>
  </div>
</template>
```

## Data Fetching

```vue
<script setup lang="ts">
// useFetch - SSR friendly
const { data, pending, error, refresh } = await useFetch('/api/posts');

// useAsyncData - More control
const { data } = await useAsyncData('posts', () => {
  return $fetch('/api/posts');
});

// Lazy loading
const { data } = useLazyFetch('/api/posts');
</script>
```

## Server API

```typescript
// server/api/contact.post.ts
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  message: z.string().min(10),
});

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const data = schema.parse(body);
  
  // Process...
  
  return { success: true };
});
```

## Composables

```typescript
// composables/useAuth.ts
export function useAuth() {
  const user = useState<User | null>('user', () => null);
  
  async function login(email: string, password: string) {
    const data = await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    user.value = data.user;
  }
  
  function logout() {
    user.value = null;
  }
  
  return { user, login, logout };
}
```

## Layouts

```vue
<!-- layouts/default.vue -->
<template>
  <div>
    <Header />
    <main>
      <slot />
    </main>
    <Footer />
  </div>
</template>
```

```vue
<!-- pages/about.vue -->
<script setup>
definePageMeta({
  layout: 'default',
});
</script>
```

## Middleware

```typescript
// middleware/auth.ts
export default defineNuxtRouteMiddleware((to, from) => {
  const { user } = useAuth();
  
  if (!user.value && to.path !== '/login') {
    return navigateTo('/login');
  }
});
```

## Config

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxtjs/i18n',
  ],
  i18n: {
    locales: ['it', 'en', 'cs'],
    defaultLocale: 'it',
  },
  app: {
    head: {
      title: 'My App',
    },
  },
});
```

## Best Practices

1. **Auto-imports** - Components, composables auto-imported
2. **useFetch** - For SSR data fetching
3. **Server routes** - /server/api for backend
4. **Composables** - Reusable logic
5. **Nitro** - Universal deployment
