---
name: agent-browser
description: >
  Use when navigating websites, scraping web content, analyzing competitor sites,
  automating browser interactions with persistent login sessions, filling forms on
  real sites, or any task requiring a visible browser with cookie persistence.
  Triggers on: "scrape this site", "analyze competitor", "navigate to", "fill this
  form", "clone this UI", "browser automation", "agent-browser", "web scraping",
  "multi-site analysis", "debug with browser".
version: 1.0.0
---

# Browser Automation with agent-browser

CLI per browser automation ottimizzata per agenti AI (Vercel Labs).
Browser visibile con cookie persistenti, dev tools completi e video streaming.

## Requisiti

```bash
npm install -g agent-browser
agent-browser install  # Scarica Chromium (~684MB)
```

## HOW IT WORKS

agent-browser mantiene la sua sessione browser con cookies.
- Login una volta → cookies salvati → autenticazione persistente
- **WARNING: `agent-browser close` CANCELLA TUTTI I COOKIES** - dovrai fare re-login!
- Per mantenere l'autenticazione: MAI chiudere la sessione, naviga solo verso nuovi URL

## WORKFLOW COMPLETO

### 1. Apri Browser (PATTERN OBBLIGATORIO)

```bash
# SEMPRE usa questo pattern alla prima apertura - setta viewport a 1920x1080:
pkill -f agent-browser; sleep 1; agent-browser open <url> --headed && agent-browser set viewport 1920 1080

# Se il browser è già in esecuzione, naviga semplicemente:
agent-browser open <url> --headed
```

### 2. Gestisci Cookie Banner (OBBLIGATORIO su siti pubblici)

Dopo aver aperto una pagina, SEMPRE:
1. Esegui `agent-browser snapshot -i` per verificare banner cookie consent
2. Se presente: clicca "Accept" / "Accetta" / "Accept all"
3. A meno che l'utente non chieda esplicitamente di mantenerlo (per debug)

```bash
agent-browser snapshot -i                     # Cerca cookie banner
agent-browser click @eX                       # Clicca accept (usa il @ref corretto)
```

### 3. Analizza Pagina

```bash
agent-browser snapshot -i                     # Elementi interattivi con @refs
agent-browser snapshot -i -c                  # Output compatto
```

### 4. Interagisci (usa @refs da snapshot)

```bash
agent-browser click @e1                       # Click elemento
agent-browser fill @e2 "text"                 # Clear e riempi input
agent-browser type @e2 "text"                 # Digita senza cancellare
agent-browser press Enter                     # Premi tasto
agent-browser select @e1 "value"              # Seleziona dropdown
agent-browser scroll down 500                 # Scroll pagina
agent-browser hover @e1                       # Hover elemento
agent-browser check @e1                       # Seleziona checkbox
agent-browser dblclick @e1                    # Doppio click
agent-browser uncheck @e1                     # Deseleziona checkbox
agent-browser scrollintoview @e1              # Scroll a elemento
```

### 5. Ottieni Informazioni

```bash
agent-browser get text @e1                    # Testo elemento
agent-browser get value @e1                   # Valore input
agent-browser get html @e1                    # HTML elemento
agent-browser get attr data-id @e1            # Attributo elemento
agent-browser get title                       # Titolo pagina
agent-browser get url                         # URL corrente
agent-browser get box @e1                     # Bounding box elemento
agent-browser get count @e1                   # Numero elementi matching
```

### 6. Naviga

```bash
agent-browser open <url>                      # Vai a URL (mantiene cookies!)
agent-browser back                            # Indietro
agent-browser forward                         # Avanti
agent-browser reload                          # Ricarica pagina
```

### 7. Attendi

```bash
agent-browser wait @e1                        # Attendi elemento
agent-browser wait 2000                       # Attendi millisecondi
agent-browser wait --text "Success"           # Attendi testo
agent-browser wait --load networkidle         # Attendi rete
```

### 8. Screenshot

```bash
mkdir -p .agent-screenshots
agent-browser screenshot .agent-screenshots/YYYYMMDD-HHMMSS-description.png
agent-browser screenshot .agent-screenshots/YYYYMMDD-HHMMSS-description.png --full
```

## DEV TOOLS (SEMPRE USA --json!)

### Console Logs (CRITICO - sempre usa --json!)

```bash
agent-browser console --json                  # Vedi TUTTI i log (log, warn, error, debug)
agent-browser console --clear                 # Pulisci buffer console
agent-browser errors --json                   # Solo errori pagina
```

### Cookies & Storage

```bash
agent-browser cookies get --json              # Ottieni tutti i cookies
agent-browser cookies clear                   # Pulisci cookies
agent-browser storage local --json            # Ottieni localStorage
agent-browser storage session --json          # Ottieni sessionStorage
```

### Network Requests

```bash
agent-browser network requests --filter "" --json    # Vedi richieste catturate
agent-browser network requests --clear               # Pulisci buffer richieste
agent-browser network route "*/api/*" --abort        # Blocca richieste
agent-browser network route "*/api/*" --body '{"mock":true}'  # Mock response
agent-browser network unroute                        # Rimuovi tutte le route
```

### Esegui JavaScript

```bash
agent-browser eval "window.location.href"            # Esegui JS, ottieni risultato
agent-browser eval "document.title"
agent-browser eval "localStorage.getItem('key')"
agent-browser eval "console.log('test')"             # Log in console
```

### Debug Helpers

```bash
agent-browser highlight @e1                   # Evidenzia elemento visivamente
agent-browser trace start                     # Inizia registrazione trace
agent-browser trace stop ./trace.zip          # Ferma e salva trace file
```

## VIDEO STREAMING

Abilita streaming video real-time via WebSocket:

```bash
# Avvia con streaming abilitato (porta 9223)
pkill -f agent-browser                        # Termina daemon esistente
AGENT_BROWSER_STREAM_PORT=9223 agent-browser open <url> --headed

# Connetti via WebSocket a ws://localhost:9223
# Ricevi: {"type":"frame","data":"<base64 JPEG>"} per frame video
# Ricevi: {"type":"status","connected":true,"screencasting":true}
```

## REGOLE (IMPORTANTI!)

1. **Prima apertura**: SEMPRE usa il pattern pkill+open+viewport dalla sezione 1
2. **Cookie banner**: SEMPRE dismissalo su siti pubblici (accetta cookies), a meno che l'utente non chieda di mantenerlo per debug
3. **--headed**: SEMPRE usalo per il comando `open` (l'utente deve vedere il browser)
4. **--json**: SEMPRE usalo per console, errors, cookies, storage, network
5. **snapshot prima di interagire**: SEMPRE ottieni @refs freschi prima di click/fill
6. **ri-snapshot dopo navigazione**: Cambio pagina = nuovi @refs
7. **screenshots**: Salva in `.agent-screenshots/YYYYMMDD-HHMMSS-description.png`
8. **MAI chiudere sessione**: `close` cancella cookies = ri-login richiesto!

## AUTENTICAZIONE

Per siti che richiedono login:
1. Naviga alla pagina login
2. Usa `fill` per credenziali, `click` per submit
3. I cookies sono salvati automaticamente
4. Le navigazioni future mantengono l'autenticazione

## BROWSER SETTINGS

```bash
agent-browser set viewport 1920 1080          # Dimensione viewport
agent-browser set media dark                  # Dark mode
agent-browser set media light                 # Light mode
agent-browser set headers '{"Accept-Language": "it-IT"}'   # Italiano
agent-browser set headers '{"Accept-Language": "en-US"}'   # Inglese
```

## SESSION MANAGEMENT

```bash
agent-browser session list                    # Lista sessioni attive
agent-browser session                         # Nome sessione corrente
```

**CRITICO**: `agent-browser close` DISTRUGGE la sessione e TUTTI i cookies!
- Dopo close, DEVI ri-loggarti sui siti autenticati
- Per preservare auth: naviga semplicemente con `open <url>`, mai close
- Usa close solo quando hai completamente finito O vuoi un fresh start

## LOCATORI SEMANTICI (alternativa a refs)

```bash
agent-browser find role button click --name "Submit"
agent-browser find text "Accedi" click
agent-browser find label "Email" fill "user@test.com"
agent-browser find placeholder "Cerca..." fill "query"
agent-browser find testid "submit-btn" click
```

## SESSIONI MULTIPLE (Analisi Parallela)

```bash
# Sessione 1: Competitor A
agent-browser --session compA open https://competitor-a.com --headed
agent-browser --session compA wait --load networkidle
agent-browser --session compA snapshot -i

# Sessione 2: Competitor B (in parallelo)
agent-browser --session compB open https://competitor-b.com --headed
agent-browser --session compB wait --load networkidle
agent-browser --session compB snapshot -i
```

## ENVIRONMENT VARIABLES

```bash
AGENT_BROWSER_SESSION=mySession               # Sessione isolata
AGENT_BROWSER_EXECUTABLE_PATH=/path/chrome    # Browser custom
AGENT_BROWSER_STREAM_PORT=9222                # WebSocket streaming
```

## OUTPUT JSON (per parsing)

```bash
agent-browser --json snapshot -i
agent-browser --json get text @e1
```

## TROUBLESHOOTING

**"Browser not launched" error**:
```bash
pkill -f agent-browser; sleep 1; agent-browser open <url> --headed
```

**Browser non risponde**:
```bash
pkill -f agent-browser                        # Termina daemon (perde cookies!)
agent-browser open <url> --headed             # Restart fresh (serve re-login)
```

**Console/Cookies mostrano vuoto**:
```bash
# SEMPRE usa --json per dev tools:
agent-browser console --json                  # Corretto
agent-browser console                         # Sbagliato - può mostrare vuoto
```

**Cookie banner non rilevato**:
```bash
# Esegui snapshot per vedere tutti gli elementi interattivi:
agent-browser snapshot -i

# Cerca bottoni con testo tipo "Accept", "Accetta", "OK", "Agree"
# Poi clicca il @ref corretto
```

**Sessione persa / Serve re-login**:
```bash
# NON usare 'close' - cancella tutti i cookies!
agent-browser close                           # Distrugge sessione

# Invece, naviga semplicemente verso nuovi URL:
agent-browser open <new-url>                  # Mantiene cookies
```

**Elemento non trovato**:
```bash
# SEMPRE ri-snapshot dopo navigazione o cambio pagina:
agent-browser open <url>
agent-browser snapshot -i                     # Ottieni @refs freschi
agent-browser click @e1                       # Usa nuovi refs
```

## vs Playwright MCP

| Aspetto | Agent-Browser | Playwright MCP |
|---------|---------------|----------------|
| Uso primario | Scraping, analisi | Testing E2E |
| Selettori | Refs semantici | CSS/XPath |
| Persistenza | Automatica (cookies) | Manuale |
| Sessioni | Multiple isolate | Singola |
| Output | CLI/JSON | MCP tools |
| Browser visibile | --headed | Headless default |

## QUANDO USARE AGENT-BROWSER

- Web scraping e data extraction
- Analisi competitor (struttura, contenuti)
- Clonazione UI per reverse engineering
- Navigazione con autenticazione persistente
- Analisi multi-sito parallela
- Debug interattivo con browser visibile
- Form automation su siti reali

## QUANDO USARE PLAYWRIGHT MCP

- Test E2E automatizzati
- Visual regression testing
- CI/CD pipelines (GitHub Actions)
- Integrazione con framework di test (Vitest/Jest)
