# SkillBrain Team Onboarding

Guida per i nuovi membri del team. Segui i 5 step in ordine, ci vogliono circa 15 minuti.

---

## Step 1: Accesso alla dashboard

1. Vai su **https://memory.fl1.it/**
2. Daniel ti avrà inviato un'email con indirizzo, password temporanea e la tua prima API key
3. Inserisci email e password → login
4. Vai su **Profile** nella sidebar sinistra e cambia la password (sezione "Password" in basso)

---

## Step 2: Genera la tua API key

1. Dalla dashboard vai su **Profile → API Keys**
2. Clicca **+ Generate Key**
3. Label consigliato: `claude-code-<tuonome>` (es. `claude-code-marco`)
4. Clicca **Generate** → copia la chiave che appare (viene mostrata **UNA SOLA VOLTA**)
5. Salvala in un posto sicuro (password manager, file locale, ecc.)

> La tua prima chiave l'hai ricevuta via email insieme alla password. Puoi revocarla dopo averne generata una nuova dal Profile.

---

## Step 3: Configura Claude Code

Aggiungi il server MCP alla tua configurazione Claude Code. Il modo più semplice è aprire Claude Code e usare `/mcp` per aggiungere un server, oppure modifica manualmente `~/.claude/claude_desktop_config.json` (Claude Desktop) o il tuo file di configurazione locale.

Configurazione MCP da aggiungere:

```json
{
  "mcpServers": {
    "codegraph": {
      "command": "npx",
      "args": ["-y", "@skillbrain/mcp-proxy@latest"],
      "env": {
        "CODEGRAPH_AUTH_TOKEN": "<la-tua-chiave>",
        "CODEGRAPH_SERVER": "https://memory.fl1.it"
      }
    }
  }
}
```

Sostituisci `<la-tua-chiave>` con la chiave copiata al Step 2.

---

## Step 4: Verifica

In Claude Code, scrivi:

```
cerca memorie su autenticazione
```

oppure in inglese:

```
search memories about authentication
```

Deve invocare il tool `memory_search` e ritornare risultati. Se ottieni un errore 401, la chiave non è corretta — torna al Step 2 e rigenera.

---

## Step 5: Convenzioni del team

### Scope delle memorie

| Scope | Chi la vede | Quando usarlo |
|-------|-------------|---------------|
| `team` (default) | Tutti | Knowledge condiviso, pattern, decisioni |
| `personal` | Solo tu | Debug personale, TODO, esperimenti |
| `project` | Chi lavora sul progetto | Specifico per un singolo client/progetto |

**Default: `team`.** La condivisione è il punto.

### Tag `skill:<nome>`

Quando una memoria riguarda un dominio specifico, aggiungi `skill:<nome>` ai tag:

```
tags: ["nextjs", "performance", "skill:nextjs"]
```

Questo alimenta il sistema di auto-evoluzione delle skill — le memorie taggate vengono raggruppate e usate da Haiku per proporre miglioramenti alle skill condivise.

### Skills condivise

Le skill sono visibili e usabili da tutto il team. Se vuoi modificarne una in modo significativo, comunicalo nel canale Slack/Discord prima — le skill cambiano per tutti.

Per esplorare le skill disponibili: usa `skill_route({ task: "..." })` in Claude Code.

### Quando salvare una memoria

Claude lo suggerisce automaticamente a fine task. Approva le proposte utili, skippa le triviali. In generale salva quando:

- Risolvi un bug non ovvio (dopo 2+ tentativi)
- Il team decide una convenzione (es. "usiamo sempre X pattern")
- Scopri un anti-pattern (es. "non fare Y perché causa Z")
- Trovi un pattern riutilizzabile

---

## Troubleshooting

**"401 Unauthorized" su ogni tool MCP**
→ La chiave è sbagliata o revocata. Vai su Profile → API Keys, genera una nuova chiave, aggiorna la config Claude Code.

**"memory_search" non trova nulla**
→ Il server potrebbe essere in riavvio. Riprova tra 30 secondi. Se persiste, controlla https://memory.fl1.it/ dal browser — se non risponde, avvisa Daniel.

**Non ricevo email di invito**
→ Controlla spam. In alternativa, chiedi a Daniel la password temporanea direttamente.

**La dashboard non carica**
→ Prova hard refresh (Cmd+Shift+R). Se il problema persiste, svuota i cookie per memory.fl1.it.

---

## Contatti

- **Admin**: Daniel — devecchidaniel93@gmail.com
- **Problemi tecnici**: apri un thread nel canale del team
