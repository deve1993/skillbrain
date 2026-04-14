---
name: landing-architecture
description: High-conversion landing page architecture - hero patterns, sections, social proof, CTA placement, shadcn templates. Use when building landing pages, structuring marketing pages, or designing conversion-focused page layouts.
version: 1.0.0
---

# Landing Architecture Skill

Knowledge base per la progettazione di Landing Page ad alta conversione per SaaS, App e servizi di sviluppo frontend.

## Struttura Landing Page ad Alta Conversione

### Anatomia della Landing Page Perfetta

Una landing page SaaS/Tech ad alta conversione segue questa struttura **dall'alto verso il basso**:

```
1. HERO SECTION (Above the Fold)
   - Headline value-driven
   - Subheadline con beneficio chiave
   - CTA primaria
   - Visual/Screenshot del prodotto
   - Trust badges (loghi clienti)

2. SOCIAL PROOF BAR
   - "Trusted by 500+ companies"
   - Loghi clienti riconoscibili
   - Rating/Reviews aggregate

3. PROBLEM AGITATION
   - Descrivi il dolore del target
   - Usa "Tu" e linguaggio diretto
   - 3 pain points specifici

4. SOLUTION SECTION
   - Come risolvi il problema
   - Transizione da problema a soluzione
   - Screenshot/Demo del prodotto

5. FEATURES/BENEFITS
   - 3-6 feature principali
   - Ogni feature = Icona + Titolo + Descrizione
   - Focus su BENEFICI non funzionalità

6. HOW IT WORKS
   - 3-4 step numerati
   - Processo semplificato
   - Riduce l'ansia da complessità

7. CASE STUDY / RESULTS
   - Numeri concreti ("+40% conversioni")
   - Quote con foto del cliente
   - Logo azienda + ruolo

8. PRICING (se applicabile)
   - 3 tier massimo
   - Evidenzia "Most Popular"
   - Anchoring psicologico

9. FAQ
   - 5-7 domande frequenti
   - Gestisci obiezioni
   - Schema.org FAQPage

10. FINAL CTA
    - Ripeti la CTA principale
    - Urgency/Scarcity se appropriato
    - Garanzia/Risk reversal
```

---

## Hero Section: Il Momento della Verità

### Formula Headline

**Pattern 1: Value Proposition Diretta**
```
[Verbo d'azione] + [Risultato desiderato] + [Senza/Con] + [Differenziatore]

Esempi:
- "Lancia il tuo SaaS in 2 settimane, non 6 mesi"
- "Design System enterprise-ready senza debito tecnico"
- "Converti il 3x dei visitatori con landing page ottimizzate"
```

**Pattern 2: Audience-First**
```
Per [Target specifico] che vogliono [Risultato]

Esempi:
- "Per startup Fintech che vogliono scalare senza riscrivere il frontend"
- "Per CTO stanchi di componenti inconsistenti"
```

**Pattern 3: Contrasto**
```
[Vecchio modo] vs [Nuovo modo con te]

Esempi:
- "Basta template WordPress. Siti Next.js che convertono."
- "Non un altro page builder. Un sistema di conversione."
```

### Subheadline

La subheadline deve:
1. Espandere la headline con dettagli
2. Includere il "come" o il "cosa"
3. Massimo 2 righe

```
Headline: "Design System che scala con te"
Subheadline: "Componenti React accessibili, documentati e pronti per il tuo brand. 
              Setup in 1 giorno, non 3 mesi."
```

### CTA Primaria

| Tipo | Esempio | Quando Usarla |
|------|---------|---------------|
| **Action-Oriented** | "Inizia Gratis" | Free trial, freemium |
| **Value-Oriented** | "Ottieni il tuo Audit" | Lead magnet |
| **Low-Commitment** | "Vedi la Demo" | High-ticket, enterprise |
| **Urgency** | "Prenota la tua Call (3 slot rimasti)" | Consulenza |

**Best Practices CTA:**
- Bottone grande, colore contrastante
- Testo massimo 4 parole
- Sotto il bottone: micro-copy rassicurante ("No carta di credito richiesta")

---

## Social Proof Section

### Tipi di Social Proof

| Tipo | Impatto | Esempio |
|------|---------|---------|
| **Loghi Clienti** | Alto | "Trusted by Stripe, Vercel, Linear" |
| **Numeri** | Alto | "2,847 aziende usano il nostro Design System" |
| **Testimonial** | Medio-Alto | Quote + Foto + Nome + Ruolo + Azienda |
| **Rating** | Medio | "4.9/5 su G2 (127 reviews)" |
| **Media Mentions** | Medio | "Featured in TechCrunch, Product Hunt" |
| **Certificazioni** | Basso-Medio | "SOC2 Compliant", "GDPR Ready" |

### Placement Strategico

```
ABOVE THE FOLD:
- Logo bar (5-7 loghi)
- "Trusted by 500+ companies"

DOPO FEATURES:
- Testimonial dettagliato con foto
- Caso studio con metriche

PRIMA DEL PRICING:
- Rating aggregato
- Numero di utenti attivi

PRIMA DEL FOOTER:
- Quote finale "game changer"
```

---

## Features vs Benefits

### La Regola d'Oro

**Feature**: Cosa fa il prodotto
**Benefit**: Cosa ottiene il cliente

| Feature (NO) | Benefit (SI) |
|--------------|--------------|
| "React Server Components" | "Pagine che caricano in <1s" |
| "Design tokens in CSS" | "Aggiorna il brand in 5 minuti" |
| "TypeScript strict mode" | "Zero bug in produzione" |
| "Componenti accessibili" | "Conforme WCAG senza sforzo" |

### Struttura Feature Block

```tsx
<FeatureCard>
  <Icon name="zap" />
  <Title>Performance 10x</Title>
  <Description>
    Le tue pagine caricano in meno di 1 secondo grazie al 
    pre-rendering e all'ottimizzazione automatica delle immagini.
  </Description>
  <MicroProof>
    "Da 4s a 0.8s di caricamento" — CTO, Fintech Corp
  </MicroProof>
</FeatureCard>
```

---

## Pricing Section

### Struttura 3-Tier

```
STARTER          PRO (MOST POPULAR)    ENTERPRISE
€497/mese        €1,497/mese           Custom

- 1 progetto     - 5 progetti          - Progetti illimitati
- Support email  - Support prioritario - Account manager
- Componenti base- Tutti i componenti  - Componenti custom
                 - Design review       - On-site training
```

### Tecniche di Pricing Psychology

1. **Anchoring**: Mostra prima il tier più costoso
2. **Decoy**: Il tier medio deve sembrare il "best value"
3. **Price Ending**: €1,497 > €1,500 (più specifico = più credibile)
4. **Annual Discount**: "Risparmia 2 mesi con il piano annuale"

---

## FAQ Section (Schema.org Ready)

```tsx
// components/faq.tsx
const faqs = [
  {
    question: "Quanto tempo serve per integrare il Design System?",
    answer: "La maggior parte dei team è operativa in 1-2 giorni. Forniamo documentazione completa e supporto dedicato durante l'onboarding."
  },
  {
    question: "Funziona con il mio stack esistente?",
    answer: "Sì. I nostri componenti sono framework-agnostic e funzionano con React, Vue, Svelte e vanilla JS."
  },
  {
    question: "Cosa succede se non sono soddisfatto?",
    answer: "Offriamo una garanzia soddisfatti o rimborsati di 30 giorni. Nessuna domanda."
  }
]

// Genera automaticamente lo schema
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": faqs.map(faq => ({
    "@type": "Question",
    "name": faq.question,
    "acceptedAnswer": {
      "@type": "Answer",
      "text": faq.answer
    }
  }))
}
```

---

## Mobile-First Design

### Checklist Mobile

- [ ] Hero visibile senza scroll su mobile
- [ ] CTA sticky su mobile (bottom bar)
- [ ] Immagini lazy-loaded
- [ ] Font size minimo 16px
- [ ] Touch targets minimo 44x44px
- [ ] Form fields grandi e accessibili

### Breakpoints Consigliati

```css
/* Mobile first */
@media (min-width: 640px) { /* sm */ }
@media (min-width: 768px) { /* md */ }
@media (min-width: 1024px) { /* lg */ }
@media (min-width: 1280px) { /* xl */ }
```

---

## Metriche di Successo

| Metrica | Target Landing Page B2B |
|---------|------------------------|
| **Conversion Rate** | 2.5% - 5% (form submit) |
| **Bounce Rate** | < 50% |
| **Time on Page** | > 2 minuti |
| **Scroll Depth** | > 70% raggiunge pricing |
| **CTA Click Rate** | > 10% |

---

## Template Componenti (shadcn/ui)

### Hero Section

```tsx
export function HeroSection() {
  return (
    <section className="relative py-20 lg:py-32">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center">
          {/* Trust badge */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <Badge variant="secondary">
              <Star className="w-3 h-3 mr-1" />
              4.9/5 su G2
            </Badge>
          </div>
          
          {/* Headline */}
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Design System che{" "}
            <span className="text-primary">scala con te</span>
          </h1>
          
          {/* Subheadline */}
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Componenti React accessibili, documentati e pronti per il tuo brand.
            Setup in 1 giorno, non 3 mesi.
          </p>
          
          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg px-8">
              Inizia Gratis
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8">
              Vedi la Demo
            </Button>
          </div>
          
          {/* Micro-copy */}
          <p className="text-sm text-muted-foreground mt-4">
            No carta di credito richiesta · Setup in 5 minuti
          </p>
        </div>
        
        {/* Logo bar */}
        <div className="mt-16">
          <p className="text-center text-sm text-muted-foreground mb-6">
            Trusted by 500+ companies
          </p>
          <div className="flex flex-wrap justify-center items-center gap-8 opacity-60">
            {/* Loghi clienti */}
          </div>
        </div>
      </div>
    </section>
  )
}
```

---

## Checklist Pre-Lancio

- [ ] Headline testata (A/B se possibile)
- [ ] CTA visibile above the fold
- [ ] Social proof presente
- [ ] Mobile responsive verificato
- [ ] Core Web Vitals > 90
- [ ] Schema.org implementato
- [ ] Analytics/tracking attivo
- [ ] Form funzionante e testato
- [ ] Thank you page configurata
- [ ] Pixel retargeting installato
