---
name: payments
description: Payments integration knowledge base - Stripe, LemonSqueezy, subscriptions, webhooks, checkout. Use when implementing payment processing, setting up subscriptions, handling webhooks, or integrating Stripe/LemonSqueezy.
version: 1.0.0
---

# Payments Skill

Knowledge base per integrazioni pagamenti in applicazioni frontend moderne.

## Provider Raccomandati

| Provider | Uso | Pricing |
|----------|-----|---------|
| **Stripe** | Pagamenti globali, subscriptions, marketplace | 2.9% + 30¢ |
| **LemonSqueezy** | SaaS, prodotti digitali (gestisce VAT EU) | 5% + 50¢ |
| **Paddle** | SaaS B2B, gestione fiscale completa | 5% + 50¢ |

---

## Stripe Integration

### Installazione

```bash
pnpm add stripe @stripe/stripe-js @stripe/react-stripe-js
```

### Setup Server-Side

```typescript
// lib/stripe.ts
import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
  typescript: true,
})
```

### Checkout Session (One-Time Payment)

```typescript
// app/api/checkout/route.ts
import { stripe } from '@/lib/stripe'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { priceId, userId } = await req.json()

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_URL}/pricing`,
      metadata: {
        userId,
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    return NextResponse.json(
      { error: 'Error creating checkout session' },
      { status: 500 }
    )
  }
}
```

### Subscription Checkout

```typescript
// app/api/subscribe/route.ts
import { stripe } from '@/lib/stripe'
import { auth } from '@/auth'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { priceId } = await req.json()

  // Get or create Stripe customer
  let customerId = await getStripeCustomerId(session.user.id)
  
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.user.email!,
      metadata: { userId: session.user.id },
    })
    customerId = customer.id
    await saveStripeCustomerId(session.user.id, customerId)
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_URL}/dashboard?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_URL}/pricing`,
    subscription_data: {
      metadata: { userId: session.user.id },
    },
  })

  return Response.json({ url: checkoutSession.url })
}
```

### Webhook Handler

```typescript
// app/api/webhooks/stripe/route.ts
import { stripe } from '@/lib/stripe'
import { headers } from 'next/headers'
import Stripe from 'stripe'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(req: Request) {
  const body = await req.text()
  const signature = headers().get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed')
    return new Response('Invalid signature', { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      
      if (session.mode === 'subscription') {
        await handleSubscriptionCreated(session)
      } else {
        await handleOneTimePayment(session)
      }
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      await updateSubscriptionStatus(subscription)
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      await cancelSubscription(subscription)
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      await handleFailedPayment(invoice)
      break
    }
  }

  return new Response('OK', { status: 200 })
}

async function handleSubscriptionCreated(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId
  const subscriptionId = session.subscription as string
  
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  
  await db.user.update({
    where: { id: userId },
    data: {
      stripeSubscriptionId: subscriptionId,
      stripePriceId: subscription.items.data[0].price.id,
      stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
      plan: 'PRO', // o deriva dal priceId
    },
  })
}
```

### Client Component

```typescript
'use client'

import { loadStripe } from '@stripe/stripe-js'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface CheckoutButtonProps {
  priceId: string
  mode: 'payment' | 'subscription'
}

export function CheckoutButton({ priceId, mode }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleCheckout = async () => {
    setLoading(true)
    
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      })

      const { url } = await response.json()
      window.location.href = url
    } catch (error) {
      console.error('Checkout error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={handleCheckout} disabled={loading}>
      {loading ? 'Loading...' : 'Subscribe'}
    </Button>
  )
}
```

### Customer Portal

```typescript
// app/api/portal/route.ts
import { stripe } from '@/lib/stripe'
import { auth } from '@/auth'

export async function POST() {
  const session = await auth()
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const customerId = await getStripeCustomerId(session.user.id)
  
  if (!customerId) {
    return new Response('No customer found', { status: 404 })
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_URL}/dashboard`,
  })

  return Response.json({ url: portalSession.url })
}
```

---

## LemonSqueezy Integration

Ideale per SaaS che vendono in EU (gestione automatica VAT).

### Installazione

```bash
pnpm add @lemonsqueezy/lemonsqueezy.js
```

### Setup

```typescript
// lib/lemonsqueezy.ts
import { lemonSqueezySetup } from '@lemonsqueezy/lemonsqueezy.js'

export function configureLemonSqueezy() {
  lemonSqueezySetup({
    apiKey: process.env.LEMONSQUEEZY_API_KEY!,
    onError: (error) => console.error('LemonSqueezy error:', error),
  })
}
```

### Checkout

```typescript
// app/api/lemon/checkout/route.ts
import { createCheckout } from '@lemonsqueezy/lemonsqueezy.js'
import { configureLemonSqueezy } from '@/lib/lemonsqueezy'

export async function POST(req: Request) {
  configureLemonSqueezy()
  
  const { variantId, userId, email } = await req.json()

  const checkout = await createCheckout(
    process.env.LEMONSQUEEZY_STORE_ID!,
    variantId,
    {
      checkoutData: {
        email,
        custom: { user_id: userId },
      },
      productOptions: {
        redirectUrl: `${process.env.NEXT_PUBLIC_URL}/dashboard`,
      },
    }
  )

  return Response.json({ url: checkout.data?.data.attributes.url })
}
```

### Webhook

```typescript
// app/api/webhooks/lemon/route.ts
import crypto from 'crypto'

export async function POST(req: Request) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-signature')
  
  const hmac = crypto.createHmac('sha256', process.env.LEMONSQUEEZY_WEBHOOK_SECRET!)
  const digest = hmac.update(rawBody).digest('hex')
  
  if (signature !== digest) {
    return new Response('Invalid signature', { status: 401 })
  }

  const event = JSON.parse(rawBody)

  switch (event.meta.event_name) {
    case 'subscription_created':
      await handleSubscriptionCreated(event.data)
      break
    case 'subscription_updated':
      await handleSubscriptionUpdated(event.data)
      break
    case 'subscription_cancelled':
      await handleSubscriptionCancelled(event.data)
      break
  }

  return new Response('OK')
}
```

---

## Prisma Schema per Subscriptions

```prisma
model User {
  id                     String    @id @default(cuid())
  email                  String    @unique
  
  // Stripe
  stripeCustomerId       String?   @unique
  stripeSubscriptionId   String?   @unique
  stripePriceId          String?
  stripeCurrentPeriodEnd DateTime?
  
  // Or LemonSqueezy
  lemonCustomerId        String?   @unique
  lemonSubscriptionId    String?   @unique
  
  plan                   Plan      @default(FREE)
  
  createdAt              DateTime  @default(now())
  updatedAt              DateTime  @updatedAt
}

enum Plan {
  FREE
  PRO
  ENTERPRISE
}
```

---

## Pricing Component

```typescript
// components/pricing.tsx
import { CheckoutButton } from './checkout-button'
import { Check } from 'lucide-react'

const plans = [
  {
    name: 'Free',
    price: 0,
    priceId: null,
    features: ['5 projects', 'Basic support', 'Community access'],
  },
  {
    name: 'Pro',
    price: 19,
    priceId: 'price_xxx', // da Stripe
    features: ['Unlimited projects', 'Priority support', 'API access', 'Custom domains'],
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 99,
    priceId: 'price_yyy',
    features: ['Everything in Pro', 'SSO', 'Dedicated support', 'SLA'],
  },
]

export function Pricing() {
  return (
    <div className="grid md:grid-cols-3 gap-8">
      {plans.map((plan) => (
        <div
          key={plan.name}
          className={`rounded-lg border p-8 ${
            plan.popular ? 'border-primary ring-2 ring-primary' : ''
          }`}
        >
          <h3 className="text-2xl font-bold">{plan.name}</h3>
          <p className="mt-4">
            <span className="text-4xl font-bold">${plan.price}</span>
            <span className="text-muted-foreground">/month</span>
          </p>
          
          <ul className="mt-8 space-y-3">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                {feature}
              </li>
            ))}
          </ul>

          <div className="mt-8">
            {plan.priceId ? (
              <CheckoutButton priceId={plan.priceId} mode="subscription" />
            ) : (
              <Button variant="outline" className="w-full">
                Get Started
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
```

---

## Environment Variables

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# LemonSqueezy
LEMONSQUEEZY_API_KEY=xxx
LEMONSQUEEZY_STORE_ID=xxx
LEMONSQUEEZY_WEBHOOK_SECRET=xxx
```

---

## Checklist Payments

- [ ] Stripe/Lemon account configurato
- [ ] Webhook endpoint registrato
- [ ] Customer ID salvato su User
- [ ] Subscription status sincronizzato
- [ ] Customer Portal configurato
- [ ] Pricing page implementata
- [ ] Success/Cancel pages create
- [ ] Error handling robusto
- [ ] Test con carte di test
- [ ] Monitoring pagamenti falliti
