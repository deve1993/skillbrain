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

    // Colors — pass through as-is
    const colorsOut: Record<string, string> = { ...colors }

    // Font families — only allowed keys, always append appropriate fallback
    const fontFamily: Record<string, string[]> = {}
    for (const k of FONT_KEYS) {
        const v = fonts[k]
        if (v !== undefined && v !== null && String(v).trim() !== '') {
            const fallback = k === 'mono' ? 'monospace' : k === 'serif' ? 'serif' : 'sans-serif'
            fontFamily[k] = [String(v), fallback]
        }
    }

    // Spacing
    const spacingOut: Record<string, string> = {}
    for (const [key, value] of Object.entries(spacing)) {
        spacingOut[key] = String(value)
    }

    // Border radius
    const borderRadius: Record<string, string> = { ...radius }

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

    lines.push(`    },`)
    lines.push(`  },`)
    lines.push(`}`)

    return lines.join('\n')
}
