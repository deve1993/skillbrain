---
name: ffmpeg
description: FFmpeg integration for server-side video processing - transcoding, filters, thumbnails. Use when processing video server-side, generating thumbnails, transcoding formats, or applying video filters.
version: 1.0.0
---

# FFmpeg Knowledge Base

## Integrazione Server-Side (Next.js + Docker)

Per processare, convertire e migliorare video esistenti, la soluzione migliore è eseguire FFmpeg nativo lato server (via Docker) controllato da Node.js.

### 1. Installazione (System)

Aggiungi FFmpeg al tuo **Dockerfile** (Debian-based):

```dockerfile
# Dockerfile
FROM node:22-bookworm-slim

# Install ffmpeg
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# ... resto del Dockerfile
```

### 2. Installazione (Node.js)

Usa `fluent-ffmpeg` per controllare FFmpeg da codice TypeScript.

```bash
pnpm add fluent-ffmpeg
pnpm add -D @types/fluent-ffmpeg
```

## Setup Core

Crea un'utility per gestire i path e la configurazione.

```typescript
// src/lib/ffmpeg.ts
import ffmpeg from 'fluent-ffmpeg';

// Opzionale: se il path non è nel PATH di sistema
// ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');

export const processVideo = (inputPath: string, outputPath: string) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .output(outputPath)
      .on('end', () => resolve(true))
      .on('error', (err) => reject(err))
      .run();
  });
};
```

## Pattern Comuni

### Conversione & Ottimizzazione (Web-Ready)

Converte in MP4 (H.264/AAC) ottimizzato per il web (Fast Start).

```typescript
export async function optimizeVideo(input: string, output: string) {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        '-crf 23',           // Qualità bilanciata (18-28)
        '-preset fast',      // Speed vs Compression
        '-movflags +faststart' // Streaming immediato
      ])
      .save(output)
      .on('end', resolve)
      .on('error', reject);
  });
}
```

### Estrazione Thumbnail

```typescript
export async function generateThumbnail(input: string, outputFolder: string) {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .screenshots({
        count: 1,
        folder: outputFolder,
        filename: 'thumbnail-%b.png',
        size: '1280x720'
      })
      .on('end', resolve)
      .on('error', reject);
  });
}
```

### "Miglioramento" Video (Filtri Base)

Miglioramento base senza AI (denoise, sharpening, color correction).

```typescript
export async function enhanceVideo(input: string, output: string) {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .videoFilters([
        'hqdn3d=1.5:1.5:6:6',  // High Quality Denoise (leggero)
        'unsharp=5:5:1.0:5:5:0.0', // Sharpening
        'eq=saturation=1.1:contrast=1.05' // Color correction leggera
      ])
      .save(output)
      .on('end', resolve)
      .on('error', reject);
  });
}
```

### Estrazione Audio

```typescript
ffmpeg(input)
  .noVideo()
  .audioCodec('libmp3lame')
  .save('audio.mp3');
```

## Gestione File Temporanei

Quando lavori con Server Actions o API Routes, usa directory temporanee.

```typescript
import { join } from 'path';
import { tmpdir } from 'os';
import { writeFile, unlink } from 'fs/promises';

export async function handleUpload(file: File) {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  
  const tempInput = join(tmpdir(), `input-${Date.now()}.mp4`);
  const tempOutput = join(tmpdir(), `output-${Date.now()}.mp4`);
  
  try {
    await writeFile(tempInput, buffer);
    await optimizeVideo(tempInput, tempOutput);
    // ... upload tempOutput to S3/Blob ...
  } finally {
    // Cleanup fondamentale
    await Promise.all([
      unlink(tempInput).catch(() => {}),
      unlink(tempOutput).catch(() => {})
    ]);
  }
}
```

## Best Practices

1.  **Non bloccare il main thread**: FFmpeg è pesante. Usa code (es. BullMQ) o background jobs per video lunghi.
2.  **Timeout**: Le Serverless Functions (Vercel) hanno timeout brevi. Per video lunghi serve un server persistente (VPS/Coolify).
3.  **Security**: Non passare mai stringhe utente direttamente a `complexFilter` o comandi shell.
4.  **Hardware Acceleration**: Se il server ha GPU (es. NVIDIA), usa flag come `-c:v h264_nvenc` per performance 10x.
