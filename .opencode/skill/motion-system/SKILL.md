---
name: motion-system
description: Structured motion design system - 4 layers from CSS/Tailwind to Framer Motion to Canvas, accessibility-aware. Use when implementing complex animations, building motion design systems, or choosing the right animation layer for a feature.
version: 1.0.0
---

# Motion System Skill

Questo sistema definisce un approccio strutturato al motion design per applicazioni Next.js 15+ e React, bilanciando performance, accessibilità e impatto visivo. Il sistema è organizzato in 4 livelli di complessità crescente, permettendo di scegliere lo strumento più leggero ed efficace per ogni specifica interazione.

## Layer 1 — CSS/Tailwind (Zero JS)

Il primo livello si basa esclusivamente su CSS e Tailwind CSS 4. È la scelta obbligata per interazioni semplici, stati UI e animazioni che devono essere eseguite istantaneamente senza caricare librerie JavaScript.

### Tailwind Transition Utilities
Utilizzare le utility native per gestire hover, focus e transizioni di stato.

```tsx
// Esempio di bottone con transizioni CSS pure
<button className="
  bg-primary px-6 py-2 rounded-lg text-white
  transition-all duration-200 ease-out
  hover:bg-primary/90 hover:scale-105
  active:scale-95
  focus:ring-2 focus:ring-primary/50 focus:outline-none
">
  Click Me
</button>
```

### Custom Keyframes in Tailwind 4
In Tailwind 4, le animazioni personalizzate vengono definite direttamente nel file CSS globale utilizzando le variabili CSS nel blocco `@theme`.

```css
/* src/app/globals.css */
@import "tailwindcss";

@theme {
  /* Definizione di keyframes personalizzati */
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }

  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  /* Esposizione come utility Tailwind */
  --animate-float: float 3s ease-in-out infinite;
  --animate-shimmer: shimmer 2s infinite linear;
}
```

### Skeleton Loading
Le animazioni di caricamento dovrebbero sempre usare CSS puro per evitare layout shift durante l'idratazione di React.

```tsx
export function SkeletonCard() {
  return (
    <div className="w-full h-48 rounded-xl bg-slate-200 overflow-hidden relative">
      <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent animate-shimmer" 
           style={{ backgroundSize: '200% 100%' }} />
    </div>
  );
}
```

### Accessibilità (Reduced Motion)
Rispettare sempre le preferenze dell'utente per la riduzione del movimento.

```css
/* Disabilita le animazioni se l'utente ha attivato "Reduce Motion" */
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after {
    animation-delay: -1ms !important;
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    background-attachment: initial !important;
    scroll-behavior: auto !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
  }
}
```

## Layer 2 — Framer Motion (Primary React Tool)

Framer Motion è lo standard per le animazioni React. Offre un'API dichiarativa potente per gestire ingressi, uscite, gesti e orchestrazione complessa.

### Setup e 'use client'
Framer Motion richiede l'accesso alle API del browser, quindi i componenti che lo utilizzano devono essere Client Components.

```tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';

// Componente base
export function FadeIn({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
```

### Variants Pattern
Le varianti permettono di separare la logica dell'animazione dal markup e di orchestrare i figli.

```tsx
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1, // Ritardo tra ogni figlio
      delayChildren: 0.2    // Ritardo iniziale del container
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { type: "spring", stiffness: 100 }
  }
};

export function AnimatedList({ items }: { items: string[] }) {
  return (
    <motion.ul
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {items.map((item) => (
        <motion.li key={item} variants={itemVariants}>
          {item}
        </motion.li>
      ))}
    </motion.ul>
  );
}
```

### Scroll-Triggered Animations
Utilizzare `whileInView` per attivare animazioni quando l'elemento entra nel viewport.

```tsx
<motion.section
  initial={{ opacity: 0, scale: 0.95 }}
  whileInView={{ opacity: 1, scale: 1 }}
  viewport={{ once: true, margin: "-100px" }} // Esegue una sola volta con margine
  transition={{ duration: 0.6 }}
>
  <h2>Contenuto che appare allo scroll</h2>
</motion.section>
```

### Page Transitions (Next.js App Router)
Per implementare transizioni tra pagine nell'App Router, utilizzare il file `template.tsx` (che si rimonta ad ogni cambio rotta, a differenza di `layout.tsx`).

```tsx
// src/app/[locale]/template.tsx
'use client';

import { motion } from 'framer-motion';

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
}
```

### Layout Animations
La prop `layout` gestisce automaticamente le transizioni tra cambiamenti di posizione o dimensione nel DOM.

```tsx
<motion.div layout className="flex flex-col gap-4">
  {items.map(item => (
    <motion.div layout key={item.id}>
      {item.content}
    </motion.div>
  ))}
</motion.div>
```

## Layer 3 — GSAP ScrollTrigger (Advanced/Premium)

GSAP è la scelta ideale per esperienze "high-end" che richiedono un controllo millimetrico sullo scroll, pinning di sezioni o timeline estremamente complesse.

### Installazione e Registrazione
```bash
npm install gsap @gsap/react
```

```tsx
'use client';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { useRef } from 'react';

gsap.registerPlugin(ScrollTrigger);
```

### useGSAP Hook
L'hook `useGSAP` gestisce automaticamente il cleanup delle animazioni, prevenendo memory leak e problemi con il React Strict Mode.

```tsx
export function ParallaxHero() {
  const container = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    // Animazione legata allo scroll (scrub)
    gsap.to(box.current, {
      y: 200,
      rotation: 360,
      scrollTrigger: {
        trigger: container.current,
        start: "top top",
        end: "bottom top",
        scrub: true, // L'animazione segue la posizione dello scroll
        pin: true,   // Blocca il container durante l'animazione
      }
    });
  }, { scope: container }); // Scope limita i selettori al container

  return (
    <div ref={container} className="h-screen bg-slate-900 flex items-center justify-center">
      <div ref={box} className="w-20 h-20 bg-primary rounded-lg" />
    </div>
  );
}
```

### Quando usare GSAP invece di Framer Motion
1. **Scrubbing**: Quando l'animazione deve essere legata 1:1 alla posizione dello scroll.
2. **Pinning**: Quando una sezione deve rimanere fissa mentre i suoi elementi interni si animano.
3. **Timeline Complesse**: Sequenze di 10+ animazioni concatenate con timing precisi.
4. **SVG Morphing**: Trasformazioni complesse di path SVG.

## Reusable Components

### 1. ScrollReveal
Un wrapper versatile per far apparire elementi allo scroll.

```tsx
// components/motion/scroll-reveal.tsx
'use client';

import { motion } from 'framer-motion';

interface ScrollRevealProps {
  children: React.ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right';
  delay?: number;
}

export function ScrollReveal({ children, direction = 'up', delay = 0 }: ScrollRevealProps) {
  const directions = {
    up: { y: 40 },
    down: { y: -40 },
    left: { x: 40 },
    right: { x: -40 },
  };

  return (
    <motion.div
      initial={{ opacity: 0, ...directions[direction] }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ 
        duration: 0.7, 
        delay, 
        ease: [0.21, 0.47, 0.32, 0.98] // Custom cubic-bezier per un feel premium
      }}
    >
      {children}
    </motion.div>
  );
}
```

### 2. StaggerChildren
Container per animare liste di elementi in sequenza.

```tsx
// components/motion/stagger-children.tsx
'use client';

import { motion } from 'framer-motion';

export function StaggerChildren({ children, stagger = 0.1 }: { children: React.ReactNode, stagger?: number }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { staggerChildren: stagger }
        }
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
      }}
    >
      {children}
    </motion.div>
  );
}
```

### 3. PageTransition
Wrapper per transizioni fluide tra le pagine.

```tsx
// components/motion/page-transition.tsx
'use client';

import { motion } from 'framer-motion';

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, filter: "blur(10px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, filter: "blur(10px)" }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
}
```

### 4. ParallaxSection
Sezione con sfondo parallasse gestita da GSAP.

```tsx
// components/motion/parallax-section.tsx
'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

export function ParallaxSection({ children, bgImage }: { children: React.ReactNode, bgImage: string }) {
  const container = useRef<HTMLDivElement>(null);
  const bg = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    gsap.to(bg.current, {
      yPercent: 30,
      ease: "none",
      scrollTrigger: {
        trigger: container.current,
        start: "top bottom",
        end: "bottom top",
        scrub: true
      }
    });
  }, { scope: container });

  return (
    <section ref={container} className="relative h-[80vh] overflow-hidden flex items-center justify-center">
      <div 
        ref={bg}
        className="absolute inset-0 -z-10 h-[130%] w-full bg-cover bg-center"
        style={{ backgroundImage: `url(${bgImage})` }}
      />
      <div className="relative z-10 text-white">
        {children}
      </div>
    </section>
  );
}
```

### 5. AnimatedCounter
Contatore numerico che si anima quando entra nel viewport.

```tsx
// components/motion/animated-counter.tsx
'use client';

import { useEffect, useRef } from 'react';
import { useInView, useMotionValue, useSpring } from 'framer-motion';

export function AnimatedCounter({ value, duration = 2 }: { value: number, duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, {
    damping: 30,
    stiffness: 100,
  });
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  useEffect(() => {
    if (isInView) {
      motionValue.set(value);
    }
  }, [isInView, value, motionValue]);

  useEffect(() => {
    springValue.on("change", (latest) => {
      if (ref.current) {
        ref.current.textContent = Intl.NumberFormat("it-IT").format(Math.floor(latest));
      }
    });
  }, [springValue]);

  return <span ref={ref}>0</span>;
}
```

### 6. MagneticButton
Bottone che segue il cursore per un'esperienza interattiva premium.

```tsx
// components/motion/magnetic-button.tsx
'use client';

import { useRef, useState } from 'react';
import { motion, useSpring } from 'framer-motion';

export function MagneticButton({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const springConfig = { damping: 15, stiffness: 150 };
  const x = useSpring(0, springConfig);
  const y = useSpring(0, springConfig);

  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    const { left, top, width, height } = ref.current!.getBoundingClientRect();
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    
    // Calcola la distanza dal centro (max 30px)
    const moveX = (clientX - centerX) * 0.3;
    const moveY = (clientY - centerY) * 0.3;
    
    x.set(moveX);
    y.set(moveY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ x, y }}
      className="inline-block"
    >
      {children}
    </motion.div>
  );
}
```

## Advanced Patterns

### Shared Layout Transitions
Framer Motion permette di animare elementi tra componenti diversi utilizzando `layoutId`. Questo è ideale per gallerie o transizioni tra liste e dettagli.

```tsx
// components/motion/shared-layout.tsx
'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

export function SharedLayoutGallery({ items }: { items: any[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-3 gap-4">
      {items.map(item => (
        <motion.div
          layoutId={item.id}
          key={item.id}
          onClick={() => setSelectedId(item.id)}
          className="cursor-pointer bg-slate-200 h-40 rounded-lg"
        >
          <motion.h3 layoutId={`title-${item.id}`}>{item.title}</motion.h3>
        </motion.div>
      ))}

      <AnimatePresence>
        {selectedId && (
          <motion.div
            layoutId={selectedId}
            className="fixed inset-0 bg-white z-50 p-20"
          >
            <motion.h3 layoutId={`title-${selectedId}`} className="text-4xl">
              {items.find(i => i.id === selectedId).title}
            </motion.h3>
            <button onClick={() => setSelectedId(null)}>Close</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

### SVG Path Animations
Animare i path SVG per icone interattive o illustrazioni "draw-on".

```tsx
// components/motion/svg-draw.tsx
'use client';

import { motion } from 'framer-motion';

export function CheckmarkIcon() {
  return (
    <svg width="100" height="100" viewBox="0 0 100 100">
      <motion.path
        d="M20 50 L40 70 L80 30"
        fill="transparent"
        strokeWidth="10"
        stroke="currentColor"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
      />
    </svg>
  );
}
```

### Motion Values per Interazioni Custom
Utilizzare `useScroll` e `useTransform` per creare effetti legati alla posizione dello scroll senza usare GSAP (per casi più semplici).

```tsx
// components/motion/scroll-progress.tsx
'use client';

import { motion, useScroll, useSpring, useTransform } from 'framer-motion';

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  const backgroundColor = useTransform(
    scrollYProgress,
    [0, 1],
    ["#3b82f6", "#10b981"]
  );

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-2 z-50 origin-left"
      style={{ scaleX, backgroundColor }}
    />
  );
}
```

## Accessibility & Motion

Il movimento non deve mai essere un ostacolo alla fruizione dei contenuti.

### Gestione Programmatica di Reduced Motion
In React, possiamo usare l'hook `useReducedMotion` per adattare la logica delle animazioni.

```tsx
'use client';

import { motion, useReducedMotion } from 'framer-motion';

export function AccessibleComponent() {
  const shouldReduceMotion = useReducedMotion();

  const variants = {
    hidden: { 
      opacity: 0, 
      x: shouldReduceMotion ? 0 : -50 // Rimuove il movimento se richiesto
    },
    visible: { 
      opacity: 1, 
      x: 0 
    }
  };

  return (
    <motion.div
      variants={variants}
      initial="hidden"
      animate="visible"
    >
      Contenuto accessibile
    </motion.div>
  );
}
```

### Focus Management
Assicurarsi che gli elementi animati (come modal o menu) gestiscano correttamente il focus. Framer Motion non gestisce il focus trap nativamente; utilizzare librerie come `react-focus-lock` o i componenti di `shadcn/ui` (Radix) che lo integrano.

### Announce Changes
Se un'animazione nasconde o mostra contenuti critici, utilizzare `aria-live` per informare gli screen reader.

```tsx
<div aria-live="polite">
  {isVisible && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      Messaggio importante apparso
    </motion.div>
  )}
</div>
```

## Debugging & Tools

### Framer Motion DevTools
Non esiste un'estensione ufficiale, ma è possibile utilizzare `visualize` per debuggare i render e le animazioni.

### GSAP DevTools
GSAP offre una suite di strumenti premium (GSDevTools) per controllare le timeline (play, pause, seek).

```tsx
// Solo in development
if (process.env.NODE_ENV === 'development') {
  // GSDevTools.create();
}
```

### Chrome DevTools (Animations Tab)
Utilizzare il tab "Animations" di Chrome per:
- Rallentare le animazioni (10%, 25%).
- Ispezionare i keyframes CSS.
- Modificare le curve di easing in tempo reale.

## Decision Matrix

| Scenario | Layer | Tool | Perché |
|----------|-------|------|--------|
| Hover su bottone | Layer 1 | Tailwind | Zero JS, performance massima, feedback istantaneo. |
| Focus su input | Layer 1 | Tailwind | Accessibilità nativa, nessun overhead. |
| Skeleton loader | Layer 1 | CSS Keyframes | Evita layout shift durante l'idratazione. |
| Ingresso card lista | Layer 2 | Framer Motion | Facile gestione dello stagger e del viewport. |
| Modal / Drawer | Layer 2 | Framer Motion | Gestione perfetta del mount/unmount con AnimatePresence. |
| Page Transition | Layer 2 | Framer Motion | Integrazione semplice con template.tsx di Next.js. |
| Menu Mobile | Layer 2 | Framer Motion | Gestione stati complessi e gesti touch. |
| Drag and Drop | Layer 2 | Framer Motion | API `drag` integrata estremamente potente. |
| Parallax Background | Layer 3 | GSAP | Controllo preciso dello scrub legato allo scroll. |
| Sezione Pinning | Layer 3 | GSAP | ScrollTrigger gestisce il pinning meglio di qualsiasi altra libreria. |
| Horizontal Scroll | Layer 3 | GSAP | Trasforma lo scroll verticale in orizzontale con precisione millimetrica. |
| SVG Morphing | Layer 3 | GSAP | Plugin MorphSVG è lo standard industriale per questo task. |
| Magnetic Cursor | Layer 2 | Framer Motion | `useSpring` e `useMotionValue` sono ideali per seguire il mouse. |
| Number Counter | Layer 2 | Framer Motion | Semplice da implementare con `useSpring`. |
| Layout Reordering | Layer 2 | Framer Motion | La prop `layout` risolve problemi complessi di FLIP animation. |

## Performance Rules

1. **GPU-Accelerated Properties Only**: Animare esclusivamente `transform` (translate, scale, rotate) e `opacity`. Evitare proprietà che triggerano il layout (width, height, top, left, margin).
2. **will-change**: Utilizzare `will-change-[property]` con parsimonia solo per elementi con animazioni pesanti o persistenti. Non abusarne per evitare eccessivo consumo di memoria.
3. **Avoid Layout Thrashing**: Non leggere proprietà del DOM (come `offsetHeight`) all'interno di loop di animazione. Framer Motion e GSAP gestiscono questo internamente.
4. **Bundle Size**:
   - Framer Motion: ~30KB (Gzipped). Ottimo per la maggior parte delle app React.
   - GSAP: ~25KB base + plugin. Considerare il caricamento dinamico per sezioni specifiche.
5. **Lazy Loading GSAP**: Se GSAP è usato solo in una pagina specifica, caricarlo dinamicamente.

```tsx
// Esempio di caricamento dinamico di GSAP
const loadGSAP = async () => {
  const { gsap } = await import('gsap');
  const { ScrollTrigger } = await import('gsap/ScrollTrigger');
  gsap.registerPlugin(ScrollTrigger);
  // ... logica
};
```

## Animation Tokens

Utilizzare token standardizzati per garantire coerenza visiva in tutto il progetto.

| Nome | Durata | Easing | Caso d'uso |
|------|--------|--------|------------|
| **fast** | 150ms | ease-out | Hover, toggle, micro-interazioni. |
| **normal** | 300ms | ease-out | Ingressi/uscite di elementi medi, dropdown. |
| **slow** | 500ms | ease-in-out | Transizioni di pagina, ingressi di grandi sezioni. |
| **spring** | — | spring(1, 80, 10) | Interazioni giocose, bottoni magnetici, feedback tattile. |
| **bounce** | — | spring(1, 100, 10) | Notifiche, alert, elementi che devono attirare l'attenzione. |

## Checklist

- [ ] Layer 1: Tutte le interazioni base (hover, focus) usano transizioni Tailwind/CSS.
- [ ] Accessibilità: `prefers-reduced-motion` è rispettato (CSS o `useReducedMotion`).
- [ ] Performance: Le animazioni usano solo `transform` e `opacity`.
- [ ] Framer Motion: I componenti usano `'use client'` correttamente.
- [ ] Scroll: Le animazioni di ingresso usano `viewport={{ once: true }}` per evitare ripetizioni fastidiose.
- [ ] GSAP: Tutte le animazioni GSAP sono all'interno di un hook `useGSAP` per il cleanup automatico.
- [ ] Next.js: Le transizioni di pagina sono implementate tramite `template.tsx`.
- [ ] Tokens: Le durate e gli easing seguono i token definiti nel sistema.
- [ ] Bundle: Verificato l'impatto delle librerie sul bundle finale.
- [ ] Mobile: Le animazioni pesanti sono disabilitate o semplificate su dispositivi mobile se necessario.
