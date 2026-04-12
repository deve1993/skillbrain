# Agent Ownership Matrix

> Definisce chiaramente le responsabilità e i confini tra gli agenti Marketing e Dev Team.

---

## CRO Designer vs UI Designer

### TL;DR

| Aspetto | @cro-designer | @ui-designer |
|---------|---------------|--------------|
| **Focus** | CONVERSIONE | ESTETICA |
| **Domanda** | "Cosa converte?" | "Come appare?" |
| **Output** | Spec funzionali | Design visivo |
| **Decide** | Layout, posizionamento, copy placement | Colori, tipografia, spacing, animazioni |

---

## Ownership Dettagliata

### @cro-designer OWNS (Decisioni finali su):

#### 1. Information Architecture
- Ordine delle sezioni nella pagina
- Gerarchia dei contenuti
- Cosa mostrare above/below the fold
- Posizionamento elementi di trust

#### 2. Conversion Elements
- Posizione e numero di CTA
- Form structure (campi, step)
- Social proof placement
- Urgency/scarcity elements

#### 3. User Flow
- Call-to-action primaria vs secondaria
- Exit intent strategy
- Mobile CTA bar behavior
- Sticky element logic

#### 4. A/B Test Definition
- Cosa testare
- Varianti da creare
- Metriche di successo
- Durata test

#### 5. Copy Placement (con @saas-copywriter)
- Dove va l'headline
- Lunghezza blocchi di testo
- Numero di bullet points
- FAQ order

### @ui-designer OWNS (Decisioni finali su):

#### 1. Visual Design
- Color palette e applicazione
- Typography scale e applicazione
- Spacing system
- Visual hierarchy all'interno delle sezioni

#### 2. Component Styling
- Button styles (oltre primary/secondary)
- Card designs
- Form field styling
- Icon selection e sizing

#### 3. Motion & Animation
- Transition timing
- Scroll animations
- Hover states
- Loading states

#### 4. Responsive Adaptation
- Come gli elementi si adattano (non SE si adattano)
- Breakpoint-specific styling
- Touch target sizing
- Mobile-specific visual treatments

#### 5. Brand Consistency
- Applicazione del brand
- Tone visivo
- Imagery style
- Illustration style

---

## Collaboration Zones (Decisione Congiunta)

| Area | @cro-designer | @ui-designer |
|------|---------------|--------------|
| **Hero Section** | Layout, CTA position, message hierarchy | Visual treatment, background, typography |
| **Forms** | Fields, steps, validation rules | Styling, error states, animations |
| **Testimonials** | Format (carousel vs grid), info to show | Card design, photo treatment, layout |
| **Pricing Tables** | Structure, what to highlight | Design, visual comparison cues |
| **Mobile Experience** | What to show/hide, CTA behavior | How it looks, touch interactions |

---

## Handoff Protocol

### CRO → UI Flow

```
1. @cro-designer produces PageSpec.md
   - Section order defined
   - Content requirements specified
   - CTA placements marked
   - Mobile behavior noted

2. @ui-designer receives PageSpec.md
   - Reviews for feasibility
   - Raises concerns if any
   - Produces visual design
   - Documents component specs

3. Joint review
   - CRO validates conversion elements
   - UI validates visual consistency
   - Resolve conflicts together
```

### Conflict Resolution

| Scenario | Resolution |
|----------|------------|
| CRO wants element X, UI says it hurts design | Test it. Data wins. |
| UI wants animation, CRO says it slows page | Measure performance. Core Web Vitals win. |
| Both have valid concerns | @growth-architect decides based on strategy |

---

## RACI Matrix

| Task | @cro-designer | @ui-designer | @saas-copywriter | @growth-architect |
|------|---------------|--------------|------------------|-------------------|
| Page section order | **R/A** | C | C | I |
| CTA placement | **R/A** | C | I | I |
| Form structure | **R/A** | C | I | I |
| Color palette | C | **R/A** | I | I |
| Typography | I | **R/A** | C | I |
| Animations | C | **R/A** | I | I |
| Copy content | C | I | **R/A** | C |
| A/B test design | **R/A** | C | C | I |
| Mobile adaptation | C | **R/A** | I | I |
| Conversion goals | C | I | I | **R/A** |

**R** = Responsible, **A** = Accountable, **C** = Consulted, **I** = Informed

---

## Anti-Patterns (Evitare)

### @cro-designer NON deve:
- ❌ Specificare colori esatti (solo semantici: primary, secondary)
- ❌ Decidere font o font sizes
- ❌ Definire animazioni specifiche
- ❌ Bypassare UI per andare diretto a dev

### @ui-designer NON deve:
- ❌ Spostare CTA per ragioni estetiche senza consultare CRO
- ❌ Nascondere elementi di social proof per "pulire" il design
- ❌ Aggiungere animazioni che ritardano CTA visibility
- ❌ Cambiare form structure per motivi visivi

---

## Communication Templates

### CRO → UI Request

```markdown
## CRO Request: [Section Name]

**Conversion Goal**: [What we want users to do]

**Required Elements**:
- [ ] Element 1 - [importance: critical/important/nice-to-have]
- [ ] Element 2
- [ ] Element 3

**Placement Notes**:
- [Specific placement requirements]

**Mobile Requirements**:
- [Mobile-specific needs]

**NOT specifying** (UI decides):
- Visual treatment
- Exact spacing
- Colors
- Animations
```

### UI → CRO Feedback

```markdown
## UI Feedback: [Section Name]

**Received**: [What CRO requested]

**Feasibility**: [Can do / Concerns / Cannot do]

**Concerns**:
1. [Concern] → [Proposed solution]

**Alternatives** (if needed):
- Option A: [Description]
- Option B: [Description]

**Questions**:
- [Any clarifications needed]
```

---

## Integration with Dev Team

### @component-builder receives from:
- **@cro-designer**: PageSpec.md (structure, behavior)
- **@ui-designer**: Component specs (visual, animations)

### Priority when conflicts exist:
1. **Accessibility** (always wins)
2. **Performance** (Core Web Vitals)
3. **Conversion** (CRO requirements)
4. **Aesthetics** (UI requirements)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-17 | Initial ownership matrix |
