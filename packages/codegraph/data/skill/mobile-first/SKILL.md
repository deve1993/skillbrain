---
name: mobile-first
description: Mobile-first design knowledge base - thumb zone, touch targets, responsive patterns, Core Web Vitals. Use when optimizing for mobile, improving touch UX, implementing responsive layouts, or auditing mobile performance.
version: 1.0.0
---

# Mobile-First Design Skill

Knowledge base per design e sviluppo mobile-first in applicazioni B2B tech.

---

## Perché Mobile-First per B2B

> **60%+ del traffico B2B è mobile**. CTO, PM e developer navigano su mobile durante commute, riunioni e fuori ufficio.

### Statistiche Chiave
- 67% dei decision-maker B2B inizia la ricerca su mobile
- 50% delle query B2B sono da smartphone
- Bounce rate mobile è 2x desktop se UX è scarsa
- Mobile-first indexing di Google dal 2019

---

## Thumb Zone Design

### La Zona di Comfort

```
┌─────────────────────────┐
│                         │
│    ⚠️ HARD TO REACH     │  Evitare CTA qui
│                         │
├─────────────────────────┤
│                         │
│    ✅ NATURAL REACH     │  CTA secondarie
│                         │
├─────────────────────────┤
│                         │
│    🎯 EASY TO REACH     │  CTA primarie, nav
│                         │  Form submit buttons
└─────────────────────────┘
        👍 Thumb
```

### Regole Thumb Zone

| Zona | Posizione | Uso Consigliato |
|------|-----------|-----------------|
| **Easy** | Bottom 1/3, centro | CTA primarie, menu, form submit |
| **Natural** | Centro schermo | Content, secondary actions |
| **Hard** | Top corners, top edges | Logo, menu icon (ok), close buttons |

### Implementazione

```css
/* Sticky CTA bar nella thumb zone */
.sticky-cta {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
  background: white;
  box-shadow: 0 -4px 6px rgba(0, 0, 0, 0.1);
  z-index: 50;
}
```

---

## Touch Target Sizing

### Dimensioni Minime

| Standard | Minimo | Raccomandato | Note |
|----------|--------|--------------|------|
| **Apple HIG** | 44x44pt | 48x48pt | iOS standard |
| **Material Design** | 48x48dp | 48x48dp | Android standard |
| **WCAG 2.5.5** | 44x44px | - | Accessibility requirement |

### Implementazione Tailwind

```html
<!-- ✅ Touch-friendly button (48px = h-12) -->
<button class="h-12 px-6 min-w-[48px]">
  Prenota Demo
</button>

<!-- ✅ Touch-friendly link -->
<a class="inline-flex items-center min-h-[48px] py-3 px-4">
  Scopri di più
</a>

<!-- ❌ Troppo piccolo -->
<button class="h-8 px-3">
  Submit
</button>
```

### Spacing tra Target

```css
/* Minimo 8px tra elementi tappabili */
.touch-list > * + * {
  margin-top: 8px;
}

/* Per form fields */
.form-group + .form-group {
  margin-top: 16px; /* Più breathing room */
}
```

### Checklist Touch Target

- [ ] Tutti i button sono almeno 44x44px
- [ ] Link inline hanno padding sufficiente
- [ ] Checkbox/radio hanno area tap estesa
- [ ] Spacing minimo 8px tra elementi tappabili
- [ ] Close button è facilmente raggiungibile

---

## Mobile Performance

### Network-Aware Loading

```typescript
// Hook per rilevare tipo connessione
function useNetworkStatus() {
  const [status, setStatus] = useState({
    effectiveType: '4g',
    saveData: false,
  });

  useEffect(() => {
    const connection = navigator.connection || 
                      navigator.mozConnection || 
                      navigator.webkitConnection;
    
    if (connection) {
      setStatus({
        effectiveType: connection.effectiveType,
        saveData: connection.saveData,
      });
    }
  }, []);

  return status;
}

// Uso
function HeroImage() {
  const { effectiveType, saveData } = useNetworkStatus();
  
  // Su connessioni lente, usa immagini più leggere
  const quality = effectiveType === '4g' && !saveData ? 'high' : 'low';
  
  return (
    <Image
      src={`/hero-${quality}.webp`}
      placeholder="blur"
      priority
    />
  );
}
```

### Budget Performance Mobile

| Metrica | Target Mobile | Note |
|---------|---------------|------|
| **Total Page Weight** | < 500KB | Compresso |
| **JavaScript** | < 150KB | Parsed |
| **CSS** | < 30KB | Compresso |
| **Largest Image** | < 100KB | Above fold |
| **Time to Interactive** | < 3.5s | 3G throttled |
| **First Contentful Paint** | < 1.8s | 3G throttled |

### Lazy Loading Strategy

```typescript
// components/LazySection.tsx
import dynamic from 'next/dynamic';

// Lazy load sezioni below the fold
const Testimonials = dynamic(() => import('./Testimonials'), {
  loading: () => <TestimonialsSkeleton />,
  ssr: false, // Solo client per sezioni non critiche SEO
});

const CaseStudies = dynamic(() => import('./CaseStudies'), {
  loading: () => <CaseStudiesSkeleton />,
});

// Intersection Observer per trigger preciso
function LazySection({ children }: { children: React.ReactNode }) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' } // Preload 100px prima
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref}>
      {isVisible ? children : <SectionSkeleton />}
    </div>
  );
}
```

---

## PWA Patterns

### Installability Checklist

```json
// manifest.json
{
  "name": "Your App Name",
  "short_name": "AppName",
  "description": "Description for B2B app",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0066cc",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### Service Worker (Base)

```typescript
// next.config.js con next-pwa
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
});

module.exports = withPWA({
  // altre config
});
```

### Offline Fallback

```typescript
// pages/_offline.tsx
export default function OfflinePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-4">
        Sei offline
      </h1>
      <p className="text-muted-foreground text-center mb-6">
        Controlla la connessione e riprova.
      </p>
      <button 
        onClick={() => window.location.reload()}
        className="px-6 py-3 bg-primary text-white rounded-lg"
      >
        Riprova
      </button>
    </div>
  );
}
```

### Install Prompt (B2B Context)

```typescript
// Solo mostrare install prompt dopo engagement
function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Mostra solo dopo scroll 50% o 60 secondi
  useEffect(() => {
    const timer = setTimeout(() => {
      if (deferredPrompt) setShowPrompt(true);
    }, 60000);

    const scrollHandler = () => {
      const scrolled = window.scrollY / document.body.scrollHeight;
      if (scrolled > 0.5 && deferredPrompt) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('scroll', scrollHandler);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', scrollHandler);
    };
  }, [deferredPrompt]);

  const promptInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  return { showPrompt, promptInstall };
}
```

---

## Gesture Patterns

### Swipe Navigation

```typescript
// Hook per swipe detection
import { useSwipeable } from 'react-swipeable';

function ImageCarousel({ images }: { images: string[] }) {
  const [index, setIndex] = useState(0);

  const handlers = useSwipeable({
    onSwipedLeft: () => setIndex(i => Math.min(i + 1, images.length - 1)),
    onSwipedRight: () => setIndex(i => Math.max(i - 1, 0)),
    trackMouse: false, // Solo touch
    trackTouch: true,
    delta: 50, // Minimo swipe distance
  });

  return (
    <div {...handlers} className="overflow-hidden">
      <div 
        className="flex transition-transform duration-300"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {images.map((src, i) => (
          <img key={i} src={src} className="w-full flex-shrink-0" />
        ))}
      </div>
    </div>
  );
}
```

### Pull-to-Refresh

```typescript
// Per app-like experience (usare con cautela su landing page)
function PullToRefresh({ onRefresh, children }) {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);

  const handleTouchStart = (e: TouchEvent) => {
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY;
      setPulling(true);
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (pulling) {
      const distance = e.touches[0].clientY - startY.current;
      setPullDistance(Math.max(0, Math.min(distance, 100)));
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance > 60) {
      onRefresh();
    }
    setPulling(false);
    setPullDistance(0);
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {pullDistance > 0 && (
        <div className="flex justify-center py-2">
          <RefreshIcon className={pullDistance > 60 ? 'animate-spin' : ''} />
        </div>
      )}
      {children}
    </div>
  );
}
```

### Gesture Affordances

```css
/* Indicatore swipe per carousel */
.carousel-indicator {
  display: flex;
  justify-content: center;
  gap: 8px;
  padding: 16px;
}

.carousel-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.2);
  transition: all 0.2s;
}

.carousel-dot.active {
  background: var(--primary);
  width: 24px;
  border-radius: 4px;
}
```

---

## Mobile Form Optimization

### Input Best Practices

```html
<!-- ✅ Email input ottimizzato -->
<input
  type="email"
  inputMode="email"
  autoComplete="email"
  autoCapitalize="none"
  spellCheck="false"
  className="text-[16px]" /* Previene zoom iOS */
/>

<!-- ✅ Phone input -->
<input
  type="tel"
  inputMode="tel"
  autoComplete="tel"
/>

<!-- ✅ Number input -->
<input
  type="text" /* Non type="number" - problemi UX */
  inputMode="numeric"
  pattern="[0-9]*"
/>
```

### Form Layout Mobile

```html
<!-- ✅ Single column, stacked -->
<form className="space-y-4">
  <div>
    <label className="block text-sm font-medium mb-2">Nome</label>
    <input className="w-full h-12 px-4 text-[16px] rounded-lg border" />
  </div>
  
  <div>
    <label className="block text-sm font-medium mb-2">Email</label>
    <input className="w-full h-12 px-4 text-[16px] rounded-lg border" />
  </div>
  
  <!-- Submit nella thumb zone -->
  <button className="w-full h-12 bg-primary text-white rounded-lg font-medium">
    Invia Richiesta
  </button>
</form>
```

### Keyboard Handling

```typescript
// Scroll to input quando keyboard appare
function useKeyboardAwareness() {
  useEffect(() => {
    const inputs = document.querySelectorAll('input, textarea');
    
    inputs.forEach(input => {
      input.addEventListener('focus', (e) => {
        // Delay per aspettare keyboard animation
        setTimeout(() => {
          (e.target as HTMLElement).scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }, 300);
      });
    });
  }, []);
}
```

### Form Error States Mobile

```css
/* Error visibile e touch-friendly */
.input-error {
  border-color: hsl(var(--destructive));
  background-color: hsl(var(--destructive) / 0.05);
}

.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  margin-top: 8px;
  font-size: 14px;
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 0.1);
  border-radius: 6px;
}
```

---

## Viewport & Responsive Patterns

### Viewport Meta

```html
<!-- Standard viewport -->
<meta 
  name="viewport" 
  content="width=device-width, initial-scale=1, viewport-fit=cover"
/>
```

### Safe Areas (Notch, Home Indicator)

```css
/* Padding per safe areas */
.full-screen-modal {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}

/* Sticky footer con safe area */
.sticky-footer {
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
}
```

### Breakpoint Strategy (Mobile-First)

```css
/* Tailwind default - Mobile First */

/* Base: Mobile (< 640px) */
.container { padding: 16px; }

/* sm: Tablet portrait (≥ 640px) */
@media (min-width: 640px) {
  .container { padding: 24px; }
}

/* md: Tablet landscape (≥ 768px) */
@media (min-width: 768px) {
  .container { padding: 32px; }
}

/* lg: Desktop (≥ 1024px) */
@media (min-width: 1024px) {
  .container { padding: 48px; }
}
```

### Container Queries (Modern)

```css
/* Per componenti che si adattano al container, non viewport */
@container (min-width: 400px) {
  .card {
    flex-direction: row;
  }
}
```

---

## Core Web Vitals Mobile-Specific

### LCP Mobile Optimization

```typescript
// Preload hero image mobile
<link
  rel="preload"
  as="image"
  href="/hero-mobile.webp"
  media="(max-width: 768px)"
/>

// Next.js Image priority
<Image
  src="/hero.webp"
  priority
  sizes="(max-width: 768px) 100vw, 50vw"
/>
```

### INP (Interaction to Next Paint)

```typescript
// Evitare long tasks su mobile
function handleClick() {
  // ❌ Blocca il main thread
  heavyComputation();
  
  // ✅ Defer heavy work
  requestIdleCallback(() => {
    heavyComputation();
  });
  
  // ✅ O usa Web Worker
  worker.postMessage({ type: 'compute', data });
}

// ✅ useTransition per state updates
function FilterList() {
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState('');
  
  const handleChange = (value: string) => {
    startTransition(() => {
      setFilter(value); // Non blocca l'input
    });
  };
}
```

### CLS Mobile Prevention

```css
/* Aspect ratio per immagini */
.image-container {
  aspect-ratio: 16 / 9;
  background: #f0f0f0; /* Placeholder color */
}

/* Font con size-adjust per FOIT/FOUT */
@font-face {
  font-family: 'Inter';
  src: url('/fonts/Inter.woff2') format('woff2');
  font-display: swap;
  size-adjust: 100%;
  ascent-override: 90%;
  descent-override: 20%;
}

/* Skeleton per dynamic content */
.skeleton {
  background: linear-gradient(
    90deg,
    #f0f0f0 25%,
    #e0e0e0 50%,
    #f0f0f0 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
```

### Performance Budget Mobile

```javascript
// performance-budget.json (per CI/CD)
{
  "budgets": [
    {
      "resourceType": "document",
      "budget": 50
    },
    {
      "resourceType": "script",
      "budget": 150
    },
    {
      "resourceType": "stylesheet",
      "budget": 30
    },
    {
      "resourceType": "image",
      "budget": 200
    },
    {
      "resourceType": "total",
      "budget": 500
    },
    {
      "metric": "first-contentful-paint",
      "budget": 1800
    },
    {
      "metric": "interactive",
      "budget": 3500
    },
    {
      "metric": "cumulative-layout-shift",
      "budget": 0.1
    }
  ]
}
```

---

## Mobile Testing Checklist

### Device Testing

- [ ] iPhone SE (small screen: 375px)
- [ ] iPhone 14/15 (standard: 390px)
- [ ] iPhone 14/15 Pro Max (large: 430px)
- [ ] Android (Samsung Galaxy: 360px)
- [ ] Tablet Portrait (768px)
- [ ] Tablet Landscape (1024px)

### Interaction Testing

- [ ] Touch targets ≥ 44px
- [ ] Swipe gestures work
- [ ] Forms usable with keyboard
- [ ] No horizontal scroll
- [ ] Sticky elements don't overlap content
- [ ] Safe areas respected

### Performance Testing

- [ ] Lighthouse Mobile > 90
- [ ] LCP < 2.5s on 3G
- [ ] TTI < 3.5s on 3G
- [ ] CLS < 0.1
- [ ] Page weight < 500KB

### Accessibility Mobile

- [ ] Text readable without zoom
- [ ] Sufficient color contrast
- [ ] Focus visible su touch
- [ ] VoiceOver/TalkBack compatible
- [ ] Reduce motion respected

---

## Tools Consigliati

| Tool | Uso |
|------|-----|
| **Chrome DevTools** | Device emulation, throttling |
| **Lighthouse** | Performance audit mobile |
| **BrowserStack** | Real device testing |
| **PageSpeed Insights** | Field data mobile |
| **WebPageTest** | Detailed mobile metrics |
| **Responsively App** | Multi-device preview |

---

**Versione**: 1.0.0
**Ultimo aggiornamento**: Gennaio 2026
