/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import type { DesignSystemInput } from '@skillbrain/storage'

// ── Shared categorizer ────────────────────────────────────────────────────────

function categorize(
  key: string,
  value: string,
  colors: Record<string, string>,
  fonts: Record<string, string>,
  spacing: Record<string, string>,
  radius: Record<string, string>,
): void {
  const k = key.toLowerCase()
  const leafKey = key.split('.').pop() ?? key

  if (/color|bg|background|text|foreground|accent|primary|secondary|muted|border|surface/.test(k)) {
    colors[leafKey] = value
  } else if (/font|family|typeface|typography/.test(k)) {
    fonts[leafKey] = value
  } else if (/spacing|space|gap|size|padding/.test(k)) {
    spacing[leafKey] = value
  } else if (/radius|rounded|corner/.test(k)) {
    radius[leafKey] = value
  }
}

// ── Function 1: parseCssVars ──────────────────────────────────────────────────

/**
 * Parse CSS custom properties (e.g., from a :root block) into DS fields.
 */
export function parseCssVars(css: string): Partial<DesignSystemInput> {
  const colors: Record<string, string> = {}
  const fonts: Record<string, string> = {}
  const spacing: Record<string, string> = {}
  const radius: Record<string, string> = {}

  const re = /--([a-z][a-z0-9-]*)\s*:\s*([^;}{]+?)\s*;/gi
  let match: RegExpExecArray | null

  while ((match = re.exec(css)) !== null) {
    const [, rawName, rawValue] = match
    const name = rawName.toLowerCase()
    const value = rawValue.trim()

    const isColorValue = /^(#|rgb|hsl|oklch)/.test(value)
    const isColorName = /color|bg|background|text|foreground|accent|primary|secondary|muted|border|surface/.test(name)

    // Strip leading "color-" prefix from key for cleaner storage
    const storageKey = name.startsWith('color-') ? name.slice(6) : name

    if (isColorValue || isColorName) {
      colors[storageKey] = value
    } else if (/font|family|typeface/.test(name)) {
      fonts[storageKey] = value
    } else if (/spacing|space|gap/.test(name)) {
      spacing[storageKey] = value
    } else if (/radius|rounded|corner/.test(name)) {
      radius[storageKey] = value
    }
  }

  return { colors, fonts, spacing, radius }
}

// ── Function 2: parseJsonTokens ───────────────────────────────────────────────

/**
 * Parse W3C Design Tokens JSON or Style Dictionary flat JSON into DS fields.
 */
export function parseJsonTokens(raw: unknown): Partial<DesignSystemInput> {
  const colors: Record<string, string> = {}
  const fonts: Record<string, string> = {}
  const spacing: Record<string, string> = {}
  const radius: Record<string, string> = {}

  function walk(node: unknown, path: string[]): void {
    if (node === null || typeof node !== 'object') return

    const obj = node as Record<string, unknown>

    // W3C Design Token leaf: has $value key
    if ('$value' in obj) {
      const value = String(obj.$value)
      categorize(path.join('.'), value, colors, fonts, spacing, radius)
      return
    }

    for (const [key, child] of Object.entries(obj)) {
      if (key.startsWith('$')) continue // skip $type, $description, etc.

      if (typeof child === 'string') {
        // Flat Style Dictionary leaf
        categorize([...path, key].join('.'), child, colors, fonts, spacing, radius)
      } else if (child !== null && typeof child === 'object') {
        walk(child, [...path, key])
      }
    }
  }

  walk(raw, [])

  return { colors, fonts, spacing, radius }
}

// ── Function 3: parseTailwindConfig ──────────────────────────────────────────

/**
 * Parse a Tailwind config JS string (regex only — no eval) into DS fields.
 */
export function parseTailwindConfig(configText: string): Partial<DesignSystemInput> {
  const colors: Record<string, string> = {}
  const fonts: Record<string, string> = {}
  const spacing: Record<string, string> = {}
  const radius: Record<string, string> = {}

  /** Extract the full brace-balanced block for a given key */
  function extractBlock(text: string, key: string): string | null {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const startRe = new RegExp(`${escaped}\\s*:\\s*\\{`)
    const match = startRe.exec(text)
    if (!match) return null

    let depth = 0
    let start = -1
    for (let i = match.index + match[0].length - 1; i < text.length; i++) {
      if (text[i] === '{') {
        if (depth === 0) start = i
        depth++
      } else if (text[i] === '}') {
        depth--
        if (depth === 0) {
          return text.slice(start + 1, i)
        }
      }
    }
    return null
  }

  /** Extract key/value string pairs from a block */
  function extractPairs(block: string): Array<[string, string]> {
    const pairs: Array<[string, string]> = []
    const re = /['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g
    let m: RegExpExecArray | null
    while ((m = re.exec(block)) !== null) {
      pairs.push([m[1], m[2]])
    }
    return pairs
  }

  // Colors
  const colorsBlock = extractBlock(configText, 'colors')
  if (colorsBlock) {
    for (const [k, v] of extractPairs(colorsBlock)) {
      colors[k] = v
    }
  }

  // Font families — pick first element from array value
  const fontBlock = extractBlock(configText, 'fontFamily')
  if (fontBlock) {
    const re = /['"]([^'"]+)['"]\s*:\s*\[\s*['"]([^'"]+)['"]/g
    let m: RegExpExecArray | null
    while ((m = re.exec(fontBlock)) !== null) {
      fonts[m[1]] = m[2]
    }
  }

  // Spacing
  const spacingBlock = extractBlock(configText, 'spacing')
  if (spacingBlock) {
    for (const [k, v] of extractPairs(spacingBlock)) {
      spacing[k] = v
    }
  }

  // Border radius
  const radiusBlock = extractBlock(configText, 'borderRadius')
  if (radiusBlock) {
    for (const [k, v] of extractPairs(radiusBlock)) {
      radius[k] = v
    }
  }

  return { colors, fonts, spacing, radius }
}

// ── Function 4: parseFigmaVariables ──────────────────────────────────────────

interface FigmaColorValue {
  r: number
  g: number
  b: number
  a: number
}

interface FigmaVariable {
  name: string
  resolvedType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN'
  valuesByMode: Record<string, unknown>
}

interface FigmaVariablesResponse {
  variables?: Record<string, FigmaVariable>
  meta?: {
    variables?: Record<string, FigmaVariable>
  }
}

function toHex(color: FigmaColorValue): string {
  const r = Math.round(color.r * 255).toString(16).padStart(2, '0')
  const g = Math.round(color.g * 255).toString(16).padStart(2, '0')
  const b = Math.round(color.b * 255).toString(16).padStart(2, '0')
  if (color.a < 1) {
    const a = Math.round(color.a * 255).toString(16).padStart(2, '0')
    return `#${r}${g}${b}${a}`
  }
  return `#${r}${g}${b}`
}

/**
 * Parse Figma REST API response from GET /v1/files/:key/variables/local into DS fields.
 */
export function parseFigmaVariables(raw: unknown): Partial<DesignSystemInput> {
  const colors: Record<string, string> = {}
  const fonts: Record<string, string> = {}
  const spacing: Record<string, string> = {}
  const radius: Record<string, string> = {}

  const response = raw as FigmaVariablesResponse
  const variablesMap = response.variables ?? response.meta?.variables

  if (!variablesMap) return {}

  for (const variable of Object.values(variablesMap)) {
    const name = variable.name.replace(/\//g, '.')
    const modeValues = Object.values(variable.valuesByMode)
    if (modeValues.length === 0) continue
    const firstValue = modeValues[0]

    if (variable.resolvedType === 'COLOR') {
      const color = firstValue as FigmaColorValue
      if (
        color !== null &&
        typeof color === 'object' &&
        typeof color.r === 'number' &&
        typeof color.g === 'number' &&
        typeof color.b === 'number'
      ) {
        const hex = toHex({ r: color.r, g: color.g, b: color.b, a: color.a ?? 1 })
        categorize(name, hex, colors, fonts, spacing, radius)
      }
    } else if (variable.resolvedType === 'FLOAT' && typeof firstValue === 'number') {
      categorize(name, `${firstValue}px`, colors, fonts, spacing, radius)
    } else if (variable.resolvedType === 'STRING' && typeof firstValue === 'string') {
      categorize(name, firstValue, colors, fonts, spacing, radius)
    }
  }

  return { colors, fonts, spacing, radius }
}
