---
name: <skill-name>
description: <One-sentence WHAT it does + WHEN to use it. Be surgical — this is what skill_route matches against.>
category: <stack | infrastructure | workflow | domain>
type: <domain | lifecycle | process | agent | command>
tags: [<tag1>, <tag2>, <tag3>]
---

# <Skill Name>

## When to use
<2-3 frasi: scenari concreti in cui caricare questa skill. Cosa il modello sta cercando di fare?>

## Core patterns
<3-7 pattern azionabili. Per ognuno: una frase di principio + esempio breve se serve.>

### Pattern 1: <Nome>
<Spiegazione concisa.>

```typescript
// esempio minimo se utile
```

### Pattern 2: <Nome>
...

## Anti-patterns
<Cosa NON fare e perché. Lista puntata, brevissima.>

- ❌ <anti-pattern> — <motivo>
- ❌ <anti-pattern> — <motivo>

## Decisions for our team
<Convenzioni specifiche del nostro team che il modello deve sapere. Es: "Usiamo sempre next-intl con strategia path-based, mai cookie-based".>

## Memory triggers
<Quando il modello deve salvare una memoria con tag `skill:<name>`. Lista esplicita.>

- Quando risolvi un edge case di <X>, salva memoria type=BugFix con tag `skill:<name>`
- Quando il team decide una convenzione su <Y>, salva type=Decision con tag `skill:<name>`
- Quando scopri un anti-pattern in <Z>, salva type=AntiPattern con tag `skill:<name>`

## References
<Link a docs ufficiali, NON duplicare contenuti. 2-3 link max.>
