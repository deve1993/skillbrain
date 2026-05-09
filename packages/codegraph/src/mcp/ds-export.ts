/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import type { ComponentsDesignSystem as DesignSystem } from '@skillbrain/storage'

// ── CSS Export ───────────────────────────────────────────────────────────────

/**
 * Generate a CSS `:root {}` block with custom properties from a design system.
 */
export function exportToCss(ds: DesignSystem): string {
    const colors = ds.colors ?? {}
    const fonts = ds.fonts ?? {}
    const spacing = ds.spacing ?? {}
    const radius = ds.radius ?? {}

    const lines: string[] = []

    if (Object.keys(colors).length > 0) {
        for (const [key, value] of Object.entries(colors)) {
            lines.push(`  --color-${key}: ${value};`)
        }
    }

    if (Object.keys(fonts).length > 0) {
        for (const [key, value] of Object.entries(fonts)) {
            lines.push(`  --font-${key}: ${String(value)};`)
        }
    }

    if (Object.keys(spacing).length > 0) {
        for (const [key, value] of Object.entries(spacing)) {
            lines.push(`  --spacing-${key}: ${String(value)};`)
        }
    }

    if (Object.keys(radius).length > 0) {
        for (const [key, value] of Object.entries(radius)) {
            lines.push(`  --radius-${key}: ${value};`)
        }
    }

    // palette: --color-{group}-{shade}
    const palette = ds.palette ?? {}
    for (const [group, shades] of Object.entries(palette)) {
        if (shades && typeof shades === 'object') {
            for (const [shade, value] of Object.entries(shades as Record<string, string>)) {
                lines.push(`  --color-${group}-${shade}: ${value};`)
            }
        }
    }

    // semanticColors: --color-{cat}-{role}
    const semanticColors = ds.semanticColors ?? {}
    for (const [cat, roles] of Object.entries(semanticColors)) {
        if (roles && typeof roles === 'object') {
            for (const [role, value] of Object.entries(roles as Record<string, string>)) {
                lines.push(`  --color-${cat}-${role}: ${value};`)
            }
        }
    }

    // shadows: --shadow-{name}
    const shadows = ds.shadows ?? {}
    for (const [name, value] of Object.entries(shadows)) {
        lines.push(`  --shadow-${name}: ${value};`)
    }

    // typography families, scale sizes, weights
    const typography = (ds.typography ?? {}) as Record<string, unknown>
    const typeFamilies = (typography.families ?? {}) as Record<string, string>
    for (const [key, value] of Object.entries(typeFamilies)) {
        lines.push(`  --font-${key}: ${value};`)
    }
    const typeScale = (typography.scale ?? {}) as Record<string, { size: string; leading?: string }>
    for (const [step, vals] of Object.entries(typeScale)) {
        lines.push(`  --font-size-${step}: ${vals.size};`)
        if (vals.leading) lines.push(`  --line-height-${step}: ${vals.leading};`)
    }
    const typeWeights = (typography.weights ?? {}) as Record<string, string>
    for (const [key, value] of Object.entries(typeWeights)) {
        lines.push(`  --font-weight-${key}: ${value};`)
    }

    // effects: only emit customCss if non-empty
    const effects = (ds.effects ?? {}) as Record<string, { customCss?: string }>
    for (const effect of Object.values(effects)) {
        if (effect?.customCss?.trim()) {
            lines.push(`  ${effect.customCss.trim()}`)
        }
    }

    return `:root {\n${lines.join('\n')}\n}`
}

// ── W3C Design Tokens Export ─────────────────────────────────────────────────

/**
 * Generate a W3C Design Tokens format object (flat, dot-notation keys).
 */
export function exportToW3CJson(ds: DesignSystem): Record<string, unknown> {
    const colors = ds.colors ?? {}
    const fonts = ds.fonts ?? {}
    const spacing = ds.spacing ?? {}
    const radius = ds.radius ?? {}

    const result: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(colors)) {
        result[`color.${key}`] = { $value: value, $type: 'color' }
    }

    for (const [key, value] of Object.entries(fonts)) {
        result[`font.${key}`] = { $value: String(value), $type: 'fontFamily' }
    }

    for (const [key, value] of Object.entries(spacing)) {
        result[`spacing.${key}`] = { $value: String(value), $type: 'dimension' }
    }

    for (const [key, value] of Object.entries(radius)) {
        result[`radius.${key}`] = { $value: value, $type: 'dimension' }
    }

    // palette
    for (const [group, shades] of Object.entries(ds.palette ?? {})) {
        for (const [shade, value] of Object.entries((shades ?? {}) as Record<string, string>)) {
            result[`color.${group}.${shade}`] = { $value: value, $type: 'color' }
        }
    }

    // semanticColors
    for (const [cat, roles] of Object.entries(ds.semanticColors ?? {})) {
        for (const [role, value] of Object.entries(roles as Record<string, string>)) {
            result[`color.${cat}.${role}`] = { $value: value, $type: 'color' }
        }
    }

    // shadows
    for (const [name, value] of Object.entries(ds.shadows ?? {})) {
        result[`shadow.${name}`] = { $value: value, $type: 'shadow' }
    }

    // typography
    const typography = (ds.typography ?? {}) as Record<string, unknown>
    const typeFamilies = (typography.families ?? {}) as Record<string, string>
    for (const [key, value] of Object.entries(typeFamilies)) {
        result[`typography.families.${key}`] = { $value: value, $type: 'fontFamily' }
    }
    const typeScale = (typography.scale ?? {}) as Record<string, { size: string; leading?: string }>
    for (const [step, vals] of Object.entries(typeScale)) {
        result[`typography.scale.${step}.size`] = { $value: vals.size, $type: 'dimension' }
        if (vals.leading) {
            result[`typography.scale.${step}.leading`] = { $value: vals.leading, $type: 'string' }
        }
    }

    // effects
    const effects = (ds.effects ?? {}) as Record<string, { preset?: string; customCss?: string }>
    for (const [name, effect] of Object.entries(effects)) {
        if (effect?.preset) {
            result[`effect.${name}.preset`] = { $value: effect.preset, $type: 'string' }
        }
    }

    // assets
    const assets = (ds.assets ?? {}) as Record<string, unknown>
    if (typeof assets.logoUrl === 'string') {
        result['asset.logoUrl'] = { $value: assets.logoUrl, $type: 'string' }
    }
    if (typeof assets.iconLibrary === 'string') {
        result['asset.iconLibrary'] = { $value: assets.iconLibrary, $type: 'string' }
    }
    if (typeof assets.logoWordmark === 'string') {
        result['asset.logoWordmark'] = { $value: assets.logoWordmark, $type: 'string' }
    }

    return result
}

// ── Tailwind Config Export ────────────────────────────────────────────────────

const FONT_KEYS = ['sans', 'mono', 'serif', 'heading'] as const

/**
 * Generate a Tailwind CSS config JS module string from a design system.
 */
export function exportToTailwind(ds: DesignSystem): string {
    const colors = ds.colors ?? {}
    const fonts = ds.fonts ?? {}
    const spacing = ds.spacing ?? {}
    const radius = ds.radius ?? {}

    // Colors: flat colors + palette groups merged (palette wins on key collision — palette.brand {} replaces a flat colors.brand string)
    const colorsOut: Record<string, unknown> = { ...colors, ...(ds.palette ?? {}) }

    // Font families: legacy fonts.* keys + typography.families
    const fontFamily: Record<string, string[]> = {}
    for (const k of FONT_KEYS) {
        const v = fonts[k]
        if (v !== undefined && v !== null && String(v).trim() !== '') {
            const fallback = k === 'mono' ? 'monospace' : k === 'serif' ? 'serif' : 'sans-serif'
            fontFamily[k] = [String(v), fallback]
        }
    }
    const typography = (ds.typography ?? {}) as Record<string, unknown>
    const typeFamilies = (typography.families ?? {}) as Record<string, string>
    for (const [k, v] of Object.entries(typeFamilies)) {
        if (!fontFamily[k]) {
            const fallback = k === 'mono' ? 'monospace' : k === 'serif' ? 'serif' : 'sans-serif'
            fontFamily[k] = [v, fallback]
        }
    }

    // Spacing
    const spacingOut: Record<string, string> = {}
    for (const [key, value] of Object.entries(spacing)) {
        spacingOut[key] = String(value)
    }

    // Border radius
    const borderRadius: Record<string, string> = { ...radius }

    // Font size from typography.scale
    const typeScale = (typography.scale ?? {}) as Record<string, { size: string; leading?: string }>
    const fontSizeOut: Record<string, [string, { lineHeight: string }]> = {}
    for (const [step, vals] of Object.entries(typeScale)) {
        fontSizeOut[step] = [vals.size, { lineHeight: vals.leading ?? '1.5' }]
    }

    // Box shadows
    const shadows = ds.shadows ?? {}

    const lines: string[] = [
        `/** @type {import('tailwindcss').Config} */`,
        `module.exports = {`,
        `  theme: {`,
        `    extend: {`,
    ]

    if (Object.keys(colorsOut).length > 0) {
        lines.push(`      colors: ${JSON.stringify(colorsOut, null, 4)},`)
    }

    if (Object.keys(fontFamily).length > 0) {
        lines.push(`      fontFamily: ${JSON.stringify(fontFamily, null, 4)},`)
    }

    if (Object.keys(spacingOut).length > 0) {
        lines.push(`      spacing: ${JSON.stringify(spacingOut, null, 4)},`)
    }

    if (Object.keys(borderRadius).length > 0) {
        lines.push(`      borderRadius: ${JSON.stringify(borderRadius, null, 4)},`)
    }

    if (Object.keys(fontSizeOut).length > 0) {
        lines.push(`      fontSize: ${JSON.stringify(fontSizeOut, null, 4)},`)
    }

    if (Object.keys(shadows).length > 0) {
        lines.push(`      boxShadow: ${JSON.stringify(shadows, null, 4)},`)
    }

    lines.push(`    },`)
    lines.push(`  },`)
    lines.push(`}`)

    return lines.join('\n')
}
