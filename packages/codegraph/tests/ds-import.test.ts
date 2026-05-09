/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import { describe, it, expect } from 'vitest'
import { parseCssVars, parseJsonTokens, parseTailwindConfig } from '../src/mcp/ds-import.js'

describe('parseCssVars — new fields', () => {
  it('parses --shadow-* into shadows', () => {
    const result = parseCssVars(`
      :root {
        --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
        --shadow-glow: 0 0 20px violet;
      }
    `)
    expect(result.shadows?.['sm']).toBe('0 1px 2px rgba(0,0,0,0.05)')
    expect(result.shadows?.['glow']).toBe('0 0 20px violet')
  })

  it('parses --font-size-* into typography.scale', () => {
    const result = parseCssVars(`
      :root {
        --font-size-xs: 0.75rem;
        --font-size-base: 1rem;
      }
    `)
    const scale = (result.typography as any)?.scale ?? {}
    expect(scale['xs']?.size).toBe('0.75rem')
    expect(scale['base']?.size).toBe('1rem')
  })

  it('parses --line-height-* into typography.scale leading', () => {
    const result = parseCssVars(`
      :root {
        --line-height-base: 1.5rem;
      }
    `)
    const scale = (result.typography as any)?.scale ?? {}
    expect(scale['base']?.leading).toBe('1.5rem')
  })

  it('parses --font-weight-* into typography.weights', () => {
    const result = parseCssVars(`
      :root {
        --font-weight-bold: 700;
      }
    `)
    const weights = (result.typography as any)?.weights ?? {}
    expect(weights['bold']).toBe('700')
  })

  it('strips font-family- prefix — --font-family-sans → families.sans not families.family-sans', () => {
    const result = parseCssVars(':root { --font-family-sans: Inter; }')
    const families = (result.typography as any)?.families ?? {}
    expect(families['sans']).toBe('Inter')
    expect(families['family-sans']).toBeUndefined()
  })

  it('parses --color-brand-{shade} into palette.brand', () => {
    const result = parseCssVars(`
      :root {
        --color-brand-50: #faf5ff;
        --color-brand-900: #4c1d95;
      }
    `)
    expect(result.palette?.['brand']?.['50']).toBe('#faf5ff')
    expect(result.palette?.['brand']?.['900']).toBe('#4c1d95')
  })

  it('parses --color-text-* into semanticColors.text', () => {
    const result = parseCssVars(`
      :root {
        --color-text-primary: #0f172a;
        --color-text-muted: #64748b;
      }
    `)
    expect(result.semanticColors?.['text']?.['primary']).toBe('#0f172a')
    expect(result.semanticColors?.['text']?.['muted']).toBe('#64748b')
  })

  it('parses --color-bg-* into semanticColors.bg', () => {
    const result = parseCssVars(`
      :root {
        --color-bg-base: #ffffff;
      }
    `)
    expect(result.semanticColors?.['bg']?.['base']).toBe('#ffffff')
  })

  it('parses --color-border-* into semanticColors.border', () => {
    const result = parseCssVars(`
      :root {
        --color-border-default: #e2e8f0;
      }
    `)
    expect(result.semanticColors?.['border']?.['default']).toBe('#e2e8f0')
  })

  it('parses --color-feedback-* into semanticColors.feedback', () => {
    const result = parseCssVars(`
      :root {
        --color-feedback-error: #ef4444;
      }
    `)
    expect(result.semanticColors?.['feedback']?.['error']).toBe('#ef4444')
  })

  it('does not break with empty input', () => {
    expect(() => parseCssVars('')).not.toThrow()
    expect(parseCssVars('')).toEqual({})
  })
})

describe('parseJsonTokens — new fields', () => {
  it('maps shadow.* keys to shadows', () => {
    const result = parseJsonTokens({
      shadow: {
        sm: { $value: '0 1px 2px rgba(0,0,0,0.05)', $type: 'shadow' },
        glow: { $value: '0 0 20px violet', $type: 'shadow' },
      }
    })
    expect(result.shadows?.['sm']).toBe('0 1px 2px rgba(0,0,0,0.05)')
    expect(result.shadows?.['glow']).toBe('0 0 20px violet')
  })

  it('maps typography.families.* to typography.families', () => {
    const result = parseJsonTokens({
      typography: {
        families: {
          sans: { $value: 'Inter', $type: 'fontFamily' },
          mono: { $value: 'JetBrains Mono', $type: 'fontFamily' },
        }
      }
    })
    expect((result.typography as any)?.families?.['sans']).toBe('Inter')
    expect((result.typography as any)?.families?.['mono']).toBe('JetBrains Mono')
  })

  it('maps typography.scale.{step}.size to typography.scale', () => {
    const result = parseJsonTokens({
      typography: {
        scale: {
          base: {
            size:    { $value: '1rem',   $type: 'dimension' },
            leading: { $value: '1.5rem', $type: 'string' },
          }
        }
      }
    })
    expect((result.typography as any)?.scale?.['base']?.size).toBe('1rem')
    expect((result.typography as any)?.scale?.['base']?.leading).toBe('1.5rem')
  })

  it('maps color.brand.{shade} (numeric shade) to palette.brand', () => {
    const result = parseJsonTokens({
      color: {
        brand: {
          '50':  { $value: '#faf5ff', $type: 'color' },
          '900': { $value: '#4c1d95', $type: 'color' },
        }
      }
    })
    expect(result.palette?.['brand']?.['50']).toBe('#faf5ff')
    expect(result.palette?.['brand']?.['900']).toBe('#4c1d95')
  })

  it('maps color.text.* (semantic cat) to semanticColors.text', () => {
    const result = parseJsonTokens({
      color: {
        text: {
          primary: { $value: '#0f172a', $type: 'color' },
        }
      }
    })
    expect(result.semanticColors?.['text']?.['primary']).toBe('#0f172a')
  })

  it('maps color.bg.* to semanticColors.bg', () => {
    const result = parseJsonTokens({
      color: {
        bg: {
          base: { $value: '#ffffff', $type: 'color' },
        }
      }
    })
    expect(result.semanticColors?.['bg']?.['base']).toBe('#ffffff')
  })

  it('maps color.border.* to semanticColors.border', () => {
    const result = parseJsonTokens({
      color: {
        border: {
          default: { $value: '#e2e8f0', $type: 'color' },
        }
      }
    })
    expect(result.semanticColors?.['border']?.['default']).toBe('#e2e8f0')
  })

  it('maps color.feedback.* to semanticColors.feedback', () => {
    const result = parseJsonTokens({
      color: {
        feedback: {
          error: { $value: '#ef4444', $type: 'color' },
        }
      }
    })
    expect(result.semanticColors?.['feedback']?.['error']).toBe('#ef4444')
  })

  it('maps typography.weights.* to typography.weights', () => {
    const result = parseJsonTokens({
      typography: {
        weights: {
          bold: { $value: '700', $type: 'string' },
        }
      }
    })
    expect((result.typography as any)?.weights?.['bold']).toBe('700')
  })

  it('does not break with null or empty input', () => {
    expect(() => parseJsonTokens(null)).not.toThrow()
    expect(() => parseJsonTokens({})).not.toThrow()
    expect(parseJsonTokens({})).toEqual({})
  })
})

describe('parseTailwindConfig — new fields', () => {
  it('maps boxShadow block to shadows', () => {
    const result = parseTailwindConfig(`
      module.exports = {
        theme: {
          extend: {
            boxShadow: {
              'sm':   '0 1px 2px rgba(0,0,0,0.05)',
              'glow': '0 0 20px violet',
            }
          }
        }
      }
    `)
    expect(result.shadows?.['sm']).toBe('0 1px 2px rgba(0,0,0,0.05)')
    expect(result.shadows?.['glow']).toBe('0 0 20px violet')
  })

  it('maps fontFamily to both fonts and typography.families', () => {
    const result = parseTailwindConfig(`
      module.exports = {
        theme: {
          extend: {
            fontFamily: {
              'sans': ['Inter', 'sans-serif'],
              'mono': ['JetBrains Mono', 'monospace'],
            }
          }
        }
      }
    `)
    expect(result.fonts?.['sans']).toBe('Inter')
    expect((result.typography as any)?.families?.['sans']).toBe('Inter')
    expect((result.typography as any)?.families?.['mono']).toBe('JetBrains Mono')
  })

  it('does not break with empty input', () => {
    expect(() => parseTailwindConfig('')).not.toThrow()
    expect(parseTailwindConfig('')).toEqual({})
  })

  it('detects nested color groups as palette', () => {
    const result = parseTailwindConfig(`
      module.exports = {
        theme: {
          extend: {
            colors: {
              'brand': {
                '50':  '#faf5ff',
                '900': '#4c1d95',
              }
            }
          }
        }
      }
    `)
    expect(result.palette?.['brand']?.['50']).toBe('#faf5ff')
    expect(result.palette?.['brand']?.['900']).toBe('#4c1d95')
  })
})
