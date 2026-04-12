---
name: media
description: Media and file upload knowledge base - Uploadthing, Cloudinary, Vercel Blob, image optimization. Use when implementing file uploads, managing media assets, or optimizing images in Next.js.
version: 1.0.0
---

# Media & Upload Skill

Knowledge base per gestione media, upload e ottimizzazione immagini.

## Provider Raccomandati

| Provider | Tipo | Free Tier | Best For |
|----------|------|-----------|----------|
| **Uploadthing** | File upload per Next.js | 2GB | App con upload utenti |
| **Cloudinary** | CDN + trasformazioni | 25GB/mese | Immagini dinamiche |
| **Vercel Blob** | Storage serverless | 1GB | Semplice, Next.js native |
| **AWS S3 + CloudFront** | Enterprise | Pay per use | Scaling massivo |

---

## Uploadthing (Raccomandato per Next.js)

### Installazione

```bash
pnpm add uploadthing @uploadthing/react
```

### Server Setup

```typescript
// lib/uploadthing.ts
import { createUploadthing, type FileRouter } from 'uploadthing/next'
import { auth } from '@/auth'

const f = createUploadthing()

export const ourFileRouter = {
  // Avatar upload
  avatarUploader: f({ image: { maxFileSize: '4MB', maxFileCount: 1 } })
    .middleware(async () => {
      const session = await auth()
      if (!session) throw new Error('Unauthorized')
      return { userId: session.user.id }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log('Upload complete for userId:', metadata.userId)
      console.log('File URL:', file.url)
      
      // Update user avatar in database
      await db.user.update({
        where: { id: metadata.userId },
        data: { avatar: file.url },
      })

      return { uploadedBy: metadata.userId, url: file.url }
    }),

  // Document upload
  documentUploader: f({
    pdf: { maxFileSize: '16MB', maxFileCount: 5 },
    'application/msword': { maxFileSize: '16MB' },
  })
    .middleware(async () => {
      const session = await auth()
      if (!session) throw new Error('Unauthorized')
      return { userId: session.user.id }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { url: file.url }
    }),

  // Image gallery
  imageUploader: f({ image: { maxFileSize: '8MB', maxFileCount: 10 } })
    .middleware(async () => {
      const session = await auth()
      if (!session) throw new Error('Unauthorized')
      return { userId: session.user.id }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { url: file.url }
    }),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter
```

### API Route

```typescript
// app/api/uploadthing/core.ts
export { ourFileRouter } from '@/lib/uploadthing'

// app/api/uploadthing/route.ts
import { createRouteHandler } from 'uploadthing/next'
import { ourFileRouter } from './core'

export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
})
```

### Client Components

```typescript
// components/upload-button.tsx
'use client'

import { UploadButton, UploadDropzone } from '@uploadthing/react'
import type { OurFileRouter } from '@/lib/uploadthing'
import { toast } from 'sonner'

export function AvatarUpload({ onUploadComplete }: { onUploadComplete: (url: string) => void }) {
  return (
    <UploadButton<OurFileRouter, 'avatarUploader'>
      endpoint="avatarUploader"
      onClientUploadComplete={(res) => {
        if (res?.[0]) {
          onUploadComplete(res[0].url)
          toast.success('Avatar aggiornato!')
        }
      }}
      onUploadError={(error) => {
        toast.error(`Errore: ${error.message}`)
      }}
      appearance={{
        button: 'bg-primary text-primary-foreground hover:bg-primary/90',
        allowedContent: 'text-muted-foreground text-xs',
      }}
    />
  )
}

export function ImageDropzone({ onUploadComplete }: { onUploadComplete: (urls: string[]) => void }) {
  return (
    <UploadDropzone<OurFileRouter, 'imageUploader'>
      endpoint="imageUploader"
      onClientUploadComplete={(res) => {
        const urls = res?.map((file) => file.url) || []
        onUploadComplete(urls)
        toast.success(`${urls.length} immagini caricate!`)
      }}
      onUploadError={(error) => {
        toast.error(`Errore: ${error.message}`)
      }}
      appearance={{
        container: 'border-2 border-dashed border-muted-foreground/25 rounded-lg',
        uploadIcon: 'text-muted-foreground',
        label: 'text-muted-foreground',
        allowedContent: 'text-muted-foreground text-xs',
      }}
    />
  )
}
```

### Custom Hook

```typescript
// hooks/use-upload.ts
import { useUploadThing } from '@uploadthing/react'
import { useState } from 'react'

export function useImageUpload() {
  const [progress, setProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)

  const { startUpload } = useUploadThing('imageUploader', {
    onUploadProgress: (p) => setProgress(p),
    onUploadBegin: () => setIsUploading(true),
    onClientUploadComplete: () => {
      setIsUploading(false)
      setProgress(0)
    },
  })

  const upload = async (files: File[]) => {
    const result = await startUpload(files)
    return result?.map((r) => r.url) || []
  }

  return { upload, progress, isUploading }
}
```

---

## Cloudinary

### Installazione

```bash
pnpm add cloudinary next-cloudinary
```

### Setup

```typescript
// lib/cloudinary.ts
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export { cloudinary }

// Upload function
export async function uploadToCloudinary(file: Buffer, options?: any) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder: 'my-app',
        ...options,
      },
      (error, result) => {
        if (error) reject(error)
        else resolve(result)
      }
    ).end(file)
  })
}
```

### CldImage Component

```typescript
// components/optimized-image.tsx
import { CldImage } from 'next-cloudinary'

interface OptimizedImageProps {
  src: string
  alt: string
  width: number
  height: number
  className?: string
}

export function OptimizedImage({ src, alt, width, height, className }: OptimizedImageProps) {
  return (
    <CldImage
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      crop="fill"
      gravity="auto"
      format="auto"
      quality="auto"
    />
  )
}

// Con trasformazioni
export function ProductImage({ publicId }: { publicId: string }) {
  return (
    <CldImage
      src={publicId}
      alt="Product"
      width={600}
      height={400}
      crop="fill"
      gravity="auto"
      effects={[
        { background: 'rgb:f5f5f5' },
        { quality: 'auto' },
      ]}
      overlays={[
        {
          publicId: 'watermark',
          position: { gravity: 'south_east', x: 10, y: 10 },
          effects: [{ opacity: 50 }],
        },
      ]}
    />
  )
}
```

### CldUploadWidget

```typescript
'use client'

import { CldUploadWidget } from 'next-cloudinary'
import { Button } from '@/components/ui/button'

export function CloudinaryUpload({ onUpload }: { onUpload: (url: string) => void }) {
  return (
    <CldUploadWidget
      uploadPreset="my-preset"
      options={{
        maxFiles: 5,
        resourceType: 'image',
        clientAllowedFormats: ['jpg', 'png', 'webp'],
        maxFileSize: 10000000, // 10MB
      }}
      onSuccess={(result: any) => {
        onUpload(result.info.secure_url)
      }}
    >
      {({ open }) => (
        <Button type="button" onClick={() => open()}>
          Upload Image
        </Button>
      )}
    </CldUploadWidget>
  )
}
```

### URL Transformations

```typescript
// lib/cloudinary-url.ts
import { getCldImageUrl } from 'next-cloudinary'

export function getOptimizedUrl(publicId: string, options?: {
  width?: number
  height?: number
  crop?: string
  quality?: string
}) {
  return getCldImageUrl({
    src: publicId,
    width: options?.width || 800,
    height: options?.height || 600,
    crop: options?.crop || 'fill',
    quality: options?.quality || 'auto',
    format: 'auto',
  })
}

// Thumbnail
export function getThumbnailUrl(publicId: string) {
  return getCldImageUrl({
    src: publicId,
    width: 150,
    height: 150,
    crop: 'thumb',
    gravity: 'face',
  })
}

// Responsive srcset
export function getResponsiveUrls(publicId: string) {
  const widths = [320, 640, 960, 1280, 1920]
  
  return widths.map((w) => ({
    width: w,
    url: getCldImageUrl({
      src: publicId,
      width: w,
      crop: 'scale',
      quality: 'auto',
      format: 'auto',
    }),
  }))
}
```

---

## Vercel Blob (Semplice)

### Setup

```bash
pnpm add @vercel/blob
```

### Upload

```typescript
// app/api/upload/route.ts
import { put } from '@vercel/blob'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const form = await request.formData()
  const file = form.get('file') as File
  
  if (!file) {
    return NextResponse.json({ error: 'No file' }, { status: 400 })
  }

  const blob = await put(file.name, file, {
    access: 'public',
  })

  return NextResponse.json(blob)
}
```

### Client Upload

```typescript
// app/api/upload/route.ts
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Validate user, check permissions
        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
          maximumSizeInBytes: 10 * 1024 * 1024, // 10MB
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log('Upload completed:', blob.url)
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 400 })
  }
}
```

---

## Image Optimization (Next.js Native)

### next.config.js

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'utfs.io', // Uploadthing
      },
      {
        protocol: 'https',
        hostname: '*.blob.vercel-storage.com',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
}

module.exports = nextConfig
```

### Optimized Image Component

```typescript
// components/image.tsx
import NextImage, { ImageProps } from 'next/image'
import { cn } from '@/lib/utils'

interface Props extends Omit<ImageProps, 'alt'> {
  alt: string // Required
  aspectRatio?: 'square' | 'video' | 'portrait' | 'auto'
}

const aspectRatios = {
  square: 'aspect-square',
  video: 'aspect-video',
  portrait: 'aspect-[3/4]',
  auto: '',
}

export function Image({ alt, aspectRatio = 'auto', className, ...props }: Props) {
  return (
    <div className={cn('relative overflow-hidden', aspectRatios[aspectRatio], className)}>
      <NextImage
        alt={alt}
        className="object-cover"
        fill={aspectRatio !== 'auto'}
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        {...props}
      />
    </div>
  )
}
```

### Blur Placeholder

```typescript
// lib/image.ts
import { getPlaiceholder } from 'plaiceholder'

export async function getBlurDataUrl(imageUrl: string) {
  try {
    const res = await fetch(imageUrl)
    const buffer = await res.arrayBuffer()
    const { base64 } = await getPlaiceholder(Buffer.from(buffer))
    return base64
  } catch {
    return undefined
  }
}

// Usage
const blurDataUrl = await getBlurDataUrl(imageUrl)

<Image
  src={imageUrl}
  alt="..."
  placeholder="blur"
  blurDataURL={blurDataUrl}
/>
```

---

## Environment Variables

```env
# Uploadthing
UPLOADTHING_SECRET=sk_xxx
UPLOADTHING_APP_ID=xxx

# Cloudinary
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx

# Vercel Blob
BLOB_READ_WRITE_TOKEN=xxx

# AWS S3 (alternativa)
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=eu-west-1
AWS_BUCKET_NAME=xxx
```

---

## Checklist Media

- [ ] Provider scelto (Uploadthing/Cloudinary/Blob)
- [ ] Upload component implementato
- [ ] Validazione file (tipo, size)
- [ ] Autenticazione su upload
- [ ] Image optimization configurata
- [ ] Responsive images (srcset/sizes)
- [ ] Lazy loading attivo
- [ ] Blur placeholder (opzionale)
- [ ] CDN configurato
- [ ] Error handling upload
- [ ] Progress indicator
- [ ] Delete/cleanup unused files
