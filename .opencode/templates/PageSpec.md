# Page Specification Template

> **Owner**: @cro-designer
> **Version**: 1.1
> **Status**: [Draft | Review | Approved | In Development]

---

## 1. Page Overview

### Basic Info
| Field | Value |
|-------|-------|
| **Page Name** | |
| **URL Path** | `/[locale]/[path]` |
| **Page Type** | [Landing | Feature | Pricing | Case Study | Comparison] |
| **Primary CTA** | |
| **Strategy Brief** | [Link to StrategyBrief.md] |

### Purpose
> [One sentence: What is this page designed to achieve?]

### Target Audience
- **Primary**: [Persona from Strategy Brief]
- **Traffic Source**: [Where users come from]
- **User Intent**: [What they're looking for]

---

## 2. Page Structure

### Section Layout (Mobile-First)

```
┌─────────────────────────────────────┐
│           NAVIGATION                │
│  Logo | Links | CTA Button          │
├─────────────────────────────────────┤
│           HERO SECTION              │
│  H1 + Subhead + CTA + Visual        │
│  Height: 100vh (desktop) / auto     │
├─────────────────────────────────────┤
│        SOCIAL PROOF BAR             │
│  Logos | "Trusted by X companies"   │
├─────────────────────────────────────┤
│        PROBLEM/PAIN SECTION         │
│  Agitate pain points                │
├─────────────────────────────────────┤
│        SOLUTION SECTION             │
│  How we solve it                    │
├─────────────────────────────────────┤
│        FEATURES/BENEFITS            │
│  3-4 key differentiators            │
├─────────────────────────────────────┤
│        SOCIAL PROOF DEEP            │
│  Testimonials | Case Study          │
├─────────────────────────────────────┤
│        HOW IT WORKS                 │
│  3-step process                     │
├─────────────────────────────────────┤
│        PRICING (if applicable)      │
│  Tiers + comparison                 │
├─────────────────────────────────────┤
│        FAQ SECTION                  │
│  Objection handling                 │
├─────────────────────────────────────┤
│        FINAL CTA                    │
│  Strong close + form                │
├─────────────────────────────────────┤
│           FOOTER                    │
│  Links | Legal | Contact            │
└─────────────────────────────────────┘
```

---

## 3. Section Specifications

### 3.1 Hero Section

| Element | Specification |
|---------|---------------|
| **H1** | [From CopyDeck] - Max 60 chars |
| **Subheadline** | [From CopyDeck] - Max 120 chars |
| **Primary CTA** | Button: "[Text]" → [Action] |
| **Secondary CTA** | Link: "[Text]" → [Action] |
| **Visual** | [Screenshot | Demo Video | Illustration] |
| **Background** | [Solid | Gradient | Image] |

**CRO Notes**:
- [ ] CTA above fold on all devices
- [ ] Single, clear value proposition
- [ ] No competing CTAs

### 3.2 Social Proof Bar

| Element | Specification |
|---------|---------------|
| **Logo Count** | 4-6 logos (grayscale) |
| **Text** | "Trusted by X+ companies" |
| **Logos** | [List specific logos] |

**CRO Notes**:
- [ ] Recognizable brands if possible
- [ ] Hover effect: color on hover

### 3.3 Problem Section

| Element | Specification |
|---------|---------------|
| **Headline** | [From CopyDeck] |
| **Pain Points** | 3 items with icons |
| **Visual** | [Before state illustration] |

**CRO Notes**:
- [ ] Emotionally resonant language
- [ ] Specific, relatable scenarios

### 3.4 Solution Section

| Element | Specification |
|---------|---------------|
| **Headline** | [From CopyDeck] |
| **Description** | [From CopyDeck] |
| **Visual** | [Product screenshot / demo] |

**CRO Notes**:
- [ ] Clear before/after contrast
- [ ] Specific outcomes, not features

### 3.5 Features Grid

| Feature | Icon | Headline | Description |
|---------|------|----------|-------------|
| 1 | [Icon] | [Headline] | [1-2 sentences] |
| 2 | [Icon] | [Headline] | [1-2 sentences] |
| 3 | [Icon] | [Headline] | [1-2 sentences] |

**CRO Notes**:
- [ ] Benefits > Features
- [ ] Scannable layout
- [ ] Icons consistent style

### 3.6 Testimonial Section

| Element | Specification |
|---------|---------------|
| **Format** | [Single Quote | Carousel | Grid] |
| **Quote** | [From CopyDeck] |
| **Attribution** | Name, Title, Company |
| **Photo** | Required: professional headshot |
| **Logo** | Company logo below quote |
| **Metric** | [Specific result achieved] |

**CRO Notes**:
- [ ] Real names and photos
- [ ] Specific, quantified results
- [ ] Relevant to target persona

### 3.7 How It Works

| Step | Icon | Title | Description |
|------|------|-------|-------------|
| 1 | [Icon] | [Title] | [Description] |
| 2 | [Icon] | [Title] | [Description] |
| 3 | [Icon] | [Title] | [Description] |

**CRO Notes**:
- [ ] 3 steps maximum
- [ ] Simple, jargon-free
- [ ] Visual progression

### 3.8 FAQ Section

| Question | Answer | Objection Addressed |
|----------|--------|---------------------|
| [Q1] | [A1] | [e.g., Price concern] |
| [Q2] | [A2] | [e.g., Implementation time] |
| [Q3] | [A3] | [e.g., Technical complexity] |

**CRO Notes**:
- [ ] Address real objections
- [ ] Accordion for space efficiency
- [ ] Schema.org FAQPage markup

### 3.9 Final CTA Section

| Element | Specification |
|---------|---------------|
| **Headline** | [Urgency/value focused] |
| **Subheadline** | [Risk reversal] |
| **CTA Button** | [Same as hero] |
| **Form Fields** | [If applicable] |
| **Trust Badges** | [Security | Guarantee] |

**CRO Notes**:
- [ ] Repeat primary CTA
- [ ] Add urgency if appropriate
- [ ] Include guarantee/risk reversal

---

## 4. Form Specification

### Fields
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| Name | text | Yes | Min 2 chars |
| Work Email | email | Yes | Business domain |
| Company | text | Yes | Min 2 chars |
| Company Size | select | Yes | [Options] |
| Message | textarea | No | Max 500 chars |

### Form Behavior
- [ ] Multi-step (if >4 fields)
- [ ] Inline validation
- [ ] Progress indicator
- [ ] Clear error messages
- [ ] Success state/redirect

### Anti-Spam
- [ ] Honeypot field
- [ ] Rate limiting
- [ ] Domain validation (no free email)

---

## 5. CRO Elements

### Trust Signals
- [ ] Client logos
- [ ] Security badges (SSL, SOC2 if applicable)
- [ ] Review scores (G2, Capterra)
- [ ] Guarantee badge
- [ ] "No credit card required" (if applicable)

### Urgency/Scarcity (Use Sparingly)
- [ ] Limited availability
- [ ] Deadline-based offer
- [ ] Social proof notifications

### Exit Intent
- [ ] Popup type: [Offer | Alternative CTA | Survey]
- [ ] Trigger: Mouse leaves viewport (desktop)
- [ ] Mobile: Scroll up behavior

### Sticky Elements
- [ ] Sticky CTA bar (mobile)
- [ ] Sticky nav with CTA (desktop)

---

## 6. Responsive Breakpoints

| Breakpoint | Width | Key Changes |
|------------|-------|-------------|
| Mobile | <640px | Single column, stacked elements |
| Tablet | 640-1024px | 2-column where appropriate |
| Desktop | >1024px | Full layout |

### Mobile-Specific
- [ ] Thumb-friendly tap targets (min 44px)
- [ ] Reduced hero height
- [ ] Collapsible sections
- [ ] Sticky mobile CTA bar
- [ ] Click-to-call enabled

---

## 7. Performance Requirements

| Metric | Target |
|--------|--------|
| LCP | <2.5s |
| FID | <100ms |
| CLS | <0.1 |
| Total Size | <500KB initial |
| Time to Interactive | <3s |

### Optimization Checklist
- [ ] Images: WebP/AVIF, lazy loading below fold
- [ ] Fonts: Subset, preload critical
- [ ] JS: Code split, defer non-critical
- [ ] CSS: Critical inline, purge unused

---

## 8. Tracking Requirements

### Events to Track
| Event | Trigger | Parameters |
|-------|---------|------------|
| `page_view` | Page load | page_path, page_title |
| `scroll_depth` | 25%, 50%, 75%, 100% | depth_percentage |
| `cta_click` | Any CTA click | cta_text, cta_location |
| `form_start` | First field focus | form_name |
| `form_submit` | Form submission | form_name, fields_count |
| `form_error` | Validation error | field_name, error_type |
| `video_play` | Video starts | video_name |
| `exit_intent` | Exit popup shown | popup_type |

### UTM Parameters
- Preserve through form submission
- Store in hidden fields

---

## 9. Handoff to Dev Team

### To @ui-designer
- [ ] Section layouts approved
- [ ] Mobile wireframes complete
- [ ] Component list defined
- [ ] Animation notes included

### To @component-builder
- [ ] All sections specified
- [ ] shadcn/ui components identified
- [ ] Custom components documented
- [ ] Responsive behavior defined

### Assets Required
- [ ] Hero visual/screenshot
- [ ] Client logos (SVG)
- [ ] Team/author photos
- [ ] Product screenshots
- [ ] Icons (from Lucide)

---

## 10. Approvals

| Role | Name | Date | Status |
|------|------|------|--------|
| CRO Designer | | | [ ] Pending |
| Copywriter | | | [ ] Pending |
| UI Designer | | | [ ] Pending |

---

## 11. Change Log

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| YYYY-MM-DD | 1.0 | Initial spec | @cro-designer |
