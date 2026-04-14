---
name: ab-testing
description: When the user wants to plan, design, or implement an A/B test or experiment. Also use when the user mentions "A/B test," "split test," "experiment," "test this change," "variant copy," "multivariate test," or "hypothesis." Includes full Next.js TypeScript implementation and statistical analysis. For tracking implementation, see analytics-tracking.
metadata:
  version: 2.0.0
---

# A/B Testing

You are an expert in experimentation and A/B testing. Your goal is to help design tests that produce statistically valid, actionable results.

## Initial Assessment

**Check for product marketing context first:**
If `.agents/product-marketing-context.md` exists, read it before asking questions.

Before designing a test, understand:

1. **Test Context** — What are you trying to improve? What change are you considering?
2. **Current State** — Baseline conversion rate? Current traffic volume?
3. **Constraints** — Technical complexity? Timeline? Tools available?

---

## Core Principles

1. **Start with a Hypothesis** — Not just "let's see what happens." Specific prediction based on reasoning or data.
2. **Test One Thing** — Single variable per test. Otherwise you don't know what worked.
3. **Statistical Rigor** — Pre-determine sample size. Don't peek and stop early.
4. **Measure What Matters** — Primary metric tied to business value. Secondary + guardrail metrics.

---

## Hypothesis Framework

### Structure

```
Because [observation/data],
we believe [change]
will cause [expected outcome]
for [audience].
We'll know this is true when [metrics].
```

### Example

**Weak**: "Changing the button color might increase clicks."

**Strong**: "Because users report difficulty finding the CTA (per heatmaps and feedback), we believe making the button larger and using contrasting color will increase CTA clicks by 15%+ for new visitors. We'll measure click-through rate from page view to signup start."

### Template alternativo (IF/THEN)

```
IF we [change],
THEN [metric] will [increase/decrease] by [amount],
BECAUSE [rationale based on user behavior/data].
```

---

## When to A/B Test

| Scenario | Test? | Why |
|----------|-------|-----|
| New landing page | ✅ Yes | Establish baseline, optimize |
| Major redesign | ✅ Yes | Validate before full rollout |
| Small copy change | ⚠️ Maybe | Only if high-traffic page |
| Bug fix | ❌ No | Just fix it |
| Legal/compliance update | ❌ No | Required change |
| Low-traffic page (<1k/month) | ❌ No | Won't reach significance |

## Test Hierarchy (Impact vs Effort)

```
HIGH IMPACT / LOW EFFORT (Test First)
├── Headlines
├── CTA text
├── CTA color/size
├── Hero image
└── Form fields (remove/add)

MEDIUM IMPACT / MEDIUM EFFORT
├── Page layout
├── Social proof placement
├── Pricing presentation
├── Above-fold content
└── Form steps

LOW IMPACT / HIGH EFFORT (Test Last)
├── Full redesign
├── Navigation changes
└── Brand changes
```

---

## Test Types

| Type | Description | Traffic Needed |
|------|-------------|----------------|
| A/B | Two versions, single change | Moderate |
| A/B/n | Multiple variants | Higher |
| MVT | Multiple changes in combinations | Very high |
| Split URL | Different URLs for variants | Moderate |

---

## Sample Size

### Quick Reference (95% confidence, 80% power)

| Baseline | MDE 10% | MDE 20% | MDE 30% |
|----------|---------|---------|---------|
| 1% | 15,200 | 3,800 | 1,700 |
| 2% | 7,500 | 1,900 | 850 |
| 3% | 4,900 | 1,250 | 560 |
| 5% | 2,900 | 730 | 330 |
| 10% | 1,400 | 350 | 160 |

*Sample size per variant*

### Formula

```
n = (2 * (Zα + Zβ)² * p * (1-p)) / MDE²

Where:
- n = sample size per variant
- Zα = Z-score for significance (1.96 for 95%)
- Zβ = Z-score for power (0.84 for 80%)
- p = baseline conversion rate
- MDE = minimum detectable effect
```

### Duration Estimator

```
Duration (days) = (Sample Size × 2) / Daily Visitors

Example:
- Need 3,000 per variant = 6,000 total
- 500 visitors/day
- Duration = 6,000 / 500 = 12 days
```

**Calculators:**
- [Evan Miller's](https://www.evanmiller.org/ab-testing/sample-size.html)
- [Optimizely's](https://www.optimizely.com/sample-size-calculator/)

---

## Metrics Selection

### Primary Metric
- Single metric that matters most
- Directly tied to hypothesis
- What you'll use to call the test

### Secondary Metrics
- Support primary metric interpretation
- Explain why/how the change worked

### Guardrail Metrics
- Things that shouldn't get worse
- Stop test if significantly negative

**Example: Pricing Page Test**
- **Primary**: Plan selection rate
- **Secondary**: Time on page, plan distribution
- **Guardrail**: Support tickets, refund rate

---

## Test Documentation

```markdown
## Test: [Test Name]
**ID**: TEST-2026-001
**Status**: [Planning | Running | Analyzing | Complete]

### Hypothesis
[Hypothesis statement]

### Variants
| Variant | Description |
|---------|-------------|
| Control (A) | [Current state] |
| Variant (B) | [Change description] |

### Metrics
- **Primary**: [e.g., CTA click rate]
- **Secondary**: [e.g., Form submission rate, Bounce rate]
- **Guardrail**: [e.g., Page load time, Error rate]

### Targeting
- **Audience**: [All visitors | Segment]
- **Traffic Split**: 50/50
- **Device**: [All | Desktop | Mobile]

### Sample Size
- **Required**: [Calculate based on MDE]
- **Expected Duration**: [X days]

### Results
| Metric | Control | Variant | Lift | Confidence |
|--------|---------|---------|------|------------|
| Primary | X% | Y% | +Z% | 95% |

### Decision
[Ship Variant | Keep Control | Iterate | Inconclusive]

### Learnings
[What we learned for future tests]
```

---

## Implementation (Next.js)

### Feature Flag Approach

```typescript
// lib/ab-test.ts
import { cookies } from 'next/headers'

export type ABVariant = 'control' | 'variant'

interface ABTest {
  id: string
  name: string
  variants: ABVariant[]
  trafficAllocation: number // 0-1
}

const activeTests: ABTest[] = [
  {
    id: 'hero-headline-2026-01',
    name: 'Hero Headline Test',
    variants: ['control', 'variant'],
    trafficAllocation: 0.5,
  },
]

export function getABVariant(testId: string): ABVariant {
  const cookieStore = cookies()
  const cookieName = `ab_${testId}`

  const existing = cookieStore.get(cookieName)
  if (existing) return existing.value as ABVariant

  const test = activeTests.find(t => t.id === testId)
  if (!test) return 'control'

  const variant: ABVariant = Math.random() < test.trafficAllocation ? 'variant' : 'control'
  return variant
}

export function setABCookie(testId: string, variant: ABVariant) {
  cookies().set(`ab_${testId}`, variant, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
  })
}
```

### Server Component Usage

```tsx
// app/page.tsx
import { getABVariant, setABCookie } from '@/lib/ab-test'
import { trackEvent } from '@/lib/analytics'

export default function HomePage() {
  const testId = 'hero-headline-2026-01'
  const variant = getABVariant(testId)
  setABCookie(testId, variant)

  trackEvent('ab_test_exposure', { test_id: testId, variant })

  return <Hero variant={variant} />
}
```

### Hero Component with Variants

```tsx
// components/hero.tsx
interface HeroProps {
  variant: 'control' | 'variant'
}

const headlines = {
  control: {
    h1: 'Build Better Frontend Applications',
    subhead: 'Professional development services for modern web apps.',
  },
  variant: {
    h1: 'Ship 3x Faster with Expert Frontend',
    subhead: 'Join 500+ teams who reduced time-to-market by 60%.',
  },
}

export function Hero({ variant }: HeroProps) {
  const copy = headlines[variant]
  return (
    <section className="hero">
      <h1>{copy.h1}</h1>
      <p>{copy.subhead}</p>
      <TrackedCTA id="hero-cta" location="hero" variant={variant}>
        Start Free Trial
      </TrackedCTA>
    </section>
  )
}
```

### Client-Side Hook (for SPA)

```tsx
// hooks/use-ab-test.ts
'use client'

import { useEffect, useState } from 'react'
import { analytics } from '@/lib/analytics'

export function useABTest(testId: string): 'control' | 'variant' | null {
  const [variant, setVariant] = useState<'control' | 'variant' | null>(null)

  useEffect(() => {
    const cookieName = `ab_${testId}`
    const existing = document.cookie
      .split('; ')
      .find(row => row.startsWith(cookieName))
      ?.split('=')[1]

    if (existing) {
      setVariant(existing as 'control' | 'variant')
      return
    }

    const newVariant = Math.random() < 0.5 ? 'variant' : 'control'
    document.cookie = `${cookieName}=${newVariant}; max-age=${60 * 60 * 24 * 30}; path=/`
    setVariant(newVariant)

    analytics.trackEvent?.('ab_test_exposure', { test_id: testId, variant: newVariant })
  }, [testId])

  return variant
}
```

---

## Running the Test

### Pre-Launch Checklist
- [ ] Hypothesis documented
- [ ] Primary metric defined
- [ ] Sample size calculated
- [ ] Variants implemented correctly
- [ ] Tracking verified
- [ ] QA completed on all variants

### During the Test

**DO:**
- Monitor for technical issues
- Check segment quality
- Document external factors

**DON'T:**
- Peek at results and stop early (the peeking problem — leads to false positives)
- Make changes to variants mid-test
- Add traffic from new sources

---

## Statistical Analysis

### Significance Calculator

```typescript
// lib/ab-stats.ts

interface ABResult {
  control: { visitors: number; conversions: number }
  variant: { visitors: number; conversions: number }
}

export function calculateSignificance(result: ABResult) {
  const { control, variant } = result

  const p1 = control.conversions / control.visitors
  const p2 = variant.conversions / variant.visitors

  const pooledP = (control.conversions + variant.conversions) /
                  (control.visitors + variant.visitors)

  const se = Math.sqrt(
    pooledP * (1 - pooledP) * (1 / control.visitors + 1 / variant.visitors)
  )

  const zScore = (p2 - p1) / se
  const pValue = 2 * (1 - normalCDF(Math.abs(zScore)))
  const lift = ((p2 - p1) / p1) * 100
  const confidence = (1 - pValue) * 100

  return {
    controlRate: p1 * 100,
    variantRate: p2 * 100,
    lift,
    pValue,
    confidence,
    isSignificant: pValue < 0.05,
    recommendation: getRecommendation(lift, pValue),
  }
}

function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911

  const sign = x < 0 ? -1 : 1
  x = Math.abs(x) / Math.sqrt(2)
  const t = 1.0 / (1.0 + p * x)
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
  return 0.5 * (1.0 + sign * y)
}

function getRecommendation(lift: number, pValue: number): string {
  if (pValue >= 0.05) return 'INCONCLUSIVE - Need more data'
  if (lift > 0) return 'SHIP VARIANT - Statistically significant improvement'
  if (lift < 0) return 'KEEP CONTROL - Variant performed worse'
  return 'NO DIFFERENCE - Consider other factors'
}
```

### Interpreting Results

| p-value | Confidence | Action |
|---------|------------|--------|
| p < 0.01 | 99%+ | High confidence, ship if positive |
| p < 0.05 | 95%+ | Standard threshold, ship if positive |
| p < 0.10 | 90%+ | Directional, consider more data |
| p >= 0.10 | <90% | Inconclusive, keep running or stop |

---

## Anti-Patterns

### Statistical Mistakes

| Mistake | Why It's Bad | Fix |
|---------|--------------|-----|
| Peeking at results | Inflates false positives | Set duration, wait |
| Stopping early | May not reach significance | Use sequential testing |
| Testing too many variants | Reduces power | Max 2-3 variants |
| Ignoring seasonality | Confounding variable | Run for full week cycles |
| No guardrail metrics | Miss negative impacts | Always track core metrics |

### Implementation Mistakes

| Mistake | Impact | Fix |
|---------|--------|-----|
| Flickering (FOUC) | Poor UX, biased results | Server-side assignment |
| Bot traffic included | Skewed data | Filter by engagement |
| Inconsistent tracking | Missing data | Test tracking first |
| Leaky buckets | Cross-contamination | Verify isolation |

---

## Test Velocity Framework

### Prioritization (ICE Score)

```
ICE = (Impact + Confidence + Ease) / 3

Impact: 1-10 (potential uplift)
Confidence: 1-10 (likelihood of success)
Ease: 1-10 (implementation effort, inverted)
```

### Test Roadmap Template

```markdown
## Q1 2026 Test Roadmap

### Month 1
| Test | ICE | Status |
|------|-----|--------|
| Hero headline | 8.3 | Running |
| CTA button color | 6.0 | Planned |

### Month 2
| Test | ICE | Status |
|------|-----|--------|
| Form length | 7.5 | Planned |
| Social proof format | 7.0 | Planned |
```

---

## Reporting Template

```markdown
## A/B Test Report: [Test Name]

**Test ID**: TEST-2026-001
**Duration**: Jan 1 - Jan 14, 2026
**Traffic**: 12,450 visitors (6,225 per variant)

### Results Summary

| Metric | Control | Variant | Lift | Confidence |
|--------|---------|---------|------|------------|
| **Primary: CTA CTR** | 4.2% | 5.1% | **+21.4%** | 97.3% ✅ |
| Secondary: Form Starts | 2.1% | 2.4% | +14.3% | 89.2% |
| Guardrail: Bounce Rate | 42% | 41% | -2.4% | 65% |

### Recommendation
**SHIP VARIANT** - The new headline showed a statistically significant 21% improvement.

### Key Learnings
1. Benefit-focused headlines outperform feature-focused
2. Specific metrics ("3x faster") increase credibility

### Next Steps
- [ ] Roll out variant to 100% traffic
- [ ] Plan follow-up test on CTA button text
```

---

## Tools & Platforms

### Free/Open Source
- PostHog (open source, includes feature flags)
- Growthbook (open source)
- Custom implementation (as shown above)

### Enterprise
- Optimizely, VWO, LaunchDarkly, Split.io

### Analysis
- Google Analytics 4, BigQuery, Metabase

---

## Related Skills

- **page-cro**: For generating test ideas based on CRO principles
- **analytics-tracking**: For setting up test measurement
- **copywriting**: For creating variant copy
- **product-marketing-context**: Foundation context to read first
