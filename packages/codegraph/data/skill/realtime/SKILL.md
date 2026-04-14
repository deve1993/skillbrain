---
name: realtime
description: Real-time features in Next.js — Server-Sent Events, WebSockets with Socket.io, Pusher/Ably, Supabase Realtime, live notifications, chat, presence, collaborative editing. Use when building live updates, chat, notifications, presence tracking, or collaborative features.
version: 1.0.0
---

# Real-Time Features — Next.js

## 1. Server-Sent Events (SSE)

### Route Handler (Server)

```ts
// app/api/events/route.ts
export const runtime = 'nodejs' // SSE needs long-lived connections

export async function GET(req: Request) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`))

      // Example: listen to an event emitter
      const handler = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      eventEmitter.on('update', handler)

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(': heartbeat\n\n'))
      }, 30000)

      // Cleanup on client disconnect
      req.signal.addEventListener('abort', () => {
        eventEmitter.off('update', handler)
        clearInterval(heartbeat)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
```

### Client Hook

```tsx
// hooks/use-event-source.ts
'use client'
import { useEffect, useRef, useCallback } from 'react'

export function useEventSource<T>(
  url: string,
  onMessage: (data: T) => void,
  options?: { enabled?: boolean }
) {
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  useEffect(() => {
    if (options?.enabled === false) return

    const es = new EventSource(url)

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as T
        onMessageRef.current(data)
      } catch {}
    }

    es.onerror = () => {
      es.close()
      // Auto-reconnect after 3s
      setTimeout(() => {
        // EventSource auto-reconnects, but we can force it
      }, 3000)
    }

    return () => es.close()
  }, [url, options?.enabled])
}

// Usage
function Dashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)

  useEventSource<Metrics>('/api/events', (data) => {
    setMetrics(data)
  })

  return <MetricsDisplay data={metrics} />
}
```

## 2. Socket.io with Next.js

### Custom Server

```ts
// server.ts
import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { Server as SocketServer } from 'socket.io'

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res, parse(req.url!, true))
  })

  // Redis adapter for horizontal scaling
  const { createAdapter } = await import('@socket.io/redis-adapter')
  const { createClient } = await import('redis')
  const pubClient = createClient({ url: process.env.REDIS_URL })
  const subClient = pubClient.duplicate()
  await Promise.all([pubClient.connect(), subClient.connect()])

  const io = new SocketServer(server, {
    cors: { origin: process.env.NEXT_PUBLIC_APP_URL },
    adapter: createAdapter(pubClient, subClient),
  })

  // Auth middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token
    try {
      const user = await verifyToken(token)
      socket.data.user = user
      next()
    } catch {
      next(new Error('Unauthorized'))
    }
  })

  // Namespaces
  const chat = io.of('/chat')
  chat.on('connection', (socket) => {
    const userId = socket.data.user.id

    // Join user's rooms
    socket.join(`user:${userId}`)

    socket.on('join-room', (roomId: string) => {
      socket.join(`room:${roomId}`)
      chat.to(`room:${roomId}`).emit('user-joined', { userId })
    })

    socket.on('message', async (data: { roomId: string; content: string }) => {
      const message = await saveMessage(data) // persist to DB
      chat.to(`room:${data.roomId}`).emit('new-message', message)
    })

    socket.on('typing', (roomId: string) => {
      socket.to(`room:${roomId}`).emit('user-typing', { userId })
    })

    socket.on('disconnect', () => {
      chat.emit('user-left', { userId })
    })
  })

  server.listen(3000, () => console.log('> Ready on http://localhost:3000'))
})
```

### Client Hook

```tsx
// hooks/use-socket.ts
'use client'
import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'

export function useSocket(namespace = '/') {
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const socket = io(namespace, {
      auth: { token: getAuthToken() },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })

    socket.on('connect', () => setIsConnected(true))
    socket.on('disconnect', () => setIsConnected(false))

    socketRef.current = socket

    return () => { socket.disconnect() }
  }, [namespace])

  return { socket: socketRef.current, isConnected }
}

// Usage: Chat
function ChatRoom({ roomId }: { roomId: string }) {
  const { socket, isConnected } = useSocket('/chat')
  const [messages, setMessages] = useState<Message[]>([])

  useEffect(() => {
    if (!socket) return
    socket.emit('join-room', roomId)
    socket.on('new-message', (msg) => setMessages((prev) => [...prev, msg]))
    return () => { socket.off('new-message') }
  }, [socket, roomId])

  function send(content: string) {
    socket?.emit('message', { roomId, content })
  }

  return (
    <div>
      <div className={isConnected ? 'text-green-500' : 'text-red-500'}>
        {isConnected ? 'Connected' : 'Disconnected'}
      </div>
      {messages.map((m) => <MessageBubble key={m.id} message={m} />)}
      <ChatInput onSend={send} />
    </div>
  )
}
```

## 3. Pusher (Managed WebSocket)

```bash
pnpm add pusher pusher-js
```

```ts
// lib/pusher/server.ts
import Pusher from 'pusher'

export const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
})

// Trigger from Server Action or API route
export async function notifyUser(userId: string, event: string, data: any) {
  await pusher.trigger(`private-user-${userId}`, event, data)
}
```

```tsx
// hooks/use-pusher.ts
'use client'
import PusherClient from 'pusher-js'
import { useEffect, useRef } from 'react'

const pusherClient = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  authEndpoint: '/api/pusher/auth',
})

export function usePusherChannel(channelName: string, event: string, callback: (data: any) => void) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    const channel = pusherClient.subscribe(channelName)
    channel.bind(event, (data: any) => callbackRef.current(data))
    return () => {
      channel.unbind(event)
      pusherClient.unsubscribe(channelName)
    }
  }, [channelName, event])
}
```

## 4. Supabase Realtime

```bash
pnpm add @supabase/supabase-js
```

```tsx
'use client'
import { createBrowserClient } from '@supabase/ssr'
import { useEffect, useState } from 'react'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

// Listen to DB changes
function LiveOrders() {
  const [orders, setOrders] = useState<Order[]>([])

  useEffect(() => {
    // Initial fetch
    supabase.from('orders').select('*').order('created_at', { ascending: false })
      .then(({ data }) => setOrders(data || []))

    // Subscribe to changes
    const channel = supabase
      .channel('orders-changes')
      .on('postgres_changes', {
        event: '*', // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'orders',
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setOrders((prev) => [payload.new as Order, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setOrders((prev) => prev.map((o) =>
            o.id === payload.new.id ? payload.new as Order : o
          ))
        } else if (payload.eventType === 'DELETE') {
          setOrders((prev) => prev.filter((o) => o.id !== payload.old.id))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return <OrderList orders={orders} />
}

// Presence (online users)
function OnlineUsers({ roomId }: { roomId: string }) {
  const [users, setUsers] = useState<any[]>([])

  useEffect(() => {
    const channel = supabase.channel(`room:${roomId}`)

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        setUsers(Object.values(state).flat())
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: currentUser.id, name: currentUser.name })
        }
      })

    return () => { supabase.removeChannel(channel) }
  }, [roomId])

  return (
    <div className="flex -space-x-2">
      {users.map((u) => <Avatar key={u.user_id} name={u.name} />)}
    </div>
  )
}
```

## 5. Live Notifications Pattern

```tsx
// components/notification-provider.tsx
'use client'
import { createContext, useContext, useState, useCallback } from 'react'
import { useEventSource } from '@/hooks/use-event-source'
import { toast } from 'sonner'

const NotificationContext = createContext<{
  unreadCount: number
  notifications: Notification[]
  markRead: (id: string) => void
} | null>(null)

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEventSource<Notification>('/api/notifications/stream', (notification) => {
    setNotifications((prev) => [notification, ...prev])
    toast(notification.title, { description: notification.body })
  })

  const markRead = useCallback(async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
    setNotifications((prev) => prev.map((n) =>
      n.id === id ? { ...n, read: true } : n
    ))
  }, [])

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <NotificationContext.Provider value={{ unreadCount, notifications, markRead }}>
      {children}
    </NotificationContext.Provider>
  )
}

export const useNotifications = () => useContext(NotificationContext)!
```

## 6. Decision Matrix

| Solution | Latency | Scaling | Cost | Best For |
|----------|---------|---------|------|----------|
| **SSE** | Low | Single server | Free | Dashboard updates, notifications, progress |
| **Socket.io** | Lowest | Redis adapter | Server cost | Chat, gaming, bidirectional |
| **Pusher** | Low | Managed | Per-message | Quick setup, moderate traffic |
| **Ably** | Low | Managed | Per-message | Global presence, high reliability |
| **Supabase RT** | Low | Managed | Included plan | Already using Supabase, DB-driven updates |

### When to Use What

```
One-way updates (server → client)?
├── Yes → SSE (simplest, free)
└── No (bidirectional)
    ├── Need managed service? → Pusher or Ably
    ├── Already using Supabase? → Supabase Realtime
    └── Self-hosted, full control? → Socket.io + Redis adapter
```
