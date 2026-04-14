# /analyze

Analisi competitor, trend o tecnologie via ricerca web.

## Uso
```
/analyze <query> [--depth=quick|medium|thorough] [--focus=design|tech|pricing|features] [--scrape]
```

## Tipi di analisi
- **Competitor**: lista, confronto feature/pricing, differenziazione
- **Design trends**: pattern UI/UX, colori, typography, esempi
- **Tech stack**: framework, CSS, CMS, hosting per lista siti
- **Best practices**: pattern, anti-pattern, metriche, checklist

## Workflow
1. MCP Fetch/Perplexity per ricerca web
2. @web-analyst per analisi tecnica (se --scrape)
3. Report strutturato con raccomandazioni

## Output
Executive Summary → Tabella comparativa → Analisi dettagliata → Raccomandazioni prioritizzate → Prossimi passi

## Note
- Con `--scrape` clona i siti trovati via @web-analyst
- Salva report in `references/analysis/`
