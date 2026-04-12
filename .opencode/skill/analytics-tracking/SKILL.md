---
name: analytics-tracking
description: When the user wants to set up, improve, or audit analytics tracking and measurement. Also use when the user mentions "set up tracking," "GA4," "Google Analytics," "conversion tracking," "event tracking," "UTM parameters," "tag manager," "GTM," "analytics implementation," or "tracking plan." Includes full Next.js TypeScript implementation. For A/B test measurement, see ab-testing.
metadata:
  version: 2.0.0
---

# Analytics Tracking

You are an expert in analytics implementation and measurement. Your goal is to help set up tracking that provides actionable insights for marketing and product decisions.

## Initial Assessment

**Check for product marketing context first:**
If `.agents/product-marketing-context.md` exists, read it before asking questions.

Before implementing tracking, understand:

1. **Business Context** — What decisions will this data inform? What are key conversions?
2. **Current State** — What tracking exists? What tools are in use?
3. **Technical Context** — What's the tech stack? Any privacy/compliance requirements?

---

## Core Principles

1. **Track for Decisions, Not Data** — Every event should inform a decision. Avoid vanity metrics.
2. **Start with the Questions** — What do you need to know? Work backwards to what you need to track.
3. **Name Things Consistently** — Naming conventions matter. Establish patterns before implementing.
4. **Maintain Data Quality** — Clean data > more data.

---

## Event Naming Conventions

### Recommended Format: Category_Action_Object

```
[category]_[action]_[object]
```

**Categories**: `page`, `form`, `cta`, `content`, `video`, `exit`

**Examples**:
- `cta_click_hero`
- `form_submit_contact`
- `content_scroll_50`

### Alternative: Object-Action

```
signup_completed
button_clicked
form_submitted
article_read
checkout_payment_completed
```

**Best Practices:**
- Lowercase with underscores
- Be specific: `cta_hero_clicked` vs. `button_clicked`
- Include context in properties, not event name
- Document all decisions

---

## Event Taxonomy

### Standard Events (Landing Page)

| Event Name | Trigger | Parameters |
|------------|---------|------------|
| `page_view` | Page load | `page_path`, `page_title`, `page_locale`, `traffic_source` |
| `page_scroll` | Scroll milestones | `scroll_depth` (25, 50, 75, 100) |
| `page_time` | Time thresholds | `time_on_page` (30s, 60s, 120s, 300s) |
| `page_exit` | User leaves | `exit_page`, `time_on_page`, `scroll_depth_final` |

### CTA Events

| Event Name | Trigger | Parameters |
|------------|---------|------------|
| `cta_view` | CTA enters viewport | `cta_id`, `cta_text`, `cta_location` |
| `cta_click` | CTA clicked | `cta_id`, `cta_text`, `cta_location`, `cta_variant` |
| `cta_hover` | CTA hovered (>500ms) | `cta_id`, `cta_location` |

### Form Events

| Event Name | Trigger | Parameters |
|------------|---------|------------|
| `form_view` | Form enters viewport | `form_id`, `form_name` |
| `form_start` | First field focused | `form_id`, `first_field` |
| `form_field_complete` | Field completed | `form_id`, `field_name`, `field_position` |
| `form_field_error` | Validation error | `form_id`, `field_name`, `error_type` |
| `form_abandon` | Left without submit | `form_id`, `last_field`, `fields_completed` |
| `form_submit` | Form submitted | `form_id`, `form_name`, `submission_time` |
| `form_success` | Submission confirmed | `form_id`, `lead_id` |
| `form_error` | Submission failed | `form_id`, `error_type` |

### Content Engagement

| Event Name | Trigger | Parameters |
|------------|---------|------------|
| `content_section_view` | Section enters viewport | `section_id`, `section_name` |
| `content_testimonial_view` | Testimonial seen | `testimonial_id`, `testimonial_author` |
| `content_faq_expand` | FAQ item expanded | `faq_id`, `faq_question` |
| `content_pricing_view` | Pricing section seen | `pricing_tier_visible` |
| `content_feature_click` | Feature clicked | `feature_id`, `feature_name` |

### Video Events

| Event Name | Trigger | Parameters |
|------------|---------|------------|
| `video_start` | Video starts | `video_id`, `video_title` |
| `video_progress` | Milestones | `video_id`, `progress` (25, 50, 75, 100) |
| `video_complete` | Video ends | `video_id`, `watch_time` |
| `video_pause` | Paused | `video_id`, `pause_time` |

### Exit Intent

| Event Name | Trigger | Parameters |
|------------|---------|------------|
| `exit_intent_trigger` | Exit intent detected | `trigger_type` (mouse, scroll, idle) |
| `exit_popup_view` | Exit popup shown | `popup_id`, `popup_variant` |
| `exit_popup_close` | Popup dismissed | `popup_id`, `dismiss_method` |
| `exit_popup_convert` | Popup CTA clicked | `popup_id`, `offer_type` |

### Essential Events (Product/App)

| Event | Properties |
|-------|------------|
| `onboarding_step_completed` | `step_number`, `step_name` |
| `feature_used` | `feature_name` |
| `purchase_completed` | `plan`, `value` |
| `subscription_cancelled` | `reason` |

---

## Implementation (Next.js + GA4)

### Event Utility

```typescript
// lib/analytics.ts
type EventParams = Record<string, string | number | boolean | undefined>

declare global {
  interface Window {
    gtag: (command: 'event', eventName: string, params?: EventParams) => void
    dataLayer: any[]
  }
}

export function trackEvent(eventName: string, params?: EventParams) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, {
      ...params,
      timestamp: new Date().toISOString(),
    })
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[Analytics]', eventName, params)
  }
}

// Typed event helpers
export const analytics = {
  pageView: (path: string, title: string, locale: string) =>
    trackEvent('page_view', { page_path: path, page_title: title, page_locale: locale }),

  pageScroll: (depth: 25 | 50 | 75 | 100) =>
    trackEvent('page_scroll', { scroll_depth: depth }),

  ctaClick: (id: string, text: string, location: string, variant?: string) =>
    trackEvent('cta_click', { cta_id: id, cta_text: text, cta_location: location, cta_variant: variant }),

  ctaView: (id: string, text: string, location: string) =>
    trackEvent('cta_view', { cta_id: id, cta_text: text, cta_location: location }),

  formStart: (formId: string, firstField: string) =>
    trackEvent('form_start', { form_id: formId, first_field: firstField }),

  formSubmit: (formId: string, formName: string) =>
    trackEvent('form_submit', { form_id: formId, form_name: formName }),

  formError: (formId: string, fieldName: string, errorType: string) =>
    trackEvent('form_field_error', { form_id: formId, field_name: fieldName, error_type: errorType }),

  formAbandon: (formId: string, lastField: string, fieldsCompleted: number) =>
    trackEvent('form_abandon', { form_id: formId, last_field: lastField, fields_completed: fieldsCompleted }),

  sectionView: (sectionId: string, sectionName: string) =>
    trackEvent('content_section_view', { section_id: sectionId, section_name: sectionName }),

  faqExpand: (faqId: string, question: string) =>
    trackEvent('content_faq_expand', { faq_id: faqId, faq_question: question }),
}
```

### Scroll Tracking Hook

```typescript
// hooks/use-scroll-tracking.ts
'use client'

import { useEffect, useRef } from 'react'
import { analytics } from '@/lib/analytics'

export function useScrollTracking() {
  const tracked = useRef<Set<number>>(new Set())

  useEffect(() => {
    const thresholds = [25, 50, 75, 100] as const

    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
      const scrollPercent = Math.round((window.scrollY / scrollHeight) * 100)

      thresholds.forEach((threshold) => {
        if (scrollPercent >= threshold && !tracked.current.has(threshold)) {
          tracked.current.add(threshold)
          analytics.pageScroll(threshold)
        }
      })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])
}
```

### Section Visibility Hook

```typescript
// hooks/use-section-tracking.ts
'use client'

import { useEffect, useRef } from 'react'
import { analytics } from '@/lib/analytics'

export function useSectionTracking(sectionId: string, sectionName: string) {
  const ref = useRef<HTMLElement>(null)
  const hasTracked = useRef(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTracked.current) {
          hasTracked.current = true
          analytics.sectionView(sectionId, sectionName)
        }
      },
      { threshold: 0.5 }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [sectionId, sectionName])

  return ref
}

// Usage
function HeroSection() {
  const sectionRef = useSectionTracking('hero', 'Hero Section')
  return (
    <section ref={sectionRef} id="hero">
      {/* content */}
    </section>
  )
}
```

### Tracked CTA Component

```typescript
// components/tracked-cta.tsx
'use client'

import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { analytics } from '@/lib/analytics'

interface TrackedCTAProps {
  id: string
  location: 'hero' | 'pricing' | 'footer' | 'sticky'
  variant?: string
  children: React.ReactNode
  onClick?: () => void
}

export function TrackedCTA({ id, location, variant, children, onClick }: TrackedCTAProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const hasTrackedView = useRef(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTrackedView.current) {
          hasTrackedView.current = true
          analytics.ctaView(id, element.textContent || '', location)
        }
      },
      { threshold: 0.5 }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [id, location])

  const handleClick = () => {
    analytics.ctaClick(id, ref.current?.textContent || '', location, variant)
    onClick?.()
  }

  return (
    <Button ref={ref} onClick={handleClick}>
      {children}
    </Button>
  )
}
```

### Form Tracking Hook

```typescript
// hooks/use-form-tracking.ts
'use client'

import { useRef, useCallback, useEffect } from 'react'
import { analytics } from '@/lib/analytics'

export function useFormTracking(formId: string, formName: string) {
  const startTime = useRef<number | null>(null)
  const fieldsCompleted = useRef<string[]>([])
  const hasStarted = useRef(false)

  const trackStart = useCallback((fieldName: string) => {
    if (!hasStarted.current) {
      hasStarted.current = true
      startTime.current = Date.now()
      analytics.formStart(formId, fieldName)
    }
  }, [formId])

  const trackFieldComplete = useCallback((fieldName: string) => {
    if (!fieldsCompleted.current.includes(fieldName)) {
      fieldsCompleted.current.push(fieldName)
    }
  }, [])

  const trackError = useCallback((fieldName: string, errorType: string) => {
    analytics.formError(formId, fieldName, errorType)
  }, [formId])

  const trackSubmit = useCallback(() => {
    analytics.formSubmit(formId, formName)
  }, [formId, formName])

  const trackAbandon = useCallback(() => {
    if (hasStarted.current && fieldsCompleted.current.length > 0) {
      const lastField = fieldsCompleted.current[fieldsCompleted.current.length - 1]
      analytics.formAbandon(formId, lastField, fieldsCompleted.current.length)
    }
  }, [formId])

  useEffect(() => {
    const handleBeforeUnload = () => trackAbandon()
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      trackAbandon()
    }
  }, [trackAbandon])

  return { trackStart, trackFieldComplete, trackError, trackSubmit }
}
```

---

## GA4 Configuration

### Custom Dimensions

| Dimension | Scope | Description |
|-----------|-------|-------------|
| `page_locale` | Event | Language (it, en, cs) |
| `traffic_source` | Session | UTM source |
| `cta_location` | Event | Where CTA appears |
| `form_id` | Event | Form identifier |
| `scroll_depth` | Event | Max scroll reached |
| `ab_variant` | Session | A/B test variant |

### Custom Metrics

| Metric | Scope | Description |
|--------|-------|-------------|
| `time_to_cta_click` | Event | Seconds from page load to CTA click |
| `form_completion_time` | Event | Seconds to complete form |
| `fields_completed` | Event | Number of form fields filled |

### Conversions (Goals)

| Conversion | Event | Value |
|------------|-------|-------|
| Lead Generated | `form_submit` | $50 |
| Demo Requested | `form_submit` (demo form) | $100 |
| Pricing Viewed | `content_section_view` (pricing) | $5 |
| High Engagement | `page_scroll` (100%) + time >120s | $10 |

### Quick Setup

1. Create GA4 property and data stream
2. Install gtag.js or GTM
3. Enable enhanced measurement
4. Configure custom events
5. Mark conversions in Admin

---

## UTM Strategy

### Standard Parameters

```
utm_source    = [platform]         # google, linkedin, newsletter
utm_medium    = [channel type]     # cpc, social, email
utm_campaign  = [campaign name]    # q1-launch, product-feature
utm_content   = [ad/link variant]  # hero-cta, sidebar-banner
utm_term      = [keyword]          # frontend-development
```

### UTM Preservation

```typescript
// lib/utm.ts
export function getUtmParams(): Record<string, string> {
  if (typeof window === 'undefined') return {}

  const params = new URLSearchParams(window.location.search)
  const utmParams: Record<string, string> = {}
  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']

  utmKeys.forEach((key) => {
    const value = params.get(key)
    if (value) {
      utmParams[key] = value
      sessionStorage.setItem(key, value)
    } else {
      const stored = sessionStorage.getItem(key)
      if (stored) utmParams[key] = stored
    }
  })

  return utmParams
}

export function getHiddenUtmFields() {
  const utms = getUtmParams()
  return Object.entries(utms).map(([key, value]) => (
    <input key={key} type="hidden" name={key} value={value} />
  ))
}
```

---

## Dashboard KPIs

### Primary Metrics

| KPI | Formula | Target |
|-----|---------|--------|
| **Conversion Rate** | (form_submit / page_view) × 100 | >3% |
| **CTA Click Rate** | (cta_click / cta_view) × 100 | >5% |
| **Form Completion Rate** | (form_submit / form_start) × 100 | >60% |
| **Bounce Rate** | Single page sessions / Total sessions | <50% |
| **Avg. Time on Page** | Total time / Sessions | >90s |

### Engagement Metrics

| KPI | Formula | Target |
|-----|---------|--------|
| **Scroll Depth (Avg)** | Avg of final scroll_depth | >75% |
| **Content Section Views** | Sections viewed per session | >5 |
| **FAQ Engagement** | faq_expand / page_view | >20% |
| **Video Play Rate** | video_start / page_view | >15% |

### Funnel Metrics

```
Traffic → Page View → CTA Click → Form Start → Form Submit → Qualified Lead

Drop-off Analysis:
- Page View → CTA Click: [%] (Message clarity issue)
- CTA Click → Form Start: [%] (CTA mismatch issue)
- Form Start → Form Submit: [%] (Form friction issue)
```

---

## A/B Testing Events

```typescript
trackEvent('ab_test_exposure', {
  test_id: 'hero-headline-q1',
  variant: 'B',
  test_name: 'Hero Headline Test',
})

trackEvent('ab_test_conversion', {
  test_id: 'hero-headline-q1',
  variant: 'B',
  conversion_type: 'form_submit',
})
```

---

## Privacy and Compliance

- Cookie consent required in EU/UK/CA
- No PII in analytics properties
- Data retention settings in GA4
- Use consent mode (wait for consent before tracking)
- IP anonymization enabled
- Only collect what you need

---

## Debugging

### Debug Mode

```typescript
export function enableAnalyticsDebug() {
  if (typeof window !== 'undefined') {
    (window as any).analyticsDebug = true
  }
}
```

### Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Events not firing | CSR hydration | Use useEffect |
| Duplicate events | Re-renders | Use refs to track |
| Missing params | Async state | Ensure data ready |
| Wrong attribution | UTM lost | Session storage preservation |

### GA4 Debug View
1. Install GA Debugger Chrome extension
2. Enable debug mode: `gtag('config', 'GA_ID', { debug_mode: true })`
3. View real-time in GA4 → Configure → DebugView

---

## Tool Integrations

| Tool | Best For | Guide |
|------|----------|-------|
| **GA4** | Web analytics, Google ecosystem | MCP available |
| **Mixpanel** | Product analytics, event tracking | — |
| **PostHog** | Open-source analytics, session replay | — |
| **Segment** | Customer data platform, routing | — |
| **Amplitude** | Product analytics, cohort analysis | — |

---

## Checklist

- [ ] Event taxonomy defined
- [ ] Analytics utility created
- [ ] Scroll tracking implemented
- [ ] CTA tracking on all buttons
- [ ] Form tracking complete
- [ ] Section visibility tracking
- [ ] UTM preservation working
- [ ] GA4 custom dimensions configured
- [ ] Conversions defined in GA4
- [ ] Debug mode available
- [ ] Dashboard KPIs documented
- [ ] A/B test events ready
- [ ] Privacy/consent compliance verified

---

## Related Skills

- **ab-testing**: For experiment tracking
- **page-cro**: For conversion optimization (uses this data)
- **revops**: For pipeline metrics, CRM tracking, revenue attribution
- **measurement**: See analytics-tracking (this skill replaces it)
