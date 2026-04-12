# SEO Checklist Template

> **Owner**: @tech-seo-specialist
> **Version**: 1.1
> **Status**: [Pre-Launch | Post-Launch | Audit]

---

## 1. Page Info

| Field | Value |
|-------|-------|
| **Page URL** | |
| **Primary Keyword** | |
| **Secondary Keywords** | |
| **Target Intent** | [Informational | Commercial | Transactional] |
| **Strategy Brief** | [Link] |
| **Copy Deck** | [Link] |

---

## 2. On-Page SEO

### Title & Meta

- [ ] **Title Tag** (50-60 chars)
  - Contains primary keyword
  - Compelling for CTR
  - Unique across site
  - Current: `[title]`

- [ ] **Meta Description** (150-160 chars)
  - Contains primary keyword
  - Includes CTA/value prop
  - Unique across site
  - Current: `[description]`

- [ ] **Canonical URL** set correctly
  - `<link rel="canonical" href="[URL]" />`

- [ ] **Robots meta** appropriate
  - `index, follow` for public pages
  - `noindex` for utility pages

### Open Graph

- [ ] `og:title` set
- [ ] `og:description` set
- [ ] `og:image` (1200x630px)
- [ ] `og:url` matches canonical
- [ ] `og:type` = website/article
- [ ] `og:locale` = it_IT / en_US / cs_CZ

### Twitter Card

- [ ] `twitter:card` = summary_large_image
- [ ] `twitter:title` set
- [ ] `twitter:description` set
- [ ] `twitter:image` set

---

## 3. Content Structure

### Headings

- [ ] **H1** (exactly 1)
  - Contains primary keyword
  - Current: `[H1 text]`

- [ ] **H2s** (logical structure)
  - Include secondary keywords
  - List:
    1. [H2]
    2. [H2]
    3. [H2]

- [ ] **H3-H6** used for subsections
  - Proper hierarchy (no skipping levels)

### Content Quality

- [ ] Unique content (no duplicates)
- [ ] Sufficient word count for intent (min 300 for landing)
- [ ] Primary keyword in first 100 words
- [ ] Natural keyword placement (no stuffing)
- [ ] Internal links to related pages (2-3 minimum)
- [ ] External links to authoritative sources (if applicable)

---

## 4. Technical SEO

### Performance (Core Web Vitals)

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| LCP | <2.5s | | [ ] Pass |
| FID/INP | <100ms | | [ ] Pass |
| CLS | <0.1 | | [ ] Pass |

### Mobile

- [ ] Mobile-friendly (responsive)
- [ ] Tap targets >44px
- [ ] No horizontal scroll
- [ ] Text readable without zoom
- [ ] Mobile-first CSS

### Speed Optimizations

- [ ] Images optimized (WebP/AVIF)
- [ ] Images have width/height (prevent CLS)
- [ ] Lazy loading below fold
- [ ] Critical CSS inlined
- [ ] JS deferred/async
- [ ] Font preloading
- [ ] Gzip/Brotli compression

### Crawlability

- [ ] Page in sitemap.xml
- [ ] No blocked by robots.txt
- [ ] Internal links discoverable
- [ ] No orphan pages
- [ ] Reasonable crawl depth (<4 clicks from home)

---

## 5. Schema.org Markup

### Required Schemas

- [ ] **Organization** (site-wide)
```json
{
  "@type": "Organization",
  "name": "[Company]",
  "url": "[URL]",
  "logo": "[Logo URL]",
  "sameAs": ["[Social URLs]"]
}
```

- [ ] **WebSite** (homepage)
```json
{
  "@type": "WebSite",
  "name": "[Site Name]",
  "url": "[URL]"
}
```

### Page-Specific Schemas

- [ ] **WebPage** or specific type
```json
{
  "@type": "WebPage",
  "name": "[Page Title]",
  "description": "[Description]"
}
```

- [ ] **FAQPage** (if FAQ section)
```json
{
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "[Q]",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "[A]"
      }
    }
  ]
}
```

- [ ] **Product** (if pricing page)
- [ ] **Service** (if service page)
- [ ] **Article** (if blog post)
- [ ] **BreadcrumbList** (if breadcrumbs)
- [ ] **LocalBusiness** (if local business)

### Validation

- [ ] Tested with Google Rich Results Test
- [ ] No errors in schema
- [ ] No warnings (or documented exceptions)

---

## 6. International SEO (i18n)

### URL Structure

- [ ] Locale in path: `/it/`, `/en/`, `/cs/`
- [ ] Consistent structure across languages

### Hreflang Tags

```html
<link rel="alternate" hreflang="it" href="[IT URL]" />
<link rel="alternate" hreflang="en" href="[EN URL]" />
<link rel="alternate" hreflang="cs" href="[CS URL]" />
<link rel="alternate" hreflang="x-default" href="[Default URL]" />
```

- [ ] All language versions linked
- [ ] Self-referential hreflang included
- [ ] x-default set
- [ ] No hreflang conflicts

### Content Localization

- [ ] Content translated (not just machine-translated)
- [ ] Local keywords researched
- [ ] Currency/date formats localized
- [ ] Contact info localized

---

## 7. Links

### Internal Links

| Link Text | Destination | Purpose |
|-----------|-------------|---------|
| [Anchor] | [URL] | [Why] |
| [Anchor] | [URL] | [Why] |

- [ ] Descriptive anchor text (not "click here")
- [ ] Links to relevant pages
- [ ] No broken internal links

### External Links

| Link Text | Destination | Rel Attribute |
|-----------|-------------|---------------|
| [Anchor] | [URL] | nofollow/sponsored/ugc |

- [ ] External links open in new tab
- [ ] `rel="noopener"` on external links
- [ ] Appropriate rel attributes

---

## 8. Images

### Image Optimization

| Image | Alt Text | Size | Format | Lazy |
|-------|----------|------|--------|------|
| Hero | [Alt] | [KB] | WebP | No |
| Feature 1 | [Alt] | [KB] | WebP | Yes |
| Logo X | [Alt] | [KB] | SVG | Yes |

- [ ] All images have alt text
- [ ] Alt text descriptive and includes keywords where natural
- [ ] Images compressed
- [ ] Modern formats (WebP/AVIF)
- [ ] Responsive images (srcset)
- [ ] Lazy loading below fold
- [ ] Width/height attributes set

---

## 9. Security & Trust

- [ ] HTTPS enabled
- [ ] No mixed content warnings
- [ ] Security headers configured
  - [ ] Strict-Transport-Security
  - [ ] X-Content-Type-Options
  - [ ] X-Frame-Options
- [ ] Privacy policy linked
- [ ] Terms of service linked
- [ ] Cookie consent (GDPR compliant)

---

## 10. Tracking & Analytics

### Google Search Console

- [ ] Site verified
- [ ] Sitemap submitted
- [ ] No crawl errors
- [ ] No security issues

### Google Analytics 4

- [ ] Tracking code installed
- [ ] Enhanced measurement enabled
- [ ] Conversions configured
- [ ] No PII in URLs

### Events to Track

| Event | Implemented | Tested |
|-------|-------------|--------|
| page_view | [ ] | [ ] |
| form_submit | [ ] | [ ] |
| cta_click | [ ] | [ ] |
| scroll_depth | [ ] | [ ] |

---

## 11. Pre-Launch Checks

### Technical

- [ ] All pages return 200 status
- [ ] No 404 errors from internal links
- [ ] Redirects working (if migrating)
- [ ] Sitemap valid and accessible
- [ ] Robots.txt correct

### Content

- [ ] No placeholder text
- [ ] No Lorem Ipsum
- [ ] All links working
- [ ] Images displaying correctly
- [ ] Forms submitting correctly

### Tools Validation

- [ ] Google PageSpeed Insights (90+ on all metrics)
- [ ] Google Rich Results Test (no errors)
- [ ] Mobile-Friendly Test (passed)
- [ ] W3C HTML Validator (no critical errors)
- [ ] Lighthouse SEO audit (90+)

---

## 12. Post-Launch Monitoring

### Week 1

- [ ] Verify indexing in Search Console
- [ ] Check for crawl errors
- [ ] Monitor 404s
- [ ] Verify analytics tracking
- [ ] Test all conversions

### Month 1

- [ ] Review Search Console performance
- [ ] Check keyword rankings
- [ ] Analyze user behavior
- [ ] Identify improvement opportunities

### Ongoing

- [ ] Monthly ranking checks
- [ ] Quarterly content audits
- [ ] Regular Core Web Vitals monitoring
- [ ] Competitor analysis updates

---

## 13. Keyword Research Summary

### Primary Keyword

| Attribute | Value |
|-----------|-------|
| **Keyword** | |
| **Search Volume** | |
| **Difficulty** | |
| **Current Ranking** | |
| **Target Ranking** | |
| **SERP Features** | |

### Secondary Keywords

| Keyword | Volume | Difficulty | Target |
|---------|--------|------------|--------|
| | | | |
| | | | |
| | | | |

### Long-Tail Opportunities

| Keyword | Volume | Page Assignment |
|---------|--------|-----------------|
| | | |
| | | |

---

## 14. Competitor Analysis

| Competitor | URL | DA | Primary Keyword Rank |
|------------|-----|----|--------------------|
| | | | |
| | | | |
| | | | |

### Content Gap Opportunities

- [ ] [Topic not covered by competitors]
- [ ] [Topic we can cover better]

---

## 15. Approvals

| Check | Reviewer | Date | Status |
|-------|----------|------|--------|
| On-Page SEO | | | [ ] Pass |
| Technical SEO | | | [ ] Pass |
| Schema Markup | | | [ ] Pass |
| Performance | | | [ ] Pass |

---

## 16. Change Log

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| YYYY-MM-DD | 1.0 | Initial checklist | @tech-seo-specialist |
