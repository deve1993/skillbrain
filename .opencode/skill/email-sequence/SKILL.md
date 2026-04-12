---
name: email-sequence
description: When the user wants to create or optimize an email sequence, drip campaign, automated email flow, or lifecycle email program. Also use when the user mentions "email sequence," "drip campaign," "nurture sequence," "onboarding emails," "welcome sequence," "re-engagement emails," "email automation," or "lifecycle emails." Includes React Email implementation and full B2B nurture templates. For in-app onboarding, see onboarding-cro.
metadata:
  version: 2.0.0
---

# Email Sequence Design

You are an expert in email marketing and automation. Your goal is to create email sequences that nurture relationships, drive action, and move people toward conversion.

## Initial Assessment

**Check for product marketing context first:**
If `.agents/product-marketing-context.md` exists, read it before asking questions.

Before creating a sequence, understand:

1. **Sequence Type**: Welcome/onboarding, lead nurture, re-engagement, post-purchase, educational, sales
2. **Audience Context**: Who are they? What triggered entry? What do they already know?
3. **Goals**: Primary conversion goal, relationship-building goals, what defines success?

---

## Core Principles

1. **One Email, One Job** — Each email has one primary purpose, one main CTA
2. **Value Before Ask** — Lead with usefulness, build trust, earn the right to sell
3. **Relevance Over Volume** — Fewer, better emails win. Quality > frequency
4. **Clear Path Forward** — Every email moves them somewhere useful

---

## Email Sequence Strategy

### Sequence Length
- Welcome: 3-7 emails
- Lead nurture: 5-10 emails
- Onboarding: 5-10 emails
- Re-engagement: 3-5 emails

### Timing/Delays
- Welcome email: Immediately
- Early sequence: 1-2 days apart
- Nurture: 2-4 days apart (B2B: avoid weekends)
- Long-term: Weekly or bi-weekly

### Subject Line Strategy
- Clear > Clever, Specific > Vague
- 40-60 characters ideal
- **Patterns that work:**
  - Question: "Still struggling with X?"
  - How-to: "How to [achieve outcome] in [timeframe]"
  - Number: "3 ways to [benefit]"
  - Direct: "[First name], your [thing] is ready"

| Formula | Example |
|---------|---------|
| **Question** | `Still struggling with [problem]?` |
| **Number + Benefit** | `3 ways to [achieve outcome] faster` |
| **Curiosity Gap** | `The [thing] most [audience] get wrong` |
| **Social Proof** | `How [Company] achieved [result]` |
| **Personalization** | `[Name], quick question about [topic]` |
| **Urgency** | `[Offer] ends [when]` |
| **Pain Point** | `Tired of [problem]?` |

---

## Sequence Types

### Welcome Sequence (Post-Signup)
**Length**: 5-7 emails over 12-14 days | **Goal**: Activate, build trust, convert

| Day | Email | Purpose |
|-----|-------|---------|
| 0 | Welcome + deliver promised value | Immediate |
| 1-2 | Quick win | Activate |
| 3-4 | Story/Why | Build trust |
| 5-6 | Social proof | Credibility |
| 7-8 | Overcome objection | Reduce friction |
| 9-11 | Core feature highlight | Product value |
| 12-14 | Conversion | Ask for the sale |

### B2B Lead Nurture (7-Email Sequence)

```
Day 0  → Email 1: Welcome + Quick Win
Day 2  → Email 2: Pain Point Deep Dive
Day 5  → Email 3: Solution Introduction
Day 8  → Email 4: Social Proof / Case Study
Day 12 → Email 5: Feature Spotlight
Day 16 → Email 6: Objection Handling
Day 21 → Email 7: Final CTA + Urgency
```

### Re-Engagement Sequence
**Length**: 3-4 emails over 2 weeks | **Trigger**: 30-60 days of inactivity

1. Check-in (genuine concern)
2. Value reminder (what's new)
3. Incentive (special offer)
4. Last chance (stay or unsubscribe)

### Onboarding Sequence (Product Users)
**Length**: 5-7 emails over 14 days | **Goal**: Activate, drive to aha moment, upgrade

1. Welcome + first step (immediate)
2. Getting started help (day 1)
3. Feature highlight (day 2-3)
4. Success story (day 4-5)
5. Check-in (day 7)
6. Advanced tip (day 10-12)
7. Upgrade/expand (day 14+)

---

## Email Templates (B2B)

### Email 1: Welcome + Quick Win

**Subject Lines** (A/B test):
- A: `Welcome to [Company] - Here's your quick start guide`
- B: `[Name], your [outcome] starts here`
- C: `Quick win: [Specific benefit] in 5 minutes`

```markdown
Hi [Name],

Welcome to [Company]. You're now part of [X] teams who [achieve outcome].

Here's what happens next:
- Today: [Quick win resource]
- This week: [What you'll send]
- Your goal: [Outcome they want]

**Your quick win for today:**
[One specific, actionable tip they can implement in <5 minutes]

[Soft CTA button: "Explore [Resource]"]

Questions? Just hit reply - I read every email.

[Signature]

P.S. [Additional value: guide, tool, or tip]
```

### Email 2: Pain Point Deep Dive

```markdown
Subject: The real cost of [problem]

[Name],

[Agitate the pain - specific scenario]
[Show you understand their world]
[Data/stat that proves the problem is real]
[Hint at solution - don't sell yet]

[CTA: Learn more about the problem]
```

### Email 3: Solution Introduction

```markdown
Subject: There's a better way to [achieve outcome]

[Name],

[Bridge from pain to solution]
[Introduce your approach - not product]
Key differentiators:
1. [Differentiator 1]
2. [Differentiator 2]
3. [Differentiator 3]

[Mini case study / social proof]

[CTA: See how it works]
```

### Email 4: Case Study

**Subject Lines**:
- A: `How [Customer] achieved [specific result]`
- B: `From [problem] to [outcome] in [timeframe]`

```markdown
[Name],

[Set the scene - who, what situation]
[The challenge they faced]
[The solution (your product/service)]

Results:
- [Specific metric 1]
- [Specific metric 2]
- [Revenue/outcome metric]

"[Quote from customer]" — [Name, Role, Company]

[CTA: Get similar results]
```

### Email 6: Objection Handling

**Subject Lines**:
- A: `Honest answer: [common objection]`
- B: `"Is it worth it?" - Let's find out`

```markdown
[Acknowledge the objection directly]
[Validate it - show you understand]
[Address it honestly with proof]
[Provide guarantee/risk reversal]
[CTA: Let's talk about your specific case]
```

### Email 7: Final CTA + Urgency

```markdown
Subject: [Name], ready to [achieve outcome]?

[Recap the journey - what they've learned]
[Clear value proposition - 3 bullets]
[Urgency element - if genuine]
[Risk reversal - guarantee]
[Strong CTA button]
[Alternative CTA - if not ready]
```

---

## Email Copy Guidelines

### Body Copy Structure (AIDA for Email)

```
A - Attention: Opening hook (1 sentence)
I - Interest: Problem/pain validation (2-3 sentences)
D - Desire: Solution + benefits (3-4 sentences)
A - Action: Clear CTA (1 sentence + button)
```

### Formatting
- Short paragraphs (1-3 sentences)
- White space between sections
- Bullet points for scanability
- Bold for emphasis (sparingly)
- Mobile-first

### Length
- 50-125 words for transactional
- 150-300 words for educational
- 300-500 words for story-driven

### CTA Button Best Practices

| Do | Don't |
|----|-------|
| `Start Free Trial` | `Submit` |
| `Get My Report` | `Download` |
| `See How It Works` | `Learn More` |
| `Book My Demo` | `Click Here` |
| `Show Me the [Thing]` | `Continue` |

---

## Segmentation Strategy

### Basic Segments

| Segment | Criteria | Content Focus |
|---------|----------|---------------|
| **New Leads** | Signed up <7 days | Education, quick wins |
| **Engaged** | Opened 3+ emails | Product features, case studies |
| **Unengaged** | No open in 30 days | Re-engagement, best content |
| **MQLs** | Score >50 | Sales-focused, demos |
| **Customers** | Has purchased | Onboarding, upsell, retention |

### Advanced Segments

| Segment | Criteria | Strategy |
|---------|----------|----------|
| **By Role** | CTO vs Developer vs PM | Tailor technical depth |
| **By Company Size** | <50 vs 50-500 vs 500+ | Tailor pricing/features |
| **By Industry** | SaaS, E-comm, etc. | Tailor case studies |
| **By Behavior** | Viewed pricing page | Send comparison content |

---

## React Email Implementation

### Base Template

```tsx
// emails/base-template.tsx
import { Body, Container, Head, Html, Img, Link, Preview, Section, Text } from '@react-email/components'

interface BaseEmailProps {
  previewText: string
  children: React.ReactNode
}

export function BaseEmail({ previewText, children }: BaseEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Img src={`${baseUrl}/logo.png`} width="120" height="40" alt="Company" />
          </Section>
          <Section style={content}>{children}</Section>
          <Section style={footer}>
            <Text style={footerText}>[Company Name] | [Address]</Text>
            <Link href="{{{unsubscribe}}}" style={unsubLink}>Unsubscribe</Link>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}
const container = { backgroundColor: '#ffffff', margin: '0 auto', padding: '20px 0 48px', maxWidth: '600px' }
const content = { padding: '0 48px' }
const footer = { padding: '0 48px', borderTop: '1px solid #e6ebf1', marginTop: '32px', paddingTop: '32px' }
```

### Welcome Email Template

```tsx
// emails/welcome.tsx
import { Button, Heading, Text, Section } from '@react-email/components'
import { BaseEmail } from './base-template'

export function WelcomeEmail({ name, quickWinUrl }: { name: string; quickWinUrl: string }) {
  return (
    <BaseEmail previewText={`Welcome to [Company], ${name}!`}>
      <Heading>Welcome, {name}!</Heading>
      <Text>You're now part of 500+ engineering teams who ship faster with [Product].</Text>
      <Section>
        <Text>✅ Today: Your quick start guide (below)</Text>
        <Text>📧 This week: Tips to get the most out of [Product]</Text>
        <Text>🎯 Your goal: [Specific outcome] in 14 days</Text>
      </Section>
      <Button href={quickWinUrl}>Get Started Now →</Button>
      <Text>Questions? Just hit reply - I read every email.</Text>
      <Text>P.S. Check out our [free resource] - it's helped [X] teams [achieve outcome].</Text>
    </BaseEmail>
  )
}
```

---

## Automation Triggers

### Behavioral Triggers

| Trigger | Action | Timing |
|---------|--------|--------|
| Viewed pricing page | Send pricing comparison email | 1 hour delay |
| Downloaded resource | Add to nurture sequence | Immediate |
| Visited 3+ blog posts | Send content digest | 24 hour delay |
| Inactive 14 days | Send re-engagement email | Day 14 |
| Cart/form abandon | Send reminder | 1 hour, 24 hours |

### Engagement Scoring

```
+5  Email opened
+10 Email clicked
+15 Visited pricing page
+20 Requested demo
+25 Started trial
-5  Email unopened (after 7 days)
-10 Unsubscribed from category
```

---

## Metrics & KPIs

### Primary Metrics (B2B Benchmarks)

| Metric | Benchmark | Formula |
|--------|-----------|---------|
| Open Rate | 20-25% | Opens / Delivered |
| Click Rate | 2-5% | Clicks / Delivered |
| Click-to-Open | 10-15% | Clicks / Opens |
| Unsubscribe | <0.5% | Unsubs / Delivered |
| Bounce Rate | <2% | Bounces / Sent |

### Sequence Metrics

| Metric | What It Tells You |
|--------|-------------------|
| Sequence completion rate | Content relevance |
| Drop-off point | Where to improve |
| Conversion rate | Sequence effectiveness |
| Time to conversion | Nurture length optimization |

---

## A/B Testing for Email

### What to Test

| Element | Impact | Ease |
|---------|--------|------|
| Subject line | High | Easy |
| Send time | Medium | Easy |
| CTA button text | High | Easy |
| Preview text | Medium | Easy |
| Email length | Medium | Medium |
| Personalization | High | Medium |

### Test Protocol

```
1. Test ONE variable at a time
2. Minimum 1,000 recipients per variant
3. Wait 24-48 hours for results
4. Statistical significance >95%
5. Document and iterate
```

---

## Deliverability Checklist

- [ ] SPF record configured
- [ ] DKIM signing enabled
- [ ] DMARC policy set
- [ ] No ALL CAPS in subject lines
- [ ] No excessive punctuation (!!!)
- [ ] Image-to-text ratio balanced
- [ ] Plain text version included
- [ ] Unsubscribe link visible
- [ ] Double opt-in enabled
- [ ] Inactive subscribers cleaned (>6 months)

---

## Compliance

### GDPR (EU)
- Explicit consent required
- Easy unsubscribe
- Data access on request
- Right to be forgotten

### CAN-SPAM (US)
- No misleading headers
- Physical address required
- Honor opt-outs within 10 days

---

## Tool Integrations

| Tool | Best For |
|------|----------|
| **Customer.io** | Behavior-based automation |
| **Mailchimp** | SMB email marketing (MCP available) |
| **Resend** | Developer-friendly transactional (MCP available) |
| **SendGrid** | Transactional email at scale |
| **Kit** | Creator/newsletter focused |

---

## Related Skills

- **churn-prevention**: For cancel flows, save offers, and dunning strategy
- **onboarding-cro**: For in-app onboarding (email supports this)
- **copywriting**: For landing pages emails link to
- **ab-testing**: For testing email elements
- **popup-cro**: For email capture popups
- **product-marketing-context**: Foundation context for all email strategy
