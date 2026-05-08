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
    const lines: string[] = []

    if (Object.keys(ds.colors).length > 0) {
        for (const [key, value] of Object.entries(ds.colors)) {
            lines.push(`  --color-${key}: ${value};`)
        }
    }

    if (Object.keys(ds.fonts).length > 0) {
        for (const [key, value] of Object.entries(ds.fonts)) {
            lines.push(`  --font-${key}: ${String(value)};`)
        }
    }

    if (Object.keys(ds.spacing).length > 0) {
        for (const [key, value] of Object.entries(ds.spacing)) {
            lines.push(`  --spacing-${key}: ${String(value)};`)
        }
    }

    if (Object.keys(ds.radius).length > 0) {
        for (const [key, value] of Object.entries(ds.radius)) {
            lines.push(`  --radius-${key}: ${value};`)
        }
    }

    return `:root {\n${lines.join('\n')}\n}`
}

// ── W3C Design Tokens Export ─────────────────────────────────────────────────

/**
 * Generate a W3C Design Tokens format object (flat, dot-notation keys).
 */
export function exportToW3CJson(ds: DesignSystem): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(ds.colors)) {
        result[`color.${key}`] = { $value: value, $type: 'color' }
    }

    for (const [key, value] of Object.entries(ds.fonts)) {
        result[`font.${key}`] = { $value: String(value), $type: 'fontFamily' }
    }

    for (const [key, value] of Object.entries(ds.spacing)) {
        result[`spacing.${key}`] = { $value: String(value), $type: 'dimension' }
    }

    for (const [key, value] of Object.entries(ds.radius)) {
        result[`radius.${key}`] = { $value: value, $type: 'dimension' }
    }

    return result
}

// ── Tailwind Config Export ────────────────────────────────────────────────────

const FONT_KEYS = ['sans', 'mono', 'serif', 'heading'] as const

/**
 * Generate a Tailwind CSS config JS module string from a design system.
 */
export function exportToTailwind(ds: DesignSystem): string {
    // Colors — pass through as-is
    const colors: Record<string, string> = { ...ds.colors }

    // Font families — only allowed keys, always append fallback
    const fontFamily: Record<string, string[]> = {}
    for (const key of FONT_KEYS) {
        const val = ds.fonts[key]
        if (val !== undefined && val !== null && String(val).trim() !== '') {
            fontFamily[key] = [String(val), 'sans-serif']
        }
    }

    // Spacing
    const spacing: Record<string, string> = {}
    for (const [key, value] of Object.entries(ds.spacing)) {
        spacing[key] = String(value)
    }

    // Border radius
    const borderRadius: Record<string, string> = { ...ds.radius }

    const toSingleQuotes = (obj: Record<string, unknown>): string =>
        JSON.stringify(obj, null, 4).replace(/"/g, "'")

    const lines: string[] = [
        `/** @type {import('tailwindcss').Config} */`,
        `module.exports = {`,
        `  theme: {`,
        `    extend: {`,
    ]

    if (Object.keys(colors).length > 0) {
        lines.push(`      colors: ${toSingleQuotes(colors)},`)
    }

    if (Object.keys(fontFamily).length > 0) {
        lines.push(`      fontFamily: ${toSingleQuotes(fontFamily)},`)
    }

    if (Object.keys(spacing).length > 0) {
        lines.push(`      spacing: ${toSingleQuotes(spacing)},`)
    }

    if (Object.keys(borderRadius).length > 0) {
        lines.push(`      borderRadius: ${toSingleQuotes(borderRadius)},`)
    }

    lines.push(`    },`)
    lines.push(`  },`)
    lines.push(`}`)

    return lines.join('\n')
}
