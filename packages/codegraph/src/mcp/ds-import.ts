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
  const shadows: Record<string, string> = {}
  const palette: Record<string, Record<string, string>> = {}
  const semanticColors: Record<string, Record<string, string>> = {}
  const typographyScale: Record<string, { size: string; leading?: string }> = {}
  const typographyFamilies: Record<string, string> = {}
  const typographyWeights: Record<string, string> = {}

  const re = /--([a-z][a-z0-9-]*)\s*:\s*([^;}{]+?)\s*;/gi
  let match: RegExpExecArray | null

  while ((match = re.exec(css)) !== null) {
    const [, rawName, rawValue] = match
    const name = rawName.toLowerCase()
    const value = rawValue.trim()

    // --shadow-* → shadows
    if (name.startsWith('shadow-')) {
      shadows[name.slice(7)] = value
      continue
    }

    // --font-size-* → typography.scale[step].size
    if (name.startsWith('font-size-')) {
      const step = name.slice(10)
      typographyScale[step] = { ...(typographyScale[step] ?? {}), size: value }
      continue
    }

    // --line-height-* → typography.scale[step].leading
    if (name.startsWith('line-height-')) {
      const step = name.slice(12)
      typographyScale[step] = { ...(typographyScale[step] ?? { size: '' }), leading: value }
      continue
    }

    // --font-weight-* → typography.weights
    if (name.startsWith('font-weight-')) {
      typographyWeights[name.slice(12)] = value
      continue
    }

    // --color-{group}-{numericShade} → palette.group[shade]
    const paletteMatch = name.match(/^color-([a-z][a-z0-9-]*)-(\d+)$/)
    if (paletteMatch) {
      const [, group, shade] = paletteMatch
      palette[group] ??= {}
      palette[group][shade] = value
      continue
    }

    // --color-{semanticCat}-{role} → semanticColors.cat[role]
    const semMatch = name.match(/^color-(text|bg|border|feedback)-(.+)$/)
    if (semMatch) {
      const [, cat, role] = semMatch
      semanticColors[cat] ??= {}
      semanticColors[cat][role] = value
      continue
    }

    // Legacy routing: colors, fonts, spacing, radius
    const isColorValue = /^(#|rgb|hsl|oklch)/.test(value)
    const isColorName = /color|bg|background|text|foreground|accent|primary|secondary|muted|border|surface/.test(name)
    const storageKey = name.startsWith('color-') ? name.slice(6) : name

    if (isColorValue || isColorName) {
      colors[storageKey] = value
    } else if (/^font-|family|typeface/.test(name)) {
      const fontKey = name.startsWith('font-family-')
        ? name.slice(12)
        : name.startsWith('font-') ? name.slice(5) : name
      fonts[fontKey] = value
      typographyFamilies[fontKey] = value
    } else if (/spacing|space|gap/.test(name)) {
      spacing[storageKey] = value
    } else if (/radius|rounded|corner/.test(name)) {
      radius[storageKey] = value
    }
  }

  const typography: Record<string, unknown> = {}
  if (Object.keys(typographyFamilies).length) typography.families = typographyFamilies
  if (Object.keys(typographyScale).length) typography.scale = typographyScale
  if (Object.keys(typographyWeights).length) typography.weights = typographyWeights

  const result: Partial<DesignSystemInput> = {}
  if (Object.keys(colors).length) result.colors = colors
  if (Object.keys(fonts).length) result.fonts = fonts
  if (Object.keys(spacing).length) result.spacing = spacing
  if (Object.keys(radius).length) result.radius = radius
  if (Object.keys(shadows).length) result.shadows = shadows
  if (Object.keys(palette).length) result.palette = palette
  if (Object.keys(semanticColors).length) result.semanticColors = semanticColors
  if (Object.keys(typography).length) result.typography = typography
  return result
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
  const shadows: Record<string, string> = {}
  const palette: Record<string, Record<string, string>> = {}
  const semanticColors: Record<string, Record<string, string>> = {}
  const typographyFamilies: Record<string, string> = {}
  const typographyScale: Record<string, { size: string; leading?: string }> = {}

  const typographyWeights: Record<string, string> = {}
  const SEMANTIC_CATS = new Set(['text', 'bg', 'border', 'feedback'])

  function walk(node: unknown, path: string[]): void {
    if (node === null || typeof node !== 'object') return
    const obj = node as Record<string, unknown>

    if ('$value' in obj) {
      const value = String(obj.$value)
      const [p0, p1, p2, p3] = path

      // shadow.{name}
      if (p0 === 'shadow' && path.length === 2) {
        shadows[p1] = value; return
      }

      // typography.families.{key}
      if (p0 === 'typography' && p1 === 'families' && path.length === 3) {
        typographyFamilies[p2] = value; return
      }

      // typography.weights.{key}
      if (p0 === 'typography' && p1 === 'weights' && path.length === 3) {
        typographyWeights[p2] = value; return
      }

      // typography.scale.{step}.size|leading
      if (p0 === 'typography' && p1 === 'scale' && path.length === 4) {
        typographyScale[p2] ??= { size: '' }
        if (p3 === 'size')    typographyScale[p2].size = value
        if (p3 === 'leading') typographyScale[p2].leading = value
        return
      }

      // color.{group}.{numericShade} → palette
      if (p0 === 'color' && path.length === 3 && /^\d+$/.test(p2)) {
        palette[p1] ??= {}
        palette[p1][p2] = value; return
      }

      // color.{semanticCat}.{role} → semanticColors
      if (p0 === 'color' && path.length === 3 && SEMANTIC_CATS.has(p1)) {
        semanticColors[p1] ??= {}
        semanticColors[p1][p2] = value; return
      }

      // fallback to legacy categorizer
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

  const typography: Record<string, unknown> = {}
  if (Object.keys(typographyFamilies).length) typography.families = typographyFamilies
  if (Object.keys(typographyScale).length) typography.scale = typographyScale
  if (Object.keys(typographyWeights).length) typography.weights = typographyWeights

  const result: Partial<DesignSystemInput> = {}
  if (Object.keys(colors).length) result.colors = colors
  if (Object.keys(fonts).length) result.fonts = fonts
  if (Object.keys(spacing).length) result.spacing = spacing
  if (Object.keys(radius).length) result.radius = radius
  if (Object.keys(shadows).length) result.shadows = shadows
  if (Object.keys(palette).length) result.palette = palette
  if (Object.keys(semanticColors).length) result.semanticColors = semanticColors
  if (Object.keys(typography).length) result.typography = typography
  return result
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

  // Colors (flat keys only — nested group objects are handled below as palette)
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

  // boxShadow → shadows
  const shadows: Record<string, string> = {}
  const shadowBlock = extractBlock(configText, 'boxShadow')
  if (shadowBlock) {
    for (const [k, v] of extractPairs(shadowBlock)) {
      shadows[k] = v
    }
  }

  // fontFamily also populates typography.families (already parsed into fonts above)
  const typographyFamilies: Record<string, string> = { ...fonts }

  // Detect palette: nested color group objects (e.g. brand: { '50': '...' })
  const palette: Record<string, Record<string, string>> = {}
  if (colorsBlock) {
    // NOTE: [^}]+ is not brace-aware — does not support nested objects inside color groups (e.g. DEFAULT: {...})
    const nestedRe = /['"]([^'"]+)['"]\s*:\s*\{([^}]+)\}/g
    let nm: RegExpExecArray | null
    while ((nm = nestedRe.exec(colorsBlock)) !== null) {
      const groupName = nm[1]
      const innerBlock = nm[2]
      const shades: Record<string, string> = {}
      for (const [k, v] of extractPairs(innerBlock)) {
        shades[k] = v
      }
      if (Object.keys(shades).length > 0) {
        palette[groupName] = shades
        // Remove numeric shade keys that leaked from nested blocks into flat colors
        for (const shade of Object.keys(shades)) delete colors[shade]
      }
    }
  }

  const typography: Record<string, unknown> = {}
  if (Object.keys(typographyFamilies).length) typography.families = typographyFamilies

  const result: Partial<DesignSystemInput> = {}
  if (Object.keys(colors).length) result.colors = colors
  if (Object.keys(fonts).length) result.fonts = fonts
  if (Object.keys(spacing).length) result.spacing = spacing
  if (Object.keys(radius).length) result.radius = radius
  if (Object.keys(shadows).length) result.shadows = shadows
  if (Object.keys(palette).length) result.palette = palette
  if (Object.keys(typography).length) result.typography = typography
  return result
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
