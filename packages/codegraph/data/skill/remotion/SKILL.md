---
name: remotion
description: Remotion knowledge base - programmatic video creation with React, rendering, compositions, animations. Use when creating programmatic videos, building Remotion compositions, rendering video with React, or creating social video clips.
version: 1.0.0
---

# Remotion Knowledge Base

React framework per creazione video programmatica. Versione stabile: **v4.0.410+**.

## Installazione (Next.js 15 esistente)

```bash
pnpm add remotion @remotion/cli @remotion/player @remotion/bundler zod
pnpm add @remotion/renderer                         # Server-side rendering
pnpm add @remotion/shapes @remotion/paths @remotion/google-fonts @remotion/zod-types
pnpm add -D @remotion/tailwind-v4 tailwindcss @tailwindcss/postcss
```

## Struttura Progetto

```
├── remotion.config.ts
├── src/remotion/
│   ├── index.ts              # registerRoot() entry point
│   ├── Root.tsx              # <Composition> definitions
│   └── compositions/
│       ├── IntroVideo/       # Main.tsx + schema.ts
│       ├── SocialClip/
│       └── ProductShowcase/
├── public/videos/assets/     # staticFile() references
└── out/                      # Rendered output (gitignored)
```

## File Chiave

### remotion.config.ts

```typescript
import { Config } from "@remotion/cli/config";
import { enableTailwind } from "@remotion/tailwind-v4";

Config.setVideoImageFormat("jpeg");
Config.overrideWebpackConfig((config) => enableTailwind(config));
```

### Entry Point + Root

```typescript
// src/remotion/index.ts
import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";
registerRoot(RemotionRoot);

// src/remotion/Root.tsx
import { Composition } from "remotion";
import { IntroVideo } from "./compositions/IntroVideo/Main";
import { introSchema } from "./compositions/IntroVideo/schema";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="IntroVideo" component={IntroVideo} schema={introSchema}
      defaultProps={{ title: "Welcome", primaryColor: "#0066cc" }}
      durationInFrames={150} fps={30} width={1920} height={1080} />
  </>
);
```

### Schema con Zod

```typescript
import { z } from "zod";
import { zColor } from "@remotion/zod-types";

export const introSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  primaryColor: zColor(),
  logoUrl: z.string().url().optional(),
});
export type IntroProps = z.infer<typeof introSchema>;
```

## API Core

```tsx
import {
  AbsoluteFill, interpolate, Sequence, Series, Loop, Freeze,
  useCurrentFrame, useVideoConfig, spring, interpolateColors,
  Easing, Img, Audio, staticFile, delayRender, continueRender,
} from "remotion";

// --- useCurrentFrame / useVideoConfig ---
const frame = useCurrentFrame();                     // 0, 1, 2...
const { fps, durationInFrames, width, height } = useVideoConfig();

// --- interpolate (SEMPRE con clamp!) ---
const opacity = interpolate(frame, [0, 30], [0, 1], {
  extrapolateLeft: "clamp", extrapolateRight: "clamp",
});
const translateY = interpolate(frame, [0, 30], [50, 0], {
  extrapolateRight: "clamp", easing: Easing.bezier(0.25, 0.1, 0.25, 1),
});

// --- spring (animazioni naturali) ---
const scale = spring({ frame, fps, config: { damping: 200 } });
const delayed = spring({ frame: frame - 25, fps, config: { damping: 100, stiffness: 100 } });

// --- interpolateColors ---
const color = interpolateColors(frame, [0, 30, 60], ["#ff0000", "#00ff00", "#0000ff"]);

// --- Sequence (time-shifting, overlap possibile) ---
<Sequence from={0} durationInFrames={30}><Scene1 /></Sequence>
<Sequence from={30} durationInFrames={60}><Scene2 /></Sequence>

// --- Series (sequenziale, no overlap) ---
<Series>
  <Series.Sequence durationInFrames={30}><Scene1 /></Series.Sequence>
  <Series.Sequence durationInFrames={60}><Scene2 /></Series.Sequence>
</Series>

// --- delayRender (blocca render per dati async) ---
const [handle] = useState(() => delayRender("Loading..."));
useEffect(() => {
  fetch("/api/data").then(r => r.json()).then(data => {
    setData(data); continueRender(handle);
  });
}, [handle]);

// --- Media ---
<Img src={staticFile("logo.png")} />
<Audio src={staticFile("music.mp3")} volume={0.5} />
```

## Player (Embedding in Next.js)

```tsx
"use client";
import { Player, PlayerRef } from "@remotion/player";
import { IntroVideo } from "@/remotion/compositions/IntroVideo/Main";

const playerRef = useRef<PlayerRef>(null);

<Player ref={playerRef} component={IntroVideo}
  inputProps={{ title: "Hello", primaryColor: "#0066cc" }}
  durationInFrames={150} fps={30}
  compositionWidth={1920} compositionHeight={1080}
  style={{ width: "100%" }} controls autoPlay loop />

// PlayerRef: play(), pause(), toggle(), seekTo(frame), getCurrentFrame(), requestFullscreen()
```

## CLI Rendering

```bash
npx remotion studio                                  # Preview interattivo
npx remotion render IntroVideo out/video.mp4         # MP4 (H.264)
npx remotion render --codec=vp8 IntroVideo out/v.webm # WebM (trasparenza)
npx remotion render --codec=gif --every-nth-frame=2 IntroVideo out/v.gif
npx remotion render IntroVideo out/v.mp4 --props='{"title":"Custom"}'
npx remotion render IntroVideo out/v.mp4 --crf=18    # Qualità alta
```

| Codec | Formato | Note |
|-------|---------|------|
| `h264` | MP4 | Default, più compatibile |
| `h265` | MP4 | Compressione migliore |
| `vp8`/`vp9` | WebM | Supporta trasparenza |
| `gif` | GIF | Usa `--every-nth-frame=2` |

## Server-Side Rendering

```typescript
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

export async function renderVideo(compositionId: string, inputProps: Record<string, unknown>, outputPath: string) {
  const bundleLocation = await bundle({ entryPoint: "./src/remotion/index.ts" });
  const composition = await selectComposition({ serveUrl: bundleLocation, id: compositionId, inputProps });
  await renderMedia({ codec: "h264", composition, serveUrl: bundleLocation, outputLocation: outputPath, inputProps,
    chromiumOptions: { enableMultiProcessOnLinux: true } });
}
```

## Docker

```dockerfile
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libasound2 \
  libxrandr2 libxkbcommon-dev libxfixes3 libxcomposite1 libxdamage1 libatk-bridge2.0-0 \
  libpango-1.0-0 libcairo2 libcups2 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
RUN npm ci && npx remotion browser ensure
CMD ["node", "render.mjs"]
```

**Docker rules**: Debian only (no Alpine), no FFmpeg needed (bundled), `npx remotion browser ensure` per Chromium, `--cpus=16` per performance.

## Dimensioni Standard

| Piattaforma | Dimensioni | Durata tipica |
|-------------|-----------|---------------|
| YouTube/LinkedIn | 1920×1080 | 5-30s |
| Instagram Reel/TikTok/Stories | 1080×1920 | 15-60s |
| Instagram Post | 1080×1080 | 9-15s |
| OG Preview | 1200×630 | 3-5s |
| Twitter/X | 1280×720 | 15-60s |

## Tailwind v4 in Remotion

```typescript
// remotion.config.ts — già configurato sopra
// postcss.config.mjs
export default { plugins: { "@tailwindcss/postcss": {} } };
// src/remotion/styles.css (importare in Root.tsx)
@import "tailwindcss";
```

Se `package.json` ha `"sideEffects": false`, cambiare a `"sideEffects": ["*.css"]`.

## API Aggiuntive

| API | Package | Uso |
|-----|---------|-----|
| `<OffthreadVideo>` | remotion | Video sync con timeline |
| `<Loop>` | remotion | Ripeti contenuto N volte |
| `<Freeze>` | remotion | Congela a frame specifico |
| `measureSpring()` | remotion | Durata spring in frames |
| `@remotion/shapes` | shapes | SVG: Circle, Rect, Triangle |
| `@remotion/paths` | paths | Manipolazione SVG path |
| `@remotion/google-fonts` | google-fonts | Carica Google Fonts |
| `@remotion/zod-types` | zod-types | zColor, zTextarea |

## NPM Scripts

```json
{
  "remotion:studio": "remotion studio",
  "remotion:render": "remotion render IntroVideo out/video.mp4",
  "remotion:render:gif": "remotion render --codec=gif --every-nth-frame=2 IntroVideo out/video.gif"
}
```

## Best Practices

1. **Composizioni pure React** — deterministiche, no side effects
2. **Zod schemas** per ogni composizione
3. **SEMPRE clamp** su interpolate (`extrapolateRight: "clamp"`)
4. **spring()** per animazioni naturali
5. **delayRender** per async (font, dati, immagini)
6. **Sequence/Series** per organizzare scene
7. **OffthreadVideo** per video di sfondo
8. **30 FPS** sufficiente per web
9. **Test in Studio** prima di renderizzare
10. **Docker: solo Debian**, mai Alpine
