import { describe, it, expect } from 'vitest'
import { exportToCss, exportToW3CJson, exportToTailwind } from '../src/mcp/ds-export.js'
import type { ComponentsDesignSystem as DS } from '@skillbrain/storage'

const baseDs: DS = {
  id: 'DS-test', project: 'test', colors: {}, fonts: {}, spacing: {}, radius: {},
  animations: [], darkMode: false, colorFormat: 'hex',
  createdAt: '2026-01-01', updatedAt: '2026-01-01',
}

const fullDs: DS = {
  ...baseDs,
  palette: {
    brand: { '50': '#faf5ff', '500': '#8b5cf6', '900': '#4c1d95' },
    neutral: { '50': '#f8fafc', '900': '#0f172a' },
  },
  semanticColors: {
    text: { primary: '#0f172a', muted: '#64748b' },
    bg: { base: '#ffffff', surface: '#f8fafc' },
  },
  shadows: { sm: '0 1px 2px rgba(0,0,0,0.05)', glow: '0 0 20px rgba(139,92,246,0.4)' },
  typography: {
    families: { sans: 'Inter', mono: 'JetBrains Mono' },
    scale: {
      xs: { size: '0.75rem', leading: '1rem' },
      base: { size: '1rem', leading: '1.5rem' },
    },
    weights: { normal: '400', bold: '700' },
  },
  effects: {
    aurora: { preset: 'soft', customCss: '' },
    glow: { preset: 'purple', customCss: '--glow: 0 0 30px violet' },
  },
  components: {
    button: { radius: '0.375rem', paddingX: '1rem', fontWeight: '600' },
  },
  assets: { logoUrl: 'https://example.com/logo.svg', iconLibrary: 'lucide' },
}

describe('exportToCss', () => {
  it('emits palette shade variables', () => {
    const css = exportToCss(fullDs)
    expect(css).toContain('--color-brand-50: #faf5ff;')
    expect(css).toContain('--color-brand-500: #8b5cf6;')
    expect(css).toContain('--color-neutral-900: #0f172a;')
  })

  it('emits semantic color variables', () => {
    const css = exportToCss(fullDs)
    expect(css).toContain('--color-text-primary: #0f172a;')
    expect(css).toContain('--color-bg-surface: #f8fafc;')
  })

  it('emits shadow variables', () => {
    const css = exportToCss(fullDs)
    expect(css).toContain('--shadow-sm: 0 1px 2px rgba(0,0,0,0.05);')
    expect(css).toContain('--shadow-glow: 0 0 20px rgba(139,92,246,0.4);')
  })

  it('emits typography family variables', () => {
    const css = exportToCss(fullDs)
    expect(css).toContain('--font-sans: Inter;')
    expect(css).toContain('--font-mono: JetBrains Mono;')
  })

  it('emits typography scale variables', () => {
    const css = exportToCss(fullDs)
    expect(css).toContain('--font-size-xs: 0.75rem;')
    expect(css).toContain('--font-size-base: 1rem;')
  })

  it('emits effect customCss when non-empty', () => {
    const css = exportToCss(fullDs)
    expect(css).toContain('--glow: 0 0 30px violet')
  })

  it('skips empty effects customCss', () => {
    const css = exportToCss(fullDs)
    // aurora has empty customCss — no aurora-specific line should appear
    expect(css).not.toContain('effect-aurora')
  })

  it('does not break when new fields are absent', () => {
    expect(() => exportToCss(baseDs)).not.toThrow()
  })
})

describe('exportToW3CJson', () => {
  it('emits palette tokens', () => {
    const json = exportToW3CJson(fullDs)
    expect(json['color.brand.50']).toEqual({ $value: '#faf5ff', $type: 'color' })
    expect(json['color.brand.900']).toEqual({ $value: '#4c1d95', $type: 'color' })
  })

  it('emits semantic color tokens', () => {
    const json = exportToW3CJson(fullDs)
    expect(json['color.text.primary']).toEqual({ $value: '#0f172a', $type: 'color' })
  })

  it('emits shadow tokens', () => {
    const json = exportToW3CJson(fullDs)
    expect(json['shadow.sm']).toEqual({ $value: '0 1px 2px rgba(0,0,0,0.05)', $type: 'shadow' })
  })

  it('emits typography family tokens', () => {
    const json = exportToW3CJson(fullDs)
    expect(json['typography.families.sans']).toEqual({ $value: 'Inter', $type: 'fontFamily' })
  })

  it('emits typography scale tokens', () => {
    const json = exportToW3CJson(fullDs)
    expect(json['typography.scale.base.size']).toEqual({ $value: '1rem', $type: 'dimension' })
  })

  it('emits effect preset tokens', () => {
    const json = exportToW3CJson(fullDs)
    expect(json['effect.aurora.preset']).toEqual({ $value: 'soft', $type: 'string' })
  })

  it('emits asset tokens', () => {
    const json = exportToW3CJson(fullDs)
    expect(json['asset.logoUrl']).toEqual({ $value: 'https://example.com/logo.svg', $type: 'string' })
    expect(json['asset.iconLibrary']).toEqual({ $value: 'lucide', $type: 'string' })
  })
})

describe('exportToTailwind', () => {
  it('emits palette colors as nested brand/neutral objects', () => {
    const tw = exportToTailwind(fullDs)
    expect(tw).toContain('"brand"')
    expect(tw).toContain('"50"')
    expect(tw).toContain('#faf5ff')
  })

  it('emits boxShadow from shadows', () => {
    const tw = exportToTailwind(fullDs)
    expect(tw).toContain('boxShadow')
    expect(tw).toContain('"sm"')
    expect(tw).toContain('0 1px 2px rgba(0,0,0,0.05)')
  })

  it('emits fontFamily from typography.families', () => {
    const tw = exportToTailwind(fullDs)
    expect(tw).toContain('fontFamily')
    expect(tw).toContain('"sans"')
    expect(tw).toContain('Inter')
  })

  it('emits fontSize from typography.scale', () => {
    const tw = exportToTailwind(fullDs)
    expect(tw).toContain('fontSize')
    expect(tw).toContain('"xs"')
    expect(tw).toContain('0.75rem')
  })

  it('does not break when new fields are absent', () => {
    expect(() => exportToTailwind(baseDs)).not.toThrow()
  })
})
