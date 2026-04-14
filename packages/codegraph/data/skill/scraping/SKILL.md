---
name: scraping
description: Web scraping and reverse engineering knowledge base - Playwright, site analysis, asset extraction, SPA scraping. Use when scraping websites, reverse-engineering layouts, extracting assets, or analyzing competitor sites.
version: 1.0.0
---

# Scraping & Reverse Engineering Skill

Knowledge base per l'analisi tecnica, il reverse engineering e la clonazione di siti web moderni (SPA, SSR) utilizzando Playwright.

## Setup Ambiente

L'agente `@web-analyst` opera in due modalità:
1. **Analisi Rapida**: Utilizza l'MCP Server di Playwright per ispezione immediata.
2. **Clonazione Profonda**: Scrive ed esegue script Node.js per scaricare assets e struttura.

### Installazione Dipendenze (se necessarie)

```bash
npm init -y
npm install playwright node-fetch cheerio fs-extra
npx playwright install chromium
```

## 1. Script di Clonazione Completa (Formato A)

Questo script clona un sito ricreando la struttura delle cartelle per la navigazione offline.

```javascript
// clone-site.js
const { chromium } = require('playwright');
const fs = require('fs-extra');
const path = require('path');
const { URL } = require('url');
const fetch = require('node-fetch');

const TARGET_URL = process.argv[2];
const OUTPUT_DIR = process.argv[3] || './.scraped_data';

if (!TARGET_URL) {
  console.error('Usage: node clone-site.js <url> [output_dir]');
  process.exit(1);
}

const domain = new URL(TARGET_URL).hostname;
const siteDir = path.join(OUTPUT_DIR, domain);

// Helper per scaricare risorse
async function downloadResource(url, type) {
  try {
    const resourceUrl = new URL(url, TARGET_URL);
    // Ignora domini esterni per assets non critici se non richiesto
    if (type !== 'image' && resourceUrl.hostname !== domain) return url;

    const relativePath = resourceUrl.pathname === '/' ? 'index.html' : resourceUrl.pathname;
    const savePath = path.join(siteDir, relativePath);
    
    // Assicura che la directory esista
    await fs.ensureDir(path.dirname(savePath));

    // Se esiste già, ritorna il path relativo
    if (await fs.pathExists(savePath)) {
      return path.relative(path.dirname(path.join(siteDir, 'index.html')), savePath);
    }

    const res = await fetch(resourceUrl.href);
    if (!res.ok) return url;
    
    const buffer = await res.buffer();
    await fs.writeFile(savePath, buffer);
    
    // Calcola path relativo per l'HTML
    return path.relative(path.dirname(path.join(siteDir, 'index.html')), savePath);
  } catch (e) {
    console.error(`Failed to download ${url}: ${e.message}`);
    return url;
  }
}

async function scrape() {
  console.log(`Cloning ${TARGET_URL} to ${siteDir}...`);
  await fs.ensureDir(siteDir);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Anti-bot basic bypass
  await page.setExtraHTTPHeaders({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  });

  try {
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
    
    // Scroll per triggerare lazy loading
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });

    // Aspetta ancora un po' per sicurezza
    await page.waitForTimeout(2000);

    // Screenshot full page come riferimento
    await page.screenshot({ path: path.join(siteDir, 'full-screenshot.png'), fullPage: true });

    // Prendi HTML processato (dopo esecuzione JS)
    let html = await page.content();

    // TO DO: Parsing HTML per trovare e scaricare assets
    // Qui si userebbe cheerio o regex per trovare <img src="...">, <link href="...">
    // e chiamare downloadResource() sostituendo i link nell'HTML.
    // Per brevità del template, questa logica va implementata dall'agente
    // in base alla complessità richiesta.
    
    // Esempio base di salvataggio HTML
    await fs.writeFile(path.join(siteDir, 'index.html'), html);
    
    console.log('Cloning complete!');
    
    // Analisi Struttura (Output per Design Team)
    const analysis = await page.evaluate(() => {
      // Estrai colori
      const colors = new Set();
      const elements = document.querySelectorAll('*');
      elements.forEach(el => {
        const style = window.getComputedStyle(el);
        colors.add(style.color);
        colors.add(style.backgroundColor);
      });

      // Estrai font
      const fonts = new Set();
      elements.forEach(el => {
        const style = window.getComputedStyle(el);
        fonts.add(style.fontFamily);
      });

      return {
        colors: Array.from(colors).slice(0, 20), // Limit
        fonts: Array.from(fonts)
      };
    });

    await fs.writeJson(path.join(siteDir, 'analysis.json'), analysis, { spaces: 2 });

  } catch (error) {
    console.error('Error during scraping:', error);
  } finally {
    await browser.close();
  }
}

scrape();
```

## 2. Tecniche di Analisi Competitor

### Identificare Framework e Librerie
Cerca indizi nel DOM o nei global variables:
- `__NEXT_DATA__` -> Next.js
- `_reactRootContainer` -> React
- Classi `text-xl p-4 flex` -> Tailwind CSS
- Classi `MuiButton-root` -> Material UI

### Estrarre Design System
Per ricreare componenti fedeli:
1. **Tipografia**: Cattura `font-family`, `line-height`, `letter-spacing` dei tag H1-H6 e p.
2. **Colori**: Estrai variabili CSS root (`:root { --primary: ... }`) se presenti, altrimenti computed styles.
3. **Spaziature**: Analizza `padding` e `margin` dei container principali.

## 3. Collaborazione con Design Team

Quando `@web-analyst` ha finito, deve fornire istruzioni precise:

**Per @ui-designer:**
```markdown
## Design Analysis for [Sito]
- **Primary Color**: #0066cc
- **Font**: Inter, sans-serif
- **Roundness**: 8px (border-radius predominante)
- **Shadows**: Soft shadows (`0 4px 6px -1px rgba(...)`)
```

**Per @component-builder:**
```markdown
## Component Structure: Navbar
Il sito usa una navbar sticky con:
- Logo a sinistra
- Link centrali (flex gap-4)
- CTA a destra (Button variant="default")
- Mobile: Hamburger menu che apre Sheet laterale
```

## Best Practices
- **Rate Limiting**: Inserire sempre `waitForTimeout(1000)` tra le richieste di pagine multiple.
- **User Agent**: Ruotare o impostare un UA realistico.
- **Robot.txt**: Controllare `/robots.txt` per vedere sezioni proibite (ma per analisi privata di solito si ignora se non massivo).
- **Cartelle**: Salvare sempre in `.scraped_data/` per non commettere file spazzatura nel repo git.
