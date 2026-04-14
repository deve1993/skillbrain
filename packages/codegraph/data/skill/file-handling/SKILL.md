---
name: file-handling
description: File handling patterns — S3/R2/Vercel Blob storage, PDF generation, CSV/Excel import-export, file streaming, presigned URLs, multipart upload. Use when implementing file uploads to cloud storage, generating documents, processing large files, or building download endpoints.
version: 1.0.0
---

# File Handling — Next.js

## 1. Cloud Storage

### AWS S3

```bash
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

```ts
// lib/s3.ts
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.S3_BUCKET!

// Presigned URL for direct upload from browser
export async function getUploadUrl(key: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  })
  return getSignedUrl(s3, command, { expiresIn: 3600 })
}

// Presigned URL for download
export async function getDownloadUrl(key: string) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key })
  return getSignedUrl(s3, command, { expiresIn: 3600 })
}

// Server-side upload
export async function uploadFile(key: string, body: Buffer, contentType: string) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET, Key: key, Body: body, ContentType: contentType,
  }))
  return `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`
}

// Delete
export async function deleteFile(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}
```

```ts
// app/api/upload/presign/route.ts
import { getUploadUrl } from '@/lib/s3'
import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'

export async function POST(req: NextRequest) {
  const { filename, contentType } = await req.json()
  const ext = filename.split('.').pop()
  const key = `uploads/${nanoid()}.${ext}`
  const url = await getUploadUrl(key, contentType)
  return NextResponse.json({ url, key })
}
```

```tsx
// Client: direct upload to S3 via presigned URL
async function uploadToS3(file: File) {
  const { url, key } = await fetch('/api/upload/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, contentType: file.type }),
  }).then(r => r.json())

  await fetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
  return key
}
```

### Cloudflare R2 (S3-compatible)

```ts
// lib/r2.ts — same S3Client, different endpoint
const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY!,
    secretAccessKey: process.env.R2_SECRET_KEY!,
  },
})
// Everything else is identical to S3
```

### Vercel Blob

```bash
pnpm add @vercel/blob
```

```ts
// app/api/upload/route.ts
import { put, del } from '@vercel/blob'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const form = await req.formData()
  const file = form.get('file') as File

  const blob = await put(file.name, file, {
    access: 'public',
    addRandomSuffix: true,
  })

  return NextResponse.json(blob) // { url, downloadUrl, pathname }
}
```

## 2. PDF Generation

### React PDF (@react-pdf/renderer)

```bash
pnpm add @react-pdf/renderer
```

```tsx
// lib/pdf/invoice-template.tsx
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  title: { fontSize: 24, fontWeight: 'bold' },
  table: { width: '100%', marginTop: 20 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#e5e7eb', padding: 8 },
  total: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10, fontSize: 14, fontWeight: 'bold' },
})

interface InvoiceProps {
  number: string; date: string; items: { name: string; qty: number; price: number }[]
  customer: { name: string; email: string }
}

export function InvoicePDF({ number, date, items, customer }: InvoiceProps) {
  const total = items.reduce((sum, i) => sum + i.qty * i.price, 0)
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Invoice #{number}</Text>
          <Text>{date}</Text>
        </View>
        <Text>Bill to: {customer.name} ({customer.email})</Text>
        <View style={styles.table}>
          <View style={[styles.row, { fontWeight: 'bold' }]}>
            <Text style={{ flex: 3 }}>Item</Text>
            <Text style={{ flex: 1 }}>Qty</Text>
            <Text style={{ flex: 1 }}>Price</Text>
            <Text style={{ flex: 1 }}>Total</Text>
          </View>
          {items.map((item, i) => (
            <View key={i} style={styles.row}>
              <Text style={{ flex: 3 }}>{item.name}</Text>
              <Text style={{ flex: 1 }}>{item.qty}</Text>
              <Text style={{ flex: 1 }}>€{item.price}</Text>
              <Text style={{ flex: 1 }}>€{item.qty * item.price}</Text>
            </View>
          ))}
        </View>
        <View style={styles.total}>
          <Text>Total: €{total.toFixed(2)}</Text>
        </View>
      </Page>
    </Document>
  )
}
```

```ts
// app/api/invoice/[id]/pdf/route.ts
import { renderToBuffer } from '@react-pdf/renderer'
import { InvoicePDF } from '@/lib/pdf/invoice-template'
import { NextResponse } from 'next/server'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const invoice = await getInvoice(params.id) // your DB call

  const buffer = await renderToBuffer(
    <InvoicePDF {...invoice} />
  )

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${invoice.number}.pdf"`,
    },
  })
}
```

### HTML to PDF (Puppeteer)

```ts
// lib/pdf/html-to-pdf.ts
import puppeteer from 'puppeteer'

export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'networkidle0' })
  const pdf = await page.pdf({
    format: 'A4',
    margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
    printBackground: true,
  })
  await browser.close()
  return Buffer.from(pdf)
}
```

## 3. CSV/Excel

### CSV Export (Server Action)

```ts
'use server'
import { stringify } from 'csv-stringify/sync'

export async function exportUsersCSV() {
  const users = await db.user.findMany({ select: { name: true, email: true, createdAt: true } })

  const csv = stringify(users, {
    header: true,
    columns: { name: 'Name', email: 'Email', createdAt: 'Created At' },
  })

  return csv // return string, client creates download
}
```

```tsx
// Client download helper
async function downloadCSV() {
  const csv = await exportUsersCSV()
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'users.csv'; a.click()
  URL.revokeObjectURL(url)
}
```

### CSV Import with Validation

```ts
// app/api/import/route.ts
import { parse } from 'csv-parse/sync'
import { z } from 'zod'

const RowSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['admin', 'user']),
})

export async function POST(req: Request) {
  const form = await req.formData()
  const file = form.get('file') as File
  const text = await file.text()

  const records = parse(text, { columns: true, skip_empty_lines: true, trim: true })
  const results = { success: 0, errors: [] as string[] }

  for (const [i, record] of records.entries()) {
    const parsed = RowSchema.safeParse(record)
    if (!parsed.success) {
      results.errors.push(`Row ${i + 2}: ${parsed.error.issues[0].message}`)
      continue
    }
    await db.user.create({ data: parsed.data })
    results.success++
  }

  return NextResponse.json(results)
}
```

### Excel with ExcelJS

```bash
pnpm add exceljs
```

```ts
// app/api/export/excel/route.ts
import ExcelJS from 'exceljs'

export async function GET() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Users')

  sheet.columns = [
    { header: 'Name', key: 'name', width: 25 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Role', key: 'role', width: 15 },
  ]

  // Style header
  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }

  const users = await db.user.findMany()
  users.forEach((u) => sheet.addRow(u))

  const buffer = await workbook.xlsx.writeBuffer()

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="users.xlsx"',
    },
  })
}
```

## 4. File Streaming

### Stream Large File Download

```ts
// app/api/download/[key]/route.ts
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { s3, BUCKET } from '@/lib/s3'

export async function GET(req: Request, { params }: { params: { key: string } }) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: params.key })
  const response = await s3.send(command)

  return new Response(response.Body as ReadableStream, {
    headers: {
      'Content-Type': response.ContentType || 'application/octet-stream',
      'Content-Length': String(response.ContentLength),
      'Content-Disposition': `attachment; filename="${params.key.split('/').pop()}"`,
    },
  })
}
```

### Upload with Progress

```tsx
function UploadWithProgress() {
  const [progress, setProgress] = useState(0)

  async function upload(file: File) {
    const { url, key } = await getPresignedUrl(file)

    const xhr = new XMLHttpRequest()
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
    })

    await new Promise((resolve, reject) => {
      xhr.onload = resolve; xhr.onerror = reject
      xhr.open('PUT', url)
      xhr.setRequestHeader('Content-Type', file.type)
      xhr.send(file)
    })
  }

  return <progress value={progress} max={100} />
}
```

## 5. Validation & Security

### File Type Validation (Magic Bytes)

```ts
const MAGIC_BYTES: Record<string, number[]> = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png':  [0x89, 0x50, 0x4E, 0x47],
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
}

export function validateFileType(buffer: ArrayBuffer, expectedType: string): boolean {
  const bytes = new Uint8Array(buffer)
  const magic = MAGIC_BYTES[expectedType]
  if (!magic) return false
  return magic.every((byte, i) => bytes[i] === byte)
}

// Usage in API route
const file = form.get('file') as File
const buffer = await file.arrayBuffer()
if (!validateFileType(buffer, file.type)) {
  return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
}
```

### Image Resize Pipeline (Sharp)

```ts
import sharp from 'sharp'

export async function processImage(buffer: Buffer) {
  const variants = await Promise.all([
    sharp(buffer).resize(1200, 800, { fit: 'inside' }).webp({ quality: 80 }).toBuffer(),
    sharp(buffer).resize(600, 400, { fit: 'inside' }).webp({ quality: 80 }).toBuffer(),
    sharp(buffer).resize(200, 200, { fit: 'cover' }).webp({ quality: 70 }).toBuffer(),
  ])

  return { large: variants[0], medium: variants[1], thumb: variants[2] }
}
```

## Decision Matrix

| Storage | Cost | Latency | Best For |
|---------|------|---------|----------|
| Vercel Blob | $$$ | Low | Quick setup, small files |
| Cloudflare R2 | $ | Low | Cost-sensitive, no egress fees |
| AWS S3 | $$ | Medium | Enterprise, existing AWS infra |
| Uploadthing | $$ | Low | File upload UI out of the box |
