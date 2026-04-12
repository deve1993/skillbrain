# /video Command

Crea video programmatici con Remotion: intro, social clips, product showcase, OG video.

## Trigger

```
/video [tipo] [descrizione]
```

**Esempi:**
```
/video intro video di presentazione per TechStartup
/video social clip Instagram per lancio prodotto
/video og-video preview animato per landing page
/video showcase demo del prodotto con screen recording
```

## Tipi Video

| Tipo | Dimensioni | Durata | Uso |
|------|-----------|--------|-----|
| `intro` | 1920x1080 | 5-10s | Video apertura brand |
| `social` | 1080x1080 | 15-30s | Instagram, LinkedIn |
| `story` | 1080x1920 | 15s | Instagram/TikTok story |
| `og-video` | 1200x630 | 3-5s | Social share preview |
| `showcase` | 1920x1080 | 30-60s | Demo prodotto |

## Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                     /video WORKFLOW                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. CONCEPT                                                  │
│       @video-creator                                         │
│       → Storyboard (scene, timing, transitions)              │
│       → Zod schema per props                                 │
│       ▼                                                      │
│  2. IMPLEMENTATION                                           │
│       @video-creator                                         │
│       → Composition React/Remotion                           │
│       → Scene components                                     │
│       → Animazioni e transizioni                             │
│       ▼                                                      │
│  3. RENDER                                                   │
│       → Preview con <Player>                                 │
│       → Render finale (MP4/WebM)                             │
│       → Thumbnail generation                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Skills Caricate

- `remotion` — Remotion v4 knowledge base

## Requisiti

- Remotion installato nel progetto
- Assets (logo, font, immagini) disponibili in `public/videos/assets/`
