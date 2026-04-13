import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs'

export function fileHash(filePath: string): string {
  const content = fs.readFileSync(filePath)
  return createHash('sha256').update(content).digest('hex').slice(0, 16)
}

export function contentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16)
}

export function randomId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 12)
}

export function nodeId(filePath: string, name: string, label: string): string {
  return createHash('sha256').update(`${filePath}:${label}:${name}`).digest('hex').slice(0, 16)
}

export function edgeId(sourceId: string, targetId: string, type: string): string {
  return createHash('sha256').update(`${sourceId}-${type}->${targetId}`).digest('hex').slice(0, 16)
}
