---
name: state
description: State management knowledge base - Zustand, TanStack Query, React Context, optimistic updates. Use when managing client state, implementing server state with caching, or choosing a state management solution.
version: 1.0.0
---

# State Management Skill

Knowledge base per gestione stato in applicazioni React/Next.js moderne.

## Zustand (Raccomandato)

Leggero, semplice, TypeScript-first.

### Installazione

```bash
pnpm add zustand
```

### Store Base

```typescript
// stores/counter-store.ts
import { create } from 'zustand'

interface CounterState {
  count: number
  increment: () => void
  decrement: () => void
  reset: () => void
  incrementBy: (amount: number) => void
}

export const useCounterStore = create<CounterState>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
  reset: () => set({ count: 0 }),
  incrementBy: (amount) => set((state) => ({ count: state.count + amount })),
}))
```

### Store Complesso con Slices

```typescript
// stores/app-store.ts
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

// Types
interface User {
  id: string
  name: string
  email: string
  avatar?: string
}

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
}

interface AppState {
  // User slice
  user: User | null
  isAuthenticated: boolean
  setUser: (user: User | null) => void
  logout: () => void

  // Cart slice
  cart: CartItem[]
  addToCart: (item: Omit<CartItem, 'quantity'>) => void
  removeFromCart: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  cartTotal: () => number

  // UI slice
  theme: 'light' | 'dark' | 'system'
  sidebarOpen: boolean
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  toggleSidebar: () => void
}

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      immer((set, get) => ({
        // User slice
        user: null,
        isAuthenticated: false,
        setUser: (user) =>
          set((state) => {
            state.user = user
            state.isAuthenticated = !!user
          }),
        logout: () =>
          set((state) => {
            state.user = null
            state.isAuthenticated = false
            state.cart = []
          }),

        // Cart slice
        cart: [],
        addToCart: (item) =>
          set((state) => {
            const existing = state.cart.find((i) => i.id === item.id)
            if (existing) {
              existing.quantity += 1
            } else {
              state.cart.push({ ...item, quantity: 1 })
            }
          }),
        removeFromCart: (id) =>
          set((state) => {
            state.cart = state.cart.filter((item) => item.id !== id)
          }),
        updateQuantity: (id, quantity) =>
          set((state) => {
            const item = state.cart.find((i) => i.id === id)
            if (item) {
              item.quantity = Math.max(0, quantity)
              if (item.quantity === 0) {
                state.cart = state.cart.filter((i) => i.id !== id)
              }
            }
          }),
        clearCart: () =>
          set((state) => {
            state.cart = []
          }),
        cartTotal: () => {
          return get().cart.reduce(
            (total, item) => total + item.price * item.quantity,
            0
          )
        },

        // UI slice
        theme: 'system',
        sidebarOpen: true,
        setTheme: (theme) =>
          set((state) => {
            state.theme = theme
          }),
        toggleSidebar: () =>
          set((state) => {
            state.sidebarOpen = !state.sidebarOpen
          }),
      })),
      {
        name: 'app-storage',
        partialize: (state) => ({
          theme: state.theme,
          cart: state.cart,
        }),
      }
    ),
    { name: 'AppStore' }
  )
)
```

### Selectors Ottimizzati

```typescript
// Selectors per evitare re-render
import { useShallow } from 'zustand/react/shallow'

// Singolo valore
const count = useCounterStore((state) => state.count)

// Multipli valori con useShallow
const { user, isAuthenticated } = useAppStore(
  useShallow((state) => ({
    user: state.user,
    isAuthenticated: state.isAuthenticated,
  }))
)

// Solo actions (non causano re-render)
const { addToCart, removeFromCart } = useAppStore(
  useShallow((state) => ({
    addToCart: state.addToCart,
    removeFromCart: state.removeFromCart,
  }))
)
```

### Store con Async Actions

```typescript
// stores/products-store.ts
import { create } from 'zustand'

interface Product {
  id: string
  name: string
  price: number
}

interface ProductsState {
  products: Product[]
  isLoading: boolean
  error: string | null
  fetchProducts: () => Promise<void>
  addProduct: (product: Omit<Product, 'id'>) => Promise<void>
}

export const useProductsStore = create<ProductsState>((set, get) => ({
  products: [],
  isLoading: false,
  error: null,

  fetchProducts: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch('/api/products')
      if (!response.ok) throw new Error('Failed to fetch')
      const products = await response.json()
      set({ products, isLoading: false })
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  addProduct: async (product) => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product),
      })
      if (!response.ok) throw new Error('Failed to create')
      const newProduct = await response.json()
      set((state) => ({
        products: [...state.products, newProduct],
        isLoading: false,
      }))
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },
}))
```

## TanStack Query (React Query)

Per server state e data fetching.

### Installazione

```bash
pnpm add @tanstack/react-query @tanstack/react-query-devtools
```

### Setup Provider

```typescript
// app/providers.tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minuto
            gcTime: 5 * 60 * 1000, // 5 minuti (ex cacheTime)
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}

// app/layout.tsx
import { QueryProvider } from './providers'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
```

### Queries

```typescript
// hooks/use-products.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// Types
interface Product {
  id: string
  name: string
  price: number
  category: string
}

// API functions
const api = {
  getProducts: async (category?: string): Promise<Product[]> => {
    const url = category 
      ? `/api/products?category=${category}` 
      : '/api/products'
    const res = await fetch(url)
    if (!res.ok) throw new Error('Failed to fetch products')
    return res.json()
  },

  getProduct: async (id: string): Promise<Product> => {
    const res = await fetch(`/api/products/${id}`)
    if (!res.ok) throw new Error('Product not found')
    return res.json()
  },

  createProduct: async (data: Omit<Product, 'id'>): Promise<Product> => {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to create product')
    return res.json()
  },

  updateProduct: async ({ id, ...data }: Product): Promise<Product> => {
    const res = await fetch(`/api/products/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to update product')
    return res.json()
  },

  deleteProduct: async (id: string): Promise<void> => {
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete product')
  },
}

// Query Keys
export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (filters: string) => [...productKeys.lists(), { filters }] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (id: string) => [...productKeys.details(), id] as const,
}

// Hooks
export function useProducts(category?: string) {
  return useQuery({
    queryKey: productKeys.list(category || 'all'),
    queryFn: () => api.getProducts(category),
  })
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: productKeys.detail(id),
    queryFn: () => api.getProduct(id),
    enabled: !!id, // Solo se id è presente
  })
}

export function useCreateProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: api.createProduct,
    onSuccess: () => {
      // Invalida la cache dei prodotti
      queryClient.invalidateQueries({ queryKey: productKeys.lists() })
    },
  })
}

export function useUpdateProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: api.updateProduct,
    onSuccess: (data) => {
      // Aggiorna cache singolo prodotto
      queryClient.setQueryData(productKeys.detail(data.id), data)
      // Invalida liste
      queryClient.invalidateQueries({ queryKey: productKeys.lists() })
    },
  })
}

export function useDeleteProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: api.deleteProduct,
    onSuccess: (_, id) => {
      // Rimuovi dalla cache
      queryClient.removeQueries({ queryKey: productKeys.detail(id) })
      // Invalida liste
      queryClient.invalidateQueries({ queryKey: productKeys.lists() })
    },
  })
}
```

### Uso nei Componenti

```typescript
'use client'

import { useProducts, useCreateProduct, useDeleteProduct } from '@/hooks/use-products'

export function ProductList() {
  const { data: products, isLoading, error } = useProducts()
  const createProduct = useCreateProduct()
  const deleteProduct = useDeleteProduct()

  if (isLoading) return <Skeleton />
  if (error) return <Error message={error.message} />

  return (
    <div>
      <Button
        onClick={() => createProduct.mutate({ name: 'New Product', price: 99 })}
        disabled={createProduct.isPending}
      >
        {createProduct.isPending ? 'Creating...' : 'Add Product'}
      </Button>

      <ul>
        {products?.map((product) => (
          <li key={product.id}>
            {product.name} - ${product.price}
            <Button
              variant="destructive"
              onClick={() => deleteProduct.mutate(product.id)}
              disabled={deleteProduct.isPending}
            >
              Delete
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

### Optimistic Updates

```typescript
export function useUpdateProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: api.updateProduct,
    
    // Optimistic update
    onMutate: async (newProduct) => {
      // Cancella query in corso
      await queryClient.cancelQueries({ 
        queryKey: productKeys.detail(newProduct.id) 
      })

      // Salva stato precedente
      const previousProduct = queryClient.getQueryData(
        productKeys.detail(newProduct.id)
      )

      // Aggiorna ottimisticamente
      queryClient.setQueryData(
        productKeys.detail(newProduct.id),
        newProduct
      )

      return { previousProduct }
    },

    // Rollback in caso di errore
    onError: (err, newProduct, context) => {
      queryClient.setQueryData(
        productKeys.detail(newProduct.id),
        context?.previousProduct
      )
    },

    // Invalida dopo successo/errore
    onSettled: (data) => {
      if (data) {
        queryClient.invalidateQueries({ 
          queryKey: productKeys.detail(data.id) 
        })
      }
    },
  })
}
```

### Infinite Query (Pagination)

```typescript
import { useInfiniteQuery } from '@tanstack/react-query'

export function useInfiniteProducts() {
  return useInfiniteQuery({
    queryKey: ['products', 'infinite'],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await fetch(`/api/products?offset=${pageParam}&limit=10`)
      return res.json()
    },
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.length < 10) return undefined
      return pages.length * 10
    },
    initialPageParam: 0,
  })
}

// Component
function InfiniteProductList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteProducts()

  return (
    <>
      {data?.pages.map((page, i) => (
        <Fragment key={i}>
          {page.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </Fragment>
      ))}
      
      <Button
        onClick={() => fetchNextPage()}
        disabled={!hasNextPage || isFetchingNextPage}
      >
        {isFetchingNextPage ? 'Loading...' : hasNextPage ? 'Load More' : 'No more'}
      </Button>
    </>
  )
}
```

## Zustand + TanStack Query Insieme

```typescript
// stores/ui-store.ts (client state con Zustand)
export const useUIStore = create<UIState>((set) => ({
  theme: 'system',
  sidebarOpen: true,
  setTheme: (theme) => set({ theme }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}))

// hooks/use-products.ts (server state con TanStack Query)
export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  })
}

// Component usa entrambi
function Dashboard() {
  // Client state
  const { sidebarOpen, toggleSidebar } = useUIStore()
  
  // Server state
  const { data: products, isLoading } = useProducts()

  return (
    <div className={sidebarOpen ? 'with-sidebar' : ''}>
      <Sidebar open={sidebarOpen} onToggle={toggleSidebar} />
      <ProductList products={products} loading={isLoading} />
    </div>
  )
}
```

## React Context (Casi Semplici)

```typescript
// contexts/theme-context.tsx
'use client'

import { createContext, useContext, useState, useEffect } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'light' | 'dark'
}

const ThemeContext = createContext<ThemeContextType | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('system')
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme
    if (stored) setTheme(stored)
  }, [])

  useEffect(() => {
    localStorage.setItem('theme', theme)
    
    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setResolvedTheme(isDark ? 'dark' : 'light')
    } else {
      setResolvedTheme(theme)
    }
    
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
  }, [theme, resolvedTheme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
```

## Quando Usare Cosa

| Scenario | Soluzione |
|----------|-----------|
| Server state (API data) | TanStack Query |
| Client UI state semplice | useState / Context |
| Client state complesso | Zustand |
| Form state | react-hook-form |
| URL state | nuqs / useSearchParams |
| Global theme/locale | Context o Zustand |

## Checklist State Management

- [ ] Zustand per client state complesso
- [ ] TanStack Query per server state
- [ ] Query keys organizzati in factory
- [ ] Selectors ottimizzati (useShallow)
- [ ] Persist middleware per dati locali
- [ ] DevTools configurati
- [ ] Optimistic updates per UX
- [ ] Error boundaries per errori query
- [ ] Loading states gestiti
- [ ] Cache invalidation corretta
