import fs from 'node:fs'
import path from 'node:path'
import type { DesignSystemInput } from './components-store.js'

// ── Types ──────────────────────────────────────────────

export type SourceType = 'tailwind' | 'css' | 'tokens_json'

export interface TokenSource {
  source: SourceType
  path: string
  tokens: Partial<DesignSystemInput>
}

export interface Conflict {
  field: 'colors' | 'fonts' | 'spacing' | 'radius'
  key: string
  values: Array<{ source: string; value: unknown }>
}

export interface MergeResult {
  merged: Partial<DesignSystemInput>
  conflicts: Conflict[]
  sources: TokenSource[]
}

export interface DesignFiles {
  tailwind?: string
  css?: string
  tokensJson?: string
}

// ── File detection ─────────────────────────────────────

export function detectDesignFiles(workspacePath: string): DesignFiles {
  const result: DesignFiles = {}

  const tailwindCandidates = [
    'tailwind.config.ts', 'tailwind.config.js', 'tailwind.config.cjs', 'tailwind.config.mjs',
  ]
  for (const f of tailwindCandidates) {
    const p = path.join(workspacePath, f)
    if (fs.existsSync(p)) { result.tailwind = p; break }
  }

  const cssCandidates = [
    'src/app/globals.css', 'app/globals.css', 'src/styles/globals.css',
    'styles/globals.css', 'src/index.css', 'src/global.css', 'styles/main.css',
    'src/app/tailwind.css', 'src/styles/tailwind.css',
  ]
  for (const f of cssCandidates) {
    const p = path.join(workspacePath, f)
    if (fs.existsSync(p)) { result.css = p; break }
  }

  const tokensCandidates = [
    'tokens.json', 'design-tokens.json', 'src/tokens.json',
    'src/design-tokens.json', 'theme/tokens.json',
  ]
  for (const f of tokensCandidates) {
    const p = path.join(workspacePath, f)
    if (fs.existsSync(p)) { result.tokensJson = p; break }
  }

  return result
}

// ── Tailwind parser ────────────────────────────────────

function extractBlock(text: string, key: string): string {
  const start = text.indexOf(`${key}:`)
  if (start === -1) return ''
  let depth = 0
  let i = text.indexOf('{', start)
  if (i === -1) return ''
  const begin = i
  while (i < text.length) {
    if (text[i] === '{') depth++
    else if (text[i] === '}') { depth--; if (depth === 0) return text.slice(begin, i + 1) }
    i++
  }
  return ''
}

function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}_${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(result, flattenObject(v as Record<string, unknown>, key))
    } else if (typeof v === 'string') {
      // Skip CSS var references and template literals
      if (!v.includes('var(--') && !v.includes('${')) result[key] = v
    }
  }
  return result
}

function parseSimpleObject(block: string): Record<string, unknown> {
  try {
    // Remove JS-style comments, trailing commas, single-quote to double-quote
    const cleaned = block
      .replace(/\/\/[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/,(\s*[}\]])/g, '$1')
      .replace(/'([^']+)'/g, '"$1"')
      .replace(/(\w+)\s*:/g, '"$1":')
    return JSON.parse(cleaned)
  } catch {
    return {}
  }
}

export function parseTailwindConfig(filePath: string): Partial<DesignSystemInput> {
  const result: Partial<DesignSystemInput> = {}
  let text: string
  try { text = fs.readFileSync(filePath, 'utf8') } catch { return result }

  // darkMode
  if (/darkMode\s*:\s*['"]class['"]/.test(text) || /darkMode\s*:\s*\[/.test(text)) {
    result.darkMode = true
  }

  // Extract theme block (handle both `theme:` and `theme: { extend: { ... } }`)
  const themeBlock = extractBlock(text, 'theme')
  const extendBlock = extractBlock(themeBlock, 'extend')
  const source = extendBlock || themeBlock

  // colors
  const colorsBlock = extractBlock(source, 'colors')
  if (colorsBlock) {
    const parsed = parseSimpleObject(colorsBlock)
    const flat = flattenObject(parsed)
    if (Object.keys(flat).length > 0) result.colors = flat
  }

  // fontFamily
  const fontBlock = extractBlock(source, 'fontFamily')
  if (fontBlock) {
    const parsed = parseSimpleObject(fontBlock) as Record<string, unknown>
    const fonts: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (Array.isArray(v) && v.length > 0) fonts[k] = v[0]
      else if (typeof v === 'string') fonts[k] = v
    }
    if (Object.keys(fonts).length > 0) result.fonts = fonts
  }

  // spacing
  const spacingBlock = extractBlock(source, 'spacing')
  if (spacingBlock) {
    const parsed = parseSimpleObject(spacingBlock)
    if (Object.keys(parsed).length > 0) result.spacing = parsed as Record<string, unknown>
  }

  // borderRadius
  const radiusBlock = extractBlock(source, 'borderRadius')
  if (radiusBlock) {
    const parsed = parseSimpleObject(radiusBlock) as Record<string, string>
    if (Object.keys(parsed).length > 0) result.radius = parsed
  }

  // keyframes + animation → animations
  const keyframesBlock = extractBlock(source, 'keyframes')
  if (keyframesBlock) {
    try {
      const parsed = parseSimpleObject(keyframesBlock)
      const animationBlock = extractBlock(source, 'animation')
      const animations: unknown[] = []
      for (const name of Object.keys(parsed)) {
        let usage = name
        if (animationBlock) {
          const animParsed = parseSimpleObject(animationBlock) as Record<string, string>
          usage = animParsed[name] || name
        }
        animations.push({ name, usage })
      }
      if (animations.length > 0) result.animations = animations
    } catch {}
  }

  // store raw tailwind config excerpt (first 500 chars of theme block)
  if (source) result.tailwindConfig = source.slice(0, 500)

  return result
}

// ── CSS variables parser ───────────────────────────────

export function parseCSSVariables(filePath: string): Partial<DesignSystemInput> {
  const result: Partial<DesignSystemInput> = {}
  let text: string
  try { text = fs.readFileSync(filePath, 'utf8') } catch { return result }

  const colors: Record<string, string> = {}
  const fonts: Record<string, unknown> = {}
  const spacing: Record<string, unknown> = {}
  const radius: Record<string, string> = {}

  // Tailwind v4 uses @theme inline { ... } instead of tailwind.config.ts
  const isTailwindV4 = /@theme\s+(inline\s*)?\{/.test(text)
  if (isTailwindV4) result.colorFormat = 'oklch'

  const regex = /--([a-z0-9][a-z0-9-]*)\s*:\s*([^;}\n]+)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    const name = match[1].trim()
    const value = match[2].trim()
    if (!name || !value) continue

    // Skip CSS variable cross-references (e.g. var(--font-yeseva)) — not useful as token values
    if (value.startsWith('var(--')) continue

    if (/^(color|clr|c)-/.test(name)) {
      colors[name.replace(/^(color|clr|c)-/, '')] = value
    } else if (/^color$/.test(name)) {
      colors[name] = value
    } else if (/^font-/.test(name)) {
      fonts[name.replace(/^font-/, '')] = value
    } else if (/^(spacing|space|gap)-/.test(name)) {
      spacing[name.replace(/^(spacing|space|gap)-/, '')] = value
    } else if (/^(radius|rounded|border-radius)-/.test(name)) {
      radius[name.replace(/^(radius|rounded|border-radius)-/, '')] = value
    }
    // Also pick up generic --primary, --secondary, --background, --foreground style
    else if (/^(primary|secondary|accent|background|foreground|muted|destructive|border|ring|card|popover|input)/.test(name)) {
      colors[name] = value
    }
  }

  if (Object.keys(colors).length > 0) result.colors = colors
  if (Object.keys(fonts).length > 0) result.fonts = fonts
  if (Object.keys(spacing).length > 0) result.spacing = spacing
  if (Object.keys(radius).length > 0) result.radius = radius

  return result
}

// ── W3C Design Tokens parser ───────────────────────────

function flattenW3CTokens(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}_${k}` : k
    if (v && typeof v === 'object') {
      const node = v as Record<string, unknown>
      if ('$value' in node) {
        const val = node['$value']
        if (typeof val === 'string') result[key] = val
      } else {
        Object.assign(result, flattenW3CTokens(node, key))
      }
    }
  }
  return result
}

export function parseTokensJson(filePath: string): Partial<DesignSystemInput> {
  const result: Partial<DesignSystemInput> = {}
  let raw: Record<string, unknown>
  try { raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) } catch { return result }

  const colors: Record<string, string> = {}
  const fonts: Record<string, unknown> = {}
  const spacing: Record<string, unknown> = {}
  const radius: Record<string, string> = {}

  for (const [group, node] of Object.entries(raw)) {
    if (!node || typeof node !== 'object') continue
    const groupKey = group.toLowerCase()
    const flat = flattenW3CTokens(node as Record<string, unknown>)

    if (/color|colour/.test(groupKey)) Object.assign(colors, flat)
    else if (/font|typo/.test(groupKey)) Object.assign(fonts, flat)
    else if (/spacing|space/.test(groupKey)) Object.assign(spacing, flat)
    else if (/radius|rounded/.test(groupKey)) Object.assign(radius, flat)
  }

  if (Object.keys(colors).length > 0) result.colors = colors
  if (Object.keys(fonts).length > 0) result.fonts = fonts
  if (Object.keys(spacing).length > 0) result.spacing = spacing
  if (Object.keys(radius).length > 0) result.radius = radius

  return result
}

// ── Merge with conflict detection ─────────────────────

const FIELDS = ['colors', 'fonts', 'spacing', 'radius'] as const
type TokenField = typeof FIELDS[number]

export function mergeTokenSources(sources: TokenSource[]): MergeResult {
  const merged: Partial<DesignSystemInput> = {}
  const conflicts: Conflict[] = []

  // Track which source first defined each key per field
  const seen: Partial<Record<TokenField, Record<string, { source: string; value: unknown }>>> = {}

  for (const field of FIELDS) {
    seen[field] = {}
    merged[field] = {} as any
  }

  for (const src of sources) {
    for (const field of FIELDS) {
      const tokens = src.tokens[field] as Record<string, unknown> | undefined
      if (!tokens) continue

      const mergedField = merged[field] as Record<string, unknown>
      const seenField = seen[field]!

      for (const [key, value] of Object.entries(tokens)) {
        if (key in seenField) {
          const existing = seenField[key]
          if (JSON.stringify(existing.value) !== JSON.stringify(value)) {
            // Conflict: rename second source's key
            const renamedKey = `${key}_${src.source}`
            mergedField[renamedKey] = value

            // Record conflict (only once per key)
            const existing_conflict = conflicts.find(c => c.field === field && c.key === key)
            if (existing_conflict) {
              existing_conflict.values.push({ source: src.source, value })
            } else {
              conflicts.push({
                field,
                key,
                values: [
                  { source: existing.source, value: existing.value },
                  { source: src.source, value },
                ],
              })
            }
          }
          // Same value from multiple sources → silent dedup (already in merged)
        } else {
          seenField[key] = { source: src.source, value }
          mergedField[key] = value
        }
      }
    }
  }

  // Merge non-field props from first source that has them
  for (const src of sources) {
    if (src.tokens.darkMode !== undefined && merged.darkMode === undefined) merged.darkMode = src.tokens.darkMode
    if (src.tokens.animations?.length && !merged.animations?.length) merged.animations = src.tokens.animations
    if (src.tokens.tailwindConfig && !merged.tailwindConfig) merged.tailwindConfig = src.tokens.tailwindConfig
    if (src.tokens.colorFormat && !merged.colorFormat) merged.colorFormat = src.tokens.colorFormat
  }

  // Clean empty objects
  for (const field of FIELDS) {
    if (Object.keys((merged[field] as Record<string, unknown>) ?? {}).length === 0) {
      delete merged[field]
    }
  }

  return { merged, conflicts, sources }
}
