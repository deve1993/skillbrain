---
name: email
description: Email sending knowledge base - Resend, React Email, transactional templates, Postmark. Use when setting up transactional emails, building email templates, configuring email providers, or sending notifications.
version: 1.0.0
---

# Email Skill

Knowledge base per invio email transazionali e marketing in applicazioni moderne.

## Provider Raccomandati

| Provider | Uso | Free Tier |
|----------|-----|-----------|
| **Resend** | Email transazionali, React Email | 3,000/mese |
| **Postmark** | Transazionali ad alta deliverability | 100/mese |
| **SendGrid** | Volume alto, marketing | 100/giorno |
| **AWS SES** | Volume altissimo, low cost | Pay per use |

---

## Resend + React Email (Raccomandato)

### Installazione

```bash
pnpm add resend @react-email/components react-email
```

### Setup Resend

```typescript
// lib/resend.ts
import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY)
```

### Template Email con React Email

```typescript
// emails/welcome.tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface WelcomeEmailProps {
  username: string
  loginUrl: string
}

export function WelcomeEmail({ username, loginUrl }: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Benvenuto in {process.env.NEXT_PUBLIC_APP_NAME}!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img
            src={`${process.env.NEXT_PUBLIC_URL}/logo.png`}
            width="48"
            height="48"
            alt="Logo"
          />
          
          <Heading style={h1}>Benvenuto, {username}!</Heading>
          
          <Text style={text}>
            Grazie per esserti registrato. Siamo felici di averti con noi.
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={loginUrl}>
              Accedi al tuo account
            </Button>
          </Section>

          <Text style={footer}>
            Se non hai creato questo account, puoi ignorare questa email.
          </Text>

          <Link href={`${process.env.NEXT_PUBLIC_URL}/unsubscribe`} style={link}>
            Disiscriviti
          </Link>
        </Container>
      </Body>
    </Html>
  )
}

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '40px 20px',
  borderRadius: '8px',
  maxWidth: '560px',
}

const h1 = {
  color: '#1a1a1a',
  fontSize: '24px',
  fontWeight: '600',
  lineHeight: '40px',
  margin: '16px 0',
}

const text = {
  color: '#4a4a4a',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '16px 0',
}

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
}

const button = {
  backgroundColor: '#0066cc',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  padding: '12px 24px',
}

const footer = {
  color: '#8898aa',
  fontSize: '14px',
  lineHeight: '22px',
}

const link = {
  color: '#8898aa',
  fontSize: '12px',
}

export default WelcomeEmail
```

### Invio Email

```typescript
// lib/email.ts
import { resend } from './resend'
import WelcomeEmail from '@/emails/welcome'
import PasswordResetEmail from '@/emails/password-reset'
import InvoiceEmail from '@/emails/invoice'

export async function sendWelcomeEmail(email: string, username: string) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'App <noreply@tuodominio.com>',
      to: email,
      subject: 'Benvenuto!',
      react: WelcomeEmail({ 
        username, 
        loginUrl: `${process.env.NEXT_PUBLIC_URL}/login` 
      }),
    })

    if (error) {
      console.error('Email error:', error)
      throw error
    }

    return data
  } catch (error) {
    console.error('Failed to send welcome email:', error)
    throw error
  }
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${process.env.NEXT_PUBLIC_URL}/reset-password?token=${token}`
  
  await resend.emails.send({
    from: 'App <noreply@tuodominio.com>',
    to: email,
    subject: 'Reimposta la tua password',
    react: PasswordResetEmail({ resetUrl }),
  })
}

export async function sendInvoiceEmail(
  email: string, 
  invoiceData: { amount: number; invoiceUrl: string }
) {
  await resend.emails.send({
    from: 'Billing <billing@tuodominio.com>',
    to: email,
    subject: 'La tua fattura',
    react: InvoiceEmail(invoiceData),
  })
}
```

### API Route per Email

```typescript
// app/api/email/welcome/route.ts
import { sendWelcomeEmail } from '@/lib/email'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  username: z.string().min(2),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email, username } = schema.parse(body)

    await sendWelcomeEmail(email, username)

    return Response.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Invalid input' }, { status: 400 })
    }
    return Response.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
```

---

## Template Email Comuni

### Password Reset

```typescript
// emails/password-reset.tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'

export function PasswordResetEmail({ resetUrl }: { resetUrl: string }) {
  return (
    <Html>
      <Head />
      <Preview>Reimposta la tua password</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Reimposta Password</Heading>
          
          <Text style={text}>
            Hai richiesto di reimpostare la password. Clicca il pulsante qui sotto 
            per crearne una nuova.
          </Text>

          <Button style={button} href={resetUrl}>
            Reimposta Password
          </Button>

          <Text style={text}>
            Questo link scadrà tra 1 ora. Se non hai richiesto tu il reset, 
            ignora questa email.
          </Text>

          <Text style={footer}>
            Oppure copia e incolla questo URL nel browser:
            <br />
            {resetUrl}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
```

### Notifica Pagamento

```typescript
// emails/payment-success.tsx
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Row,
  Column,
  Text,
  Hr,
} from '@react-email/components'

interface PaymentSuccessProps {
  customerName: string
  amount: number
  currency: string
  planName: string
  invoiceUrl: string
}

export function PaymentSuccessEmail({
  customerName,
  amount,
  currency,
  planName,
  invoiceUrl,
}: PaymentSuccessProps) {
  const formattedAmount = new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency,
  }).format(amount / 100)

  return (
    <Html>
      <Head />
      <Preview>Pagamento ricevuto - {formattedAmount}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Grazie per il tuo pagamento!</Heading>
          
          <Text style={text}>Ciao {customerName},</Text>
          
          <Text style={text}>
            Abbiamo ricevuto il tuo pagamento. Ecco i dettagli:
          </Text>

          <Container style={invoiceBox}>
            <Row>
              <Column>Piano</Column>
              <Column style={alignRight}>{planName}</Column>
            </Row>
            <Hr style={hr} />
            <Row>
              <Column><strong>Totale</strong></Column>
              <Column style={alignRight}><strong>{formattedAmount}</strong></Column>
            </Row>
          </Container>

          <Text style={text}>
            Puoi scaricare la fattura da{' '}
            <a href={invoiceUrl}>questo link</a>.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const invoiceBox = {
  border: '1px solid #e0e0e0',
  borderRadius: '8px',
  padding: '16px',
  margin: '24px 0',
}

const alignRight = {
  textAlign: 'right' as const,
}

const hr = {
  borderColor: '#e0e0e0',
  margin: '12px 0',
}
```

### Magic Link

```typescript
// emails/magic-link.tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'

export function MagicLinkEmail({ magicLink }: { magicLink: string }) {
  return (
    <Html>
      <Head />
      <Preview>Il tuo link di accesso</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Accedi al tuo account</Heading>
          
          <Text style={text}>
            Clicca il pulsante qui sotto per accedere. Il link è valido per 10 minuti.
          </Text>

          <Button style={button} href={magicLink}>
            Accedi
          </Button>

          <Text style={footer}>
            Se non hai richiesto questo link, puoi ignorare questa email.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
```

---

## Email Queue (per volume alto)

```typescript
// lib/email-queue.ts
import { resend } from './resend'

interface EmailJob {
  to: string
  subject: string
  react: React.ReactElement
  from?: string
}

class EmailQueue {
  private queue: EmailJob[] = []
  private processing = false
  private batchSize = 10
  private delayMs = 100 // Rate limiting

  add(job: EmailJob) {
    this.queue.push(job)
    this.process()
  }

  private async process() {
    if (this.processing) return
    this.processing = true

    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.batchSize)
      
      await Promise.all(
        batch.map(async (job) => {
          try {
            await resend.emails.send({
              from: job.from || 'App <noreply@tuodominio.com>',
              to: job.to,
              subject: job.subject,
              react: job.react,
            })
          } catch (error) {
            console.error(`Failed to send email to ${job.to}:`, error)
            // Retry logic here
          }
        })
      )

      if (this.queue.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.delayMs))
      }
    }

    this.processing = false
  }
}

export const emailQueue = new EmailQueue()

// Usage
emailQueue.add({
  to: 'user@example.com',
  subject: 'Welcome!',
  react: WelcomeEmail({ username: 'John' }),
})
```

---

## Preview Email in Development

```bash
# Avvia server di preview
pnpm email dev

# Genera HTML statico
pnpm email export
```

```json
// package.json
{
  "scripts": {
    "email:dev": "email dev -p 3001",
    "email:export": "email export --outDir ./out/emails"
  }
}
```

---

## Environment Variables

```env
# Resend
RESEND_API_KEY=re_xxx

# Dominio verificato
EMAIL_FROM=noreply@tuodominio.com

# Per development
EMAIL_TEST_MODE=true # Non invia email reali
```

---

## Best Practices

1. **Dominio verificato**: Usa sempre un dominio verificato per migliorare deliverability
2. **Unsubscribe**: Includi sempre un link per disiscriversi
3. **Preview text**: Usa sempre `<Preview>` per il testo di anteprima
4. **Mobile-first**: I template devono essere responsive
5. **Plain text**: Fornisci sempre una versione plain text alternativa
6. **Rate limiting**: Non superare i limiti del provider
7. **Error handling**: Gestisci sempre i fallimenti con retry

---

## Checklist Email

- [ ] Provider configurato (Resend/Postmark)
- [ ] Dominio DNS verificato (SPF, DKIM, DMARC)
- [ ] Template React Email creati
- [ ] Preview development funzionante
- [ ] Unsubscribe link presente
- [ ] Error handling implementato
- [ ] Rate limiting considerato
- [ ] Test con indirizzi reali
