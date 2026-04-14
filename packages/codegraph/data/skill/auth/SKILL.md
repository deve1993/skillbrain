---
name: auth
description: Authentication and authorization knowledge base - Auth.js v5, OAuth, credentials, JWT, RBAC. Use when implementing authentication, login, registration, session management, or role-based access control.
version: 1.0.0
---

# Authentication Skill

Knowledge base per autenticazione e autorizzazione in applicazioni frontend moderne.

## Auth.js (NextAuth.js v5)

### Installazione

```bash
pnpm add next-auth@beta @auth/prisma-adapter
```

### Configurazione Base

```typescript
// auth.ts (root del progetto)
import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { db } from '@/lib/db'
import Google from 'next-auth/providers/google'
import GitHub from 'next-auth/providers/github'
import Credentials from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: 'jwt' },
  
  pages: {
    signIn: '/login',
    signOut: '/logout',
    error: '/auth/error',
    verifyRequest: '/auth/verify',
  },
  
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user || !user.password) {
          return null
        }

        const isValid = await compare(
          credentials.password as string,
          user.password
        )

        if (!isValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatar,
          role: user.role,
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      
      // Update session
      if (trigger === 'update' && session) {
        token.name = session.name
      }
      
      return token
    },
    
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    },
    
    async signIn({ user, account, profile }) {
      // Custom sign in logic
      // Return false to deny access
      return true
    },
    
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard')
      const isOnAdmin = nextUrl.pathname.startsWith('/admin')
      
      if (isOnAdmin) {
        if (isLoggedIn && auth.user.role === 'ADMIN') return true
        return Response.redirect(new URL('/login', nextUrl))
      }
      
      if (isOnDashboard) {
        if (isLoggedIn) return true
        return false // Redirect to login
      }
      
      return true
    },
  },
})
```

### Route Handlers

```typescript
// app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/auth'
export const { GET, POST } = handlers
```

### Middleware

```typescript
// middleware.ts
import { auth } from '@/auth'

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth

  // Protezione routes
  const protectedRoutes = ['/dashboard', '/settings', '/profile']
  const isProtected = protectedRoutes.some(route => 
    nextUrl.pathname.startsWith(route)
  )

  if (isProtected && !isLoggedIn) {
    return Response.redirect(new URL('/login', nextUrl))
  }

  // Redirect logged users from auth pages
  const authRoutes = ['/login', '/register']
  const isAuthRoute = authRoutes.includes(nextUrl.pathname)
  
  if (isAuthRoute && isLoggedIn) {
    return Response.redirect(new URL('/dashboard', nextUrl))
  }
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
```

### Types Estesi

```typescript
// types/next-auth.d.ts
import { DefaultSession, DefaultUser } from 'next-auth'
import { JWT, DefaultJWT } from 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: string
    } & DefaultSession['user']
  }

  interface User extends DefaultUser {
    role: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string
    role: string
  }
}
```

### Prisma Schema per Auth

```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  password      String?   // Per credentials
  role          Role      @default(USER)
  accounts      Account[]
  sessions      Session[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

enum Role {
  USER
  ADMIN
  EDITOR
}
```

## Client Components

### useSession Hook

```typescript
'use client'

import { useSession, signIn, signOut } from 'next-auth/react'

export function UserMenu() {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return <Skeleton className="h-10 w-10 rounded-full" />
  }

  if (!session) {
    return (
      <Button onClick={() => signIn()}>
        Sign In
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Avatar>
          <AvatarImage src={session.user.image} />
          <AvatarFallback>{session.user.name?.[0]}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>
          <Link href="/profile">Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => signOut()}>
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

### Session Provider

```typescript
// app/providers.tsx
'use client'

import { SessionProvider } from 'next-auth/react'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
    </SessionProvider>
  )
}

// app/layout.tsx
import { Providers } from './providers'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

## Server Components & Actions

### Get Session Server-Side

```typescript
// app/dashboard/page.tsx
import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const session = await auth()
  
  if (!session) {
    redirect('/login')
  }

  return (
    <div>
      <h1>Welcome, {session.user.name}</h1>
      <p>Role: {session.user.role}</p>
    </div>
  )
}
```

### Server Actions

```typescript
// app/actions/auth.ts
'use server'

import { signIn, signOut } from '@/auth'
import { db } from '@/lib/db'
import { hash } from 'bcryptjs'
import { z } from 'zod'

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
})

export async function register(formData: FormData) {
  const validatedFields = registerSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!validatedFields.success) {
    return { error: 'Invalid fields' }
  }

  const { name, email, password } = validatedFields.data

  // Check if user exists
  const existingUser = await db.user.findUnique({
    where: { email },
  })

  if (existingUser) {
    return { error: 'Email already in use' }
  }

  // Create user
  const hashedPassword = await hash(password, 12)
  
  await db.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
    },
  })

  // Auto sign in after registration
  await signIn('credentials', {
    email,
    password,
    redirectTo: '/dashboard',
  })
}

export async function login(formData: FormData) {
  await signIn('credentials', {
    email: formData.get('email'),
    password: formData.get('password'),
    redirectTo: '/dashboard',
  })
}

export async function logout() {
  await signOut({ redirectTo: '/' })
}

export async function loginWithGoogle() {
  await signIn('google', { redirectTo: '/dashboard' })
}

export async function loginWithGitHub() {
  await signIn('github', { redirectTo: '/dashboard' })
}
```

## Authorization Patterns

### Role-Based Access Control (RBAC)

```typescript
// lib/auth.ts
import { auth } from '@/auth'

export async function getCurrentUser() {
  const session = await auth()
  return session?.user
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

export async function requireRole(roles: string[]) {
  const user = await requireAuth()
  if (!roles.includes(user.role)) {
    throw new Error('Forbidden')
  }
  return user
}

// Uso in Server Actions
export async function adminAction() {
  await requireRole(['ADMIN'])
  // ... admin logic
}
```

### Permission-Based

```typescript
// lib/permissions.ts
type Permission = 
  | 'posts:read'
  | 'posts:write'
  | 'posts:delete'
  | 'users:read'
  | 'users:write'
  | 'users:delete'

const rolePermissions: Record<string, Permission[]> = {
  USER: ['posts:read'],
  EDITOR: ['posts:read', 'posts:write'],
  ADMIN: ['posts:read', 'posts:write', 'posts:delete', 'users:read', 'users:write', 'users:delete'],
}

export function hasPermission(role: string, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false
}

export async function requirePermission(permission: Permission) {
  const user = await requireAuth()
  if (!hasPermission(user.role, permission)) {
    throw new Error('Forbidden')
  }
  return user
}
```

## JWT Tokens (API Custom)

```typescript
// lib/jwt.ts
import { SignJWT, jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET!)

export async function signToken(payload: any, expiresIn = '7d') {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret)
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload
  } catch {
    return null
  }
}

// Refresh token rotation
export async function refreshTokens(refreshToken: string) {
  const payload = await verifyToken(refreshToken)
  if (!payload) return null

  const newAccessToken = await signToken({ userId: payload.userId }, '15m')
  const newRefreshToken = await signToken({ userId: payload.userId }, '7d')

  return { accessToken: newAccessToken, refreshToken: newRefreshToken }
}
```

## Security Best Practices

### 1. Password Hashing

```typescript
import { hash, compare } from 'bcryptjs'

// Hash password (registration)
const hashedPassword = await hash(password, 12)

// Verify password (login)
const isValid = await compare(inputPassword, hashedPassword)
```

### 2. Rate Limiting

```typescript
// lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '1 m'), // 5 requests per minute
})

export async function checkRateLimit(identifier: string) {
  const { success, limit, reset, remaining } = await ratelimit.limit(identifier)
  
  if (!success) {
    throw new Error('Too many requests')
  }
  
  return { limit, reset, remaining }
}
```

### 3. CSRF Protection

```typescript
// Auth.js ha CSRF built-in
// Per API custom:
import { csrf } from '@/lib/csrf'

export async function POST(req: Request) {
  const token = req.headers.get('x-csrf-token')
  if (!csrf.verify(token)) {
    return Response.json({ error: 'Invalid CSRF token' }, { status: 403 })
  }
  // ... handle request
}
```

### 4. Secure Cookies

```typescript
// next.config.js
const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
]
```

## Environment Variables

```env
# .env.local
AUTH_SECRET="your-secret-key-min-32-chars"

# OAuth Providers
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

GITHUB_CLIENT_ID="..."
GITHUB_CLIENT_SECRET="..."

# Database
DATABASE_URL="postgresql://..."

# JWT (se usi custom)
JWT_SECRET="your-jwt-secret-min-32-chars"
```

## Checklist Autenticazione

- [ ] Auth.js configurato con providers
- [ ] Prisma schema con modelli User, Account, Session
- [ ] Middleware per protezione routes
- [ ] Types estesi per session
- [ ] Server actions per login/register/logout
- [ ] RBAC o permission system
- [ ] Rate limiting su endpoints auth
- [ ] Password hashing con bcrypt
- [ ] CSRF protection attivo
- [ ] Environment variables sicure
- [ ] Redirect dopo login/logout configurati
