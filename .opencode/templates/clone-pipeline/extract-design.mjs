#!/usr/bin/env node

/**
 * extract-design.mjs v2.0 — Playwright-based Design Token Extractor
 *
 * Extracts design tokens, per-section style maps, hover/focus states,
 * dark mode variables, assets, and responsive screenshots from a live URL.
 * Used as part of the Pixarts website cloning pipeline.
 *
 * Usage:
 *   node extract-design.mjs <url> [--output <dir>] [--full]
 *
 * Output:
 *   <output>/
 *   ├── design-tokens.json        <- Global tokens (colors, typography, spacing, etc.)
 *   ├── section-styles.json       <- Per-section style map (section -> tokens used)
 *   ├── interactive-states.json   <- Hover/focus/active states for interactive elements
 *   ├── structure.json            <- Deep page structure map (depth 6)
 *   ├── screenshots/
 *   │   ├── mobile-375.png
 *   │   ├── tablet-768.png
 *   │   ├── desktop-1024.png
 *   │   └── wide-1440.png
 *   └── assets/
 *       ├── images/
 *       ├── svgs/
 *       └── fonts/
 */

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'fs/promises';
import { join, basename, extname } from 'path';
import { existsSync } from 'fs';

// --- CLI Args ---
const args = process.argv.slice(2);
const url = args.find(a => !a.startsWith('--'));
const outputDir = args.includes('--output')
  ? args[args.indexOf('--output') + 1]
  : './clone-output';
const fullMode = args.includes('--full');

if (!url) {
  console.error('Usage: node extract-design.mjs <url> [--output <dir>] [--full]');
  process.exit(1);
}

// --- Helpers ---
async function ensureDir(dir) {
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
}

function uniqueValues(arr) {
  return [...new Set(arr)].filter(Boolean).sort();
}

function rgbToHex(rgb) {
  if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return null;
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return rgb;
  const [, r, g, b] = match;
  return '#' + [r, g, b].map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
}

// --- Auto-scroll helper ---
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 400;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 100);
      // Safety timeout
      setTimeout(() => {
        clearInterval(timer);
        window.scrollTo(0, 0);
        resolve();
      }, 15000);
    });
  });
}

// --- Main ---
async function main() {
  console.log(`\n🔍 extract-design v2.0 — Extracting from: ${url}`);
  console.log(`📁 Output directory: ${outputDir}\n`);

  await ensureDir(outputDir);
  await ensureDir(join(outputDir, 'screenshots'));
  await ensureDir(join(outputDir, 'assets', 'images'));
  await ensureDir(join(outputDir, 'assets', 'svgs'));
  await ensureDir(join(outputDir, 'assets', 'fonts'));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  // Track font requests
  const fontUrls = [];
  page.on('response', async (response) => {
    const responseUrl = response.url();
    const ct = response.headers()['content-type'] || '';
    if (ct.includes('font') || /\.(woff2?|ttf|otf|eot)(\?|$)/i.test(responseUrl)) {
      fontUrls.push(responseUrl);
    }
  });

  console.log('⏳ Loading page...');
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);

  // Scroll to trigger lazy-loaded content
  console.log('📜 Scrolling to trigger lazy content...');
  await autoScroll(page);
  await page.waitForTimeout(1000);

  // --- 1. RESPONSIVE SCREENSHOTS ---
  console.log('📸 Taking responsive screenshots...');
  const viewports = [
    { name: 'mobile-375', width: 375, height: 812 },
    { name: 'tablet-768', width: 768, height: 1024 },
    { name: 'desktop-1024', width: 1024, height: 768 },
    { name: 'wide-1440', width: 1440, height: 900 },
  ];

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: join(outputDir, 'screenshots', `${vp.name}.png`),
      fullPage: true,
    });
    console.log(`  ✅ ${vp.name}.png`);
  }

  // Reset to desktop for extraction
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(500);

  // --- 2. EXTRACT GLOBAL DESIGN TOKENS ---
  console.log('🎨 Extracting global design tokens...');

  const tokens = await page.evaluate(() => {
    const allElements = document.querySelectorAll('*');
    const colors = { backgrounds: [], texts: [], borders: [] };
    const typography = { families: [], sizes: [], weights: [], lineHeights: [], letterSpacings: [] };
    const spacing = { paddings: [], margins: [], gaps: [] };
    const borders = { radii: [], widths: [] };
    const shadows = [];
    const gradients = [];
    const transitions = [];
    const animations = [];
    const zIndices = [];
    // Visual effects collections
    const filters = [];
    const backdropFilters = [];
    const transforms = [];
    const clipPaths = [];
    const maskImages = [];
    const mixBlendModes = [];
    const perspectives = [];
    const objectFits = [];
    const aspectRatios = [];
    const scrollSnaps = [];
    const cursors = [];
    const gradientTexts = []; // -webkit-background-clip: text
    const textStrokes = [];

    for (const el of allElements) {
      const style = window.getComputedStyle(el);

      // Colors
      const bg = style.backgroundColor;
      const color = style.color;
      const borderColor = style.borderColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') colors.backgrounds.push(bg);
      if (color) colors.texts.push(color);
      if (borderColor && borderColor !== 'rgb(0, 0, 0)' && borderColor !== 'rgba(0, 0, 0, 0)') colors.borders.push(borderColor);

      // Typography
      typography.families.push(style.fontFamily);
      typography.sizes.push(style.fontSize);
      typography.weights.push(style.fontWeight);
      typography.lineHeights.push(style.lineHeight);
      typography.letterSpacings.push(style.letterSpacing);

      // Spacing
      for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
        const pad = style[`padding${side}`];
        const mar = style[`margin${side}`];
        if (pad && pad !== '0px') spacing.paddings.push(pad);
        if (mar && mar !== '0px' && mar !== 'auto') spacing.margins.push(mar);
      }
      const gap = style.gap;
      const rowGap = style.rowGap;
      const columnGap = style.columnGap;
      if (gap && gap !== 'normal' && gap !== '0px') spacing.gaps.push(gap);
      if (rowGap && rowGap !== 'normal' && rowGap !== '0px') spacing.gaps.push(rowGap);
      if (columnGap && columnGap !== 'normal' && columnGap !== '0px') spacing.gaps.push(columnGap);

      // Borders
      const br = style.borderRadius;
      if (br && br !== '0px') borders.radii.push(br);
      const bw = style.borderWidth;
      if (bw && bw !== '0px') borders.widths.push(bw);

      // Shadows
      const bs = style.boxShadow;
      if (bs && bs !== 'none') shadows.push(bs);
      const ts = style.textShadow;
      if (ts && ts !== 'none') shadows.push(`text: ${ts}`);

      // Gradients
      const bgImg = style.backgroundImage;
      if (bgImg && bgImg !== 'none' && bgImg.includes('gradient')) gradients.push(bgImg);

      // Transitions
      const transition = style.transition;
      if (transition && transition !== 'all 0s ease 0s' && transition !== 'none' && !transition.startsWith('all 0s')) {
        transitions.push(transition);
      }

      // Animations
      const animName = style.animationName;
      if (animName && animName !== 'none') {
        animations.push({
          name: animName,
          duration: style.animationDuration,
          timingFunction: style.animationTimingFunction,
          delay: style.animationDelay,
          iterationCount: style.animationIterationCount,
        });
      }

      // Z-Index
      const zi = style.zIndex;
      if (zi !== 'auto' && zi !== '0') zIndices.push(zi);

      // --- VISUAL EFFECTS ---

      // backdrop-filter (frosted glass, blurred headers)
      const bf = style.backdropFilter || style.webkitBackdropFilter;
      if (bf && bf !== 'none') backdropFilters.push(bf);

      // filter (blur, brightness, contrast, grayscale, saturate, etc.)
      const fl = style.filter;
      if (fl && fl !== 'none') filters.push(fl);

      // transform (rotate, scale, skew, translate, matrix)
      const tf = style.transform;
      if (tf && tf !== 'none') transforms.push(tf);

      // clip-path (custom shapes, hero dividers)
      const cp = style.clipPath;
      if (cp && cp !== 'none') clipPaths.push(cp);

      // mask-image (image masks)
      const mi = style.maskImage || style.webkitMaskImage;
      if (mi && mi !== 'none') maskImages.push(mi);

      // mix-blend-mode (layer blending)
      const mbm = style.mixBlendMode;
      if (mbm && mbm !== 'normal') mixBlendModes.push(mbm);

      // perspective (3D transforms)
      const psp = style.perspective;
      if (psp && psp !== 'none') perspectives.push(psp);

      // -webkit-background-clip: text (gradient text effect)
      const bgClip = style.backgroundClip || style.webkitBackgroundClip;
      if (bgClip === 'text') {
        const tag = el.tagName.toLowerCase();
        const text = el.textContent?.trim().slice(0, 40);
        gradientTexts.push({
          element: tag,
          text: text || '',
          backgroundImage: style.backgroundImage,
          color: style.color,
        });
      }

      // -webkit-text-stroke (text outline)
      const textStroke = style.webkitTextStroke || style.webkitTextStrokeWidth;
      if (textStroke && textStroke !== '0px' && textStroke !== '' && textStroke !== 'medium') {
        textStrokes.push({
          width: style.webkitTextStrokeWidth,
          color: style.webkitTextStrokeColor,
        });
      }

      // object-fit / object-position (image fitting)
      const of = style.objectFit;
      if (of && of !== 'fill') objectFits.push({ fit: of, position: style.objectPosition });

      // aspect-ratio
      const ar = style.aspectRatio;
      if (ar && ar !== 'auto') aspectRatios.push(ar);

      // scroll-snap
      const sst = style.scrollSnapType;
      if (sst && sst !== 'none') scrollSnaps.push({ type: sst, align: style.scrollSnapAlign });

      // custom cursor
      const cur = style.cursor;
      if (cur && !['auto', 'default', 'pointer', 'text', 'not-allowed', 'grab', 'grabbing', 'move', 'crosshair', 'wait', 'help', 'progress', 'inherit'].includes(cur)) {
        cursors.push(cur);
      }
    }

    // --- PSEUDO-ELEMENTS (::before, ::after) ---
    const pseudoElements = [];
    const pseudoSelectors = ['header', 'nav', 'main', 'section', 'footer', 'h1', 'h2', 'h3', 'h4', 'a', 'button', '[class]'];
    const pseudoEls = document.querySelectorAll(pseudoSelectors.join(', '));

    for (const el of pseudoEls) {
      for (const pseudo of ['::before', '::after']) {
        const ps = window.getComputedStyle(el, pseudo);
        const content = ps.content;
        if (!content || content === 'none' || content === 'normal' || content === '""') continue;

        const tag = el.tagName.toLowerCase();
        const cls = (typeof el.className === 'string') ? el.className.split(' ').filter(Boolean).slice(0, 3).join(' ') : '';

        pseudoElements.push({
          selector: cls ? `${tag}.${cls.split(' ')[0]}${pseudo}` : `${tag}${pseudo}`,
          content: content.slice(0, 60),
          display: ps.display,
          position: ps.position,
          width: ps.width,
          height: ps.height,
          backgroundColor: ps.backgroundColor !== 'rgba(0, 0, 0, 0)' ? ps.backgroundColor : null,
          backgroundImage: ps.backgroundImage !== 'none' ? ps.backgroundImage : null,
          borderRadius: ps.borderRadius !== '0px' ? ps.borderRadius : null,
          transform: ps.transform !== 'none' ? ps.transform : null,
          opacity: ps.opacity !== '1' ? ps.opacity : null,
          clipPath: ps.clipPath !== 'none' ? ps.clipPath : null,
          transition: (ps.transition && ps.transition !== 'all 0s ease 0s' && ps.transition !== 'none') ? ps.transition : null,
        });
      }
    }

    // --- ::selection styles ---
    let selectionStyle = null;
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSStyleRule && rule.selectorText?.includes('::selection')) {
            const props = {};
            for (const prop of rule.style) {
              props[prop] = rule.style.getPropertyValue(prop).trim();
            }
            selectionStyle = { selector: rule.selectorText, ...props };
          }
        }
      } catch (e) { /* cross-origin */ }
    }

    // --- VIDEO elements ---
    const videoElements = Array.from(document.querySelectorAll('video')).map(v => ({
      src: v.src || v.querySelector('source')?.src || null,
      poster: v.poster || null,
      autoplay: v.autoplay,
      loop: v.loop,
      muted: v.muted,
      width: v.offsetWidth,
      height: v.offsetHeight,
      parentTag: v.parentElement?.tagName.toLowerCase(),
      parentClass: (typeof v.parentElement?.className === 'string') ? v.parentElement.className.split(' ').slice(0, 3).join(' ') : '',
    }));

    // --------------------------------------------------
    // Extract CSS custom properties from ALL selectors
    // (not just :root — includes .dark, [data-theme], etc.)
    // --------------------------------------------------
    const cssVarsBySelector = {};
    const rootStyle = getComputedStyle(document.documentElement);

    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSStyleRule) {
            const vars = {};
            let hasVars = false;
            for (const prop of rule.style) {
              if (prop.startsWith('--')) {
                vars[prop] = rule.style.getPropertyValue(prop).trim();
                hasVars = true;
              }
            }
            if (hasVars) {
              const selector = rule.selectorText;
              cssVarsBySelector[selector] = {
                ...(cssVarsBySelector[selector] || {}),
                ...vars,
              };
            }
          }
          // Also check inside @media prefers-color-scheme
          if (rule instanceof CSSMediaRule) {
            const condText = rule.conditionText || rule.media?.mediaText || '';
            if (condText.includes('prefers-color-scheme')) {
              for (const innerRule of rule.cssRules) {
                if (innerRule instanceof CSSStyleRule) {
                  const vars = {};
                  let hasVars = false;
                  for (const prop of innerRule.style) {
                    if (prop.startsWith('--')) {
                      vars[prop] = innerRule.style.getPropertyValue(prop).trim();
                      hasVars = true;
                    }
                  }
                  if (hasVars) {
                    const key = `@media(${condText}) ${innerRule.selectorText}`;
                    cssVarsBySelector[key] = {
                      ...(cssVarsBySelector[key] || {}),
                      ...vars,
                    };
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        // Cross-origin stylesheet, skip
      }
    }

    // Resolve current root computed values
    const resolvedRootVars = {};
    const rootSelectors = cssVarsBySelector[':root'] || cssVarsBySelector['html'] || {};
    for (const key of Object.keys(rootSelectors)) {
      resolvedRootVars[key] = rootStyle.getPropertyValue(key).trim() || rootSelectors[key];
    }

    // Extract breakpoints from media queries
    const breakpoints = [];
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSMediaRule) {
            const match = rule.conditionText?.match(/\((?:min|max)-width:\s*(\d+)px\)/);
            if (match) breakpoints.push(parseInt(match[1]));
          }
        }
      } catch (e) { /* cross-origin */ }
    }

    // Extract @keyframes
    const keyframes = {};
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSKeyframesRule) {
            const frames = [];
            for (const kf of rule.cssRules) {
              frames.push({ keyText: kf.keyText, style: kf.cssText });
            }
            keyframes[rule.name] = frames;
          }
        }
      } catch (e) { /* cross-origin */ }
    }

    return {
      colors, typography, spacing, borders, shadows, gradients,
      transitions, animations, zIndices, cssVarsBySelector,
      resolvedRootVars, breakpoints, keyframes,
      // Visual effects
      filters, backdropFilters, transforms, clipPaths, maskImages,
      mixBlendModes, perspectives, gradientTexts, textStrokes,
      objectFits, aspectRatios, scrollSnaps, cursors,
      pseudoElements, selectionStyle, videoElements,
    };
  });

  // Post-process
  const processedTokens = {
    colors: {
      backgrounds: uniqueValues(tokens.colors.backgrounds.map(rgbToHex)),
      texts: uniqueValues(tokens.colors.texts.map(rgbToHex)),
      borders: uniqueValues(tokens.colors.borders.map(rgbToHex)),
      all: uniqueValues([
        ...tokens.colors.backgrounds.map(rgbToHex),
        ...tokens.colors.texts.map(rgbToHex),
        ...tokens.colors.borders.map(rgbToHex),
      ]),
    },
    typography: {
      families: uniqueValues(tokens.typography.families),
      sizes: uniqueValues(tokens.typography.sizes),
      weights: uniqueValues(tokens.typography.weights),
      lineHeights: uniqueValues(tokens.typography.lineHeights),
      letterSpacings: uniqueValues(tokens.typography.letterSpacings).filter(v => v !== 'normal'),
    },
    spacing: {
      paddings: uniqueValues(tokens.spacing.paddings),
      margins: uniqueValues(tokens.spacing.margins),
      gaps: uniqueValues(tokens.spacing.gaps),
    },
    borders: {
      radii: uniqueValues(tokens.borders.radii),
      widths: uniqueValues(tokens.borders.widths),
    },
    shadows: uniqueValues(tokens.shadows),
    gradients: uniqueValues(tokens.gradients),
    transitions: uniqueValues(tokens.transitions),
    animations: tokens.animations.filter((a, i, self) =>
      self.findIndex(b => b.name === a.name) === i
    ),
    zIndices: uniqueValues(tokens.zIndices).map(Number).sort((a, b) => a - b),
    // Visual effects
    effects: {
      backdropFilters: uniqueValues(tokens.backdropFilters),
      filters: uniqueValues(tokens.filters),
      transforms: uniqueValues(tokens.transforms),
      clipPaths: uniqueValues(tokens.clipPaths),
      maskImages: uniqueValues(tokens.maskImages),
      mixBlendModes: uniqueValues(tokens.mixBlendModes),
      perspectives: uniqueValues(tokens.perspectives),
      gradientTexts: tokens.gradientTexts.filter((a, i, self) =>
        self.findIndex(b => b.backgroundImage === a.backgroundImage) === i
      ),
      textStrokes: tokens.textStrokes.filter((a, i, self) =>
        self.findIndex(b => b.width === a.width && b.color === a.color) === i
      ),
      objectFits: tokens.objectFits.filter((a, i, self) =>
        self.findIndex(b => b.fit === a.fit && b.position === a.position) === i
      ),
      aspectRatios: uniqueValues(tokens.aspectRatios),
      scrollSnaps: tokens.scrollSnaps.filter((a, i, self) =>
        self.findIndex(b => b.type === a.type) === i
      ),
      customCursors: uniqueValues(tokens.cursors),
      pseudoElements: tokens.pseudoElements.slice(0, 60),
      selectionStyle: tokens.selectionStyle,
      videoBackgrounds: tokens.videoElements,
    },
    cssVariables: {
      root: tokens.resolvedRootVars,
      bySelector: tokens.cssVarsBySelector,
    },
    breakpoints: uniqueValues(tokens.breakpoints).map(Number).sort((a, b) => a - b),
    keyframes: tokens.keyframes,
  };

  await writeFile(
    join(outputDir, 'design-tokens.json'),
    JSON.stringify(processedTokens, null, 2),
    'utf8'
  );
  console.log('  ✅ design-tokens.json');

  // --- 3. EXTRACT PER-SECTION STYLE MAP ---
  console.log('🗂️  Extracting per-section style map...');

  const sectionStyles = await page.evaluate(() => {
    // Identify top-level sections
    const body = document.body;
    const sectionSelectors = ['header', 'nav', 'main', 'section', 'article', 'aside', 'footer'];
    const topSections = [];

    // First: direct children of body that are sections
    for (const child of body.children) {
      const tag = child.tagName.toLowerCase();
      if (sectionSelectors.includes(tag) || child.id || (child.className && child.offsetHeight > 50)) {
        topSections.push(child);
      }
    }

    // If body wraps in a single div, look one level deeper
    if (topSections.length <= 1 && body.children.length === 1) {
      const wrapper = body.children[0];
      for (const child of wrapper.children) {
        const tag = child.tagName.toLowerCase();
        if (sectionSelectors.includes(tag) || child.id || (child.className && child.offsetHeight > 50)) {
          topSections.push(child);
        }
      }
    }

    // Also look inside <main> for sections
    const mainEl = document.querySelector('main');
    if (mainEl) {
      for (const child of mainEl.children) {
        const tag = child.tagName.toLowerCase();
        if (tag === 'section' || (child.className && child.offsetHeight > 50)) {
          if (!topSections.includes(child)) {
            topSections.push(child);
          }
        }
      }
    }

    function rgbToHex(rgb) {
      if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return null;
      const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!match) return rgb;
      const [, r, g, b] = match;
      return '#' + [r, g, b].map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
    }

    function extractSectionTokens(section) {
      const els = section.querySelectorAll('*');
      const colors = new Set();
      const bgColors = new Set();
      const fontFamilies = new Set();
      const fontSizes = new Set();
      const fontWeights = new Set();
      const paddings = new Set();
      const margins = new Set();
      const gaps = new Set();
      const radii = new Set();
      const shadows = new Set();
      const gradientSet = new Set();
      // Visual effects per-section
      const sectionFilters = new Set();
      const sectionBackdropFilters = new Set();
      const sectionTransforms = new Set();
      const sectionClipPaths = new Set();
      const sectionBlendModes = new Set();

      // Include the section element itself
      const allEls = [section, ...els];

      for (const el of allEls) {
        const s = window.getComputedStyle(el);

        const bg = rgbToHex(s.backgroundColor);
        if (bg) bgColors.add(bg);

        const c = rgbToHex(s.color);
        if (c) colors.add(c);

        fontFamilies.add(s.fontFamily);
        fontSizes.add(s.fontSize);
        fontWeights.add(s.fontWeight);

        for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
          const p = s[`padding${side}`];
          const m = s[`margin${side}`];
          if (p && p !== '0px') paddings.add(p);
          if (m && m !== '0px' && m !== 'auto') margins.add(m);
        }

        const g = s.gap;
        if (g && g !== 'normal' && g !== '0px') gaps.add(g);

        const br = s.borderRadius;
        if (br && br !== '0px') radii.add(br);

        const bs = s.boxShadow;
        if (bs && bs !== 'none') shadows.add(bs);

        const bgImg = s.backgroundImage;
        if (bgImg && bgImg !== 'none' && bgImg.includes('gradient')) gradientSet.add(bgImg);

        // Visual effects
        const bf = s.backdropFilter || s.webkitBackdropFilter;
        if (bf && bf !== 'none') sectionBackdropFilters.add(bf);

        const fl = s.filter;
        if (fl && fl !== 'none') sectionFilters.add(fl);

        const tf = s.transform;
        if (tf && tf !== 'none') sectionTransforms.add(tf);

        const cp = s.clipPath;
        if (cp && cp !== 'none') sectionClipPaths.add(cp);

        const mbm = s.mixBlendMode;
        if (mbm && mbm !== 'normal') sectionBlendModes.add(mbm);
      }

      // Section's own layout
      const sectionStyle = window.getComputedStyle(section);
      const layout = {
        display: sectionStyle.display,
        position: sectionStyle.position,
        width: section.offsetWidth,
        height: section.offsetHeight,
        ...(sectionStyle.display === 'flex' && {
          flexDirection: sectionStyle.flexDirection,
          justifyContent: sectionStyle.justifyContent,
          alignItems: sectionStyle.alignItems,
          flexWrap: sectionStyle.flexWrap,
        }),
        ...(sectionStyle.display === 'grid' && {
          gridTemplateColumns: sectionStyle.gridTemplateColumns,
          gridTemplateRows: sectionStyle.gridTemplateRows,
          gridGap: sectionStyle.gap,
        }),
        overflow: sectionStyle.overflow,
        maxWidth: sectionStyle.maxWidth,
      };

      // Check for video backgrounds in this section
      const videos = section.querySelectorAll('video');
      const hasVideo = videos.length > 0;

      // Build effects object (only include non-empty)
      const effects = {};
      if (sectionBackdropFilters.size) effects.backdropFilters = [...sectionBackdropFilters];
      if (sectionFilters.size) effects.filters = [...sectionFilters];
      if (sectionTransforms.size) effects.transforms = [...sectionTransforms];
      if (sectionClipPaths.size) effects.clipPaths = [...sectionClipPaths];
      if (sectionBlendModes.size) effects.mixBlendModes = [...sectionBlendModes];
      if (hasVideo) effects.hasVideoBackground = true;

      return {
        colors: [...colors].sort(),
        backgrounds: [...bgColors].sort(),
        fontFamilies: [...fontFamilies].filter(Boolean).sort(),
        fontSizes: [...fontSizes].filter(Boolean).sort(),
        fontWeights: [...fontWeights].filter(Boolean).sort(),
        paddings: [...paddings].sort(),
        margins: [...margins].sort(),
        gaps: [...gaps].sort(),
        borderRadii: [...radii].sort(),
        shadows: [...shadows],
        gradients: [...gradientSet],
        ...(Object.keys(effects).length > 0 && { effects }),
        layout,
        elementCount: allEls.length,
      };
    }

    const result = {};
    let sectionIndex = 0;

    for (const section of topSections) {
      const tag = section.tagName.toLowerCase();
      const id = section.id || null;
      const className = (typeof section.className === 'string')
        ? section.className.split(' ').filter(Boolean).slice(0, 3).join('.')
        : '';

      // Generate a descriptive key
      const key = id
        ? `${tag}#${id}`
        : className
          ? `${tag}.${className}`
          : `${tag}[${sectionIndex}]`;

      const heading = section.querySelector('h1, h2, h3');
      const headingText = heading ? heading.textContent?.trim().slice(0, 60) : null;

      result[key] = {
        index: sectionIndex,
        tag,
        ...(id && { id }),
        ...(headingText && { heading: headingText }),
        rect: {
          top: section.getBoundingClientRect().top + window.scrollY,
          height: section.offsetHeight,
        },
        tokens: extractSectionTokens(section),
      };

      sectionIndex++;
    }

    return result;
  });

  await writeFile(
    join(outputDir, 'section-styles.json'),
    JSON.stringify(sectionStyles, null, 2),
    'utf8'
  );
  console.log(`  ✅ section-styles.json (${Object.keys(sectionStyles).length} sections)`);

  // --- 4. EXTRACT INTERACTIVE STATES (hover, focus, active) ---
  console.log('🖱️  Extracting interactive states...');

  const interactiveStates = await page.evaluate(() => {
    function rgbToHex(rgb) {
      if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return null;
      const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!match) return rgb;
      const [, r, g, b] = match;
      return '#' + [r, g, b].map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
    }

    function getInteractiveProps(el) {
      const s = window.getComputedStyle(el);
      return {
        color: rgbToHex(s.color),
        backgroundColor: rgbToHex(s.backgroundColor),
        borderColor: rgbToHex(s.borderColor),
        boxShadow: s.boxShadow !== 'none' ? s.boxShadow : null,
        textDecoration: s.textDecoration !== 'none' ? s.textDecoration : null,
        transform: s.transform !== 'none' ? s.transform : null,
        opacity: s.opacity !== '1' ? s.opacity : null,
        outline: s.outline !== 'none' && !s.outline.includes('0px') ? s.outline : null,
        scale: s.scale !== 'none' ? s.scale : null,
        cursor: s.cursor,
      };
    }

    // Collect interactive elements
    const selectors = [
      'a', 'button', '[role="button"]', 'input', 'textarea', 'select',
      '[tabindex]', '.btn', '[class*="button"]', '[class*="btn"]',
      '[class*="link"]', '[class*="cta"]', '[class*="nav-"]',
    ];

    const elements = document.querySelectorAll(selectors.join(', '));
    const results = [];

    // Extract CSS rules that target :hover, :focus, :active
    const hoverRules = {};
    const focusRules = {};
    const activeRules = {};

    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSStyleRule) {
            const sel = rule.selectorText;
            if (sel.includes(':hover')) {
              const base = sel.replace(/:hover/g, '').trim();
              const props = {};
              for (const prop of rule.style) {
                props[prop] = rule.style.getPropertyValue(prop).trim();
              }
              hoverRules[base] = { ...(hoverRules[base] || {}), ...props };
            }
            if (sel.includes(':focus')) {
              const base = sel.replace(/:focus(-visible|-within)?/g, '').trim();
              const props = {};
              for (const prop of rule.style) {
                props[prop] = rule.style.getPropertyValue(prop).trim();
              }
              focusRules[base] = { ...(focusRules[base] || {}), ...props };
            }
            if (sel.includes(':active')) {
              const base = sel.replace(/:active/g, '').trim();
              const props = {};
              for (const prop of rule.style) {
                props[prop] = rule.style.getPropertyValue(prop).trim();
              }
              activeRules[base] = { ...(activeRules[base] || {}), ...props };
            }
          }
        }
      } catch (e) { /* cross-origin */ }
    }

    // For each interactive element, record base state
    const seen = new Set();
    for (const el of elements) {
      const tag = el.tagName.toLowerCase();
      const cls = (typeof el.className === 'string') ? el.className.split(' ').filter(Boolean).sort().join(' ') : '';
      const key = `${tag}|${cls}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const baseState = getInteractiveProps(el);
      const text = el.textContent?.trim().slice(0, 40) || '';

      results.push({
        tag,
        class: cls.split(' ').slice(0, 5).join(' '),
        text: text || undefined,
        id: el.id || undefined,
        baseState,
        transition: window.getComputedStyle(el).transition,
      });
    }

    return {
      elements: results.slice(0, 50),
      cssRules: {
        hover: hoverRules,
        focus: focusRules,
        active: activeRules,
      },
    };
  });

  await writeFile(
    join(outputDir, 'interactive-states.json'),
    JSON.stringify(interactiveStates, null, 2),
    'utf8'
  );
  console.log(`  ✅ interactive-states.json (${interactiveStates.elements.length} elements, ${Object.keys(interactiveStates.cssRules.hover).length} hover rules)`);

  // --- 5. EXTRACT DEEP PAGE STRUCTURE (depth 6) ---
  console.log('🏗️  Extracting deep page structure (depth 6)...');

  const structure = await page.evaluate(() => {
    function extractNode(el, depth = 0) {
      if (depth > 6) return null;
      if (!el || el.nodeType !== 1) return null;

      const tag = el.tagName.toLowerCase();
      const style = window.getComputedStyle(el);

      // Skip invisible elements
      if (style.display === 'none' || style.visibility === 'hidden') return null;
      // Skip script/style/noscript
      if (['script', 'style', 'noscript', 'link', 'meta'].includes(tag)) return null;

      const node = {
        tag,
        ...(el.id && { id: el.id }),
        ...(el.className && typeof el.className === 'string' && {
          class: el.className.split(' ').filter(Boolean).slice(0, 8).join(' '),
        }),
        ...(tag.match(/^h[1-6]$/) && { text: el.textContent?.trim().slice(0, 100) }),
        ...(tag === 'p' && depth <= 3 && { text: el.textContent?.trim().slice(0, 80) }),
        ...(tag === 'img' && { src: el.getAttribute('src')?.slice(0, 120), alt: el.alt }),
        ...(tag === 'a' && { href: el.getAttribute('href')?.slice(0, 120) }),
        ...(tag === 'button' && { text: el.textContent?.trim().slice(0, 40) }),
        ...(tag === 'span' && depth <= 4 && el.textContent?.trim().length < 60 && {
          text: el.textContent?.trim(),
        }),
        ...(tag === 'picture' && { sources: Array.from(el.querySelectorAll('source')).map(s => s.srcset?.slice(0, 80)) }),
        ...(tag === 'video' && {
          src: el.getAttribute('src') || el.querySelector('source')?.getAttribute('src') || undefined,
          poster: el.getAttribute('poster') || undefined,
          autoplay: el.autoplay || undefined,
          loop: el.loop || undefined,
          muted: el.muted || undefined,
          playsInline: el.playsInline || undefined,
        }),
        ...(el.getAttribute('role') && { role: el.getAttribute('role') }),
        ...(el.getAttribute('aria-label') && { ariaLabel: el.getAttribute('aria-label') }),
        layout: {
          display: style.display,
          position: style.position,
          ...(style.position !== 'static' && {
            top: style.top !== 'auto' ? style.top : undefined,
            right: style.right !== 'auto' ? style.right : undefined,
            bottom: style.bottom !== 'auto' ? style.bottom : undefined,
            left: style.left !== 'auto' ? style.left : undefined,
          }),
          ...(style.display === 'flex' && {
            flexDirection: style.flexDirection,
            justifyContent: style.justifyContent,
            alignItems: style.alignItems,
            flexWrap: style.flexWrap,
            gap: style.gap !== 'normal' ? style.gap : undefined,
          }),
          ...(style.display === 'grid' && {
            gridTemplateColumns: style.gridTemplateColumns,
            gridTemplateRows: style.gridTemplateRows,
            gap: style.gap !== 'normal' ? style.gap : undefined,
            gridAutoFlow: style.gridAutoFlow !== 'row' ? style.gridAutoFlow : undefined,
          }),
          ...(style.display === 'inline-flex' && {
            flexDirection: style.flexDirection,
            justifyContent: style.justifyContent,
            alignItems: style.alignItems,
            gap: style.gap !== 'normal' ? style.gap : undefined,
          }),
          width: el.offsetWidth,
          height: el.offsetHeight,
          ...(style.maxWidth !== 'none' && { maxWidth: style.maxWidth }),
          ...(style.minHeight !== '0px' && style.minHeight !== 'auto' && { minHeight: style.minHeight }),
          ...(style.overflow !== 'visible' && style.overflow !== 'auto' && { overflow: style.overflow }),
          // Visual effects (only when present)
          ...((style.backdropFilter && style.backdropFilter !== 'none')
            ? { backdropFilter: style.backdropFilter }
            : (style.webkitBackdropFilter && style.webkitBackdropFilter !== 'none')
              ? { backdropFilter: style.webkitBackdropFilter }
              : {}),
          ...(style.filter && style.filter !== 'none' && { filter: style.filter }),
          ...(style.transform && style.transform !== 'none' && { transform: style.transform }),
          ...(style.clipPath && style.clipPath !== 'none' && { clipPath: style.clipPath }),
          ...(style.mixBlendMode && style.mixBlendMode !== 'normal' && { mixBlendMode: style.mixBlendMode }),
          ...(style.objectFit && style.objectFit !== 'fill' && { objectFit: style.objectFit }),
          ...(style.objectPosition && style.objectPosition !== '50% 50%' && { objectPosition: style.objectPosition }),
          ...(style.aspectRatio && style.aspectRatio !== 'auto' && { aspectRatio: style.aspectRatio }),
          ...(style.opacity && style.opacity !== '1' && { opacity: style.opacity }),
          ...(style.perspective && style.perspective !== 'none' && { perspective: style.perspective }),
        },
      };

      // Clean undefined values from layout
      node.layout = Object.fromEntries(
        Object.entries(node.layout).filter(([, v]) => v !== undefined)
      );

      const children = Array.from(el.children)
        .map(child => extractNode(child, depth + 1))
        .filter(Boolean);

      if (children.length > 0) node.children = children;

      return node;
    }

    return extractNode(document.body);
  });

  await writeFile(
    join(outputDir, 'structure.json'),
    JSON.stringify(structure, null, 2),
    'utf8'
  );
  console.log('  ✅ structure.json (depth 6)');

  // --- 6. DOWNLOAD ASSETS ---
  if (fullMode) {
    console.log('📦 Downloading assets...');

    // Images (including picture sources and bg images)
    const imageUrls = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      const sources = Array.from(document.querySelectorAll('source[srcset]'));
      const bgImgs = Array.from(document.querySelectorAll('*'))
        .map(el => {
          const bg = window.getComputedStyle(el).backgroundImage;
          const match = bg?.match(/url\(["']?(.*?)["']?\)/);
          return match ? match[1] : null;
        })
        .filter(Boolean);

      const srcsets = sources.flatMap(s => {
        return (s.srcset || '').split(',').map(entry => entry.trim().split(' ')[0]);
      });

      return [
        ...imgs.map(img => img.currentSrc || img.src),
        ...srcsets,
        ...bgImgs,
      ].filter(u => u && !u.startsWith('data:'));
    });

    const uniqueImages = [...new Set(imageUrls)];
    let imgCount = 0;
    for (const imgUrl of uniqueImages.slice(0, 80)) {
      try {
        const response = await page.request.get(imgUrl);
        if (response.ok()) {
          const ext = extname(new URL(imgUrl).pathname) || '.png';
          const name = `img-${(++imgCount).toString().padStart(3, '0')}${ext}`;
          await writeFile(join(outputDir, 'assets', 'images', name), await response.body());
        }
      } catch (e) { /* skip */ }
    }
    console.log(`  ✅ ${imgCount} images downloaded`);

    // SVGs (inline)
    const svgData = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('svg')).map((svg, i) => ({
        index: i,
        html: svg.outerHTML,
        classes: svg.getAttribute('class') || '',
        ariaLabel: svg.getAttribute('aria-label') || '',
      }));
    });

    for (const svg of svgData.slice(0, 50)) {
      await writeFile(
        join(outputDir, 'assets', 'svgs', `svg-${svg.index.toString().padStart(3, '0')}.svg`),
        svg.html,
        'utf8'
      );
    }
    console.log(`  ✅ ${Math.min(svgData.length, 50)} SVGs extracted`);

    // Fonts
    let fontCount = 0;
    for (const fontUrl of [...new Set(fontUrls)]) {
      try {
        const response = await page.request.get(fontUrl);
        if (response.ok()) {
          const urlObj = new URL(fontUrl);
          const name = basename(urlObj.pathname) || `font-${++fontCount}.woff2`;
          await writeFile(join(outputDir, 'assets', 'fonts', name), await response.body());
          fontCount++;
        }
      } catch (e) { /* skip */ }
    }
    console.log(`  ✅ ${fontCount} fonts downloaded`);
  }

  await browser.close();

  // --- 7. SUMMARY ---
  const fx = processedTokens.effects || {};
  const effectsCount = [
    fx.backdropFilters?.length || 0,
    fx.filters?.length || 0,
    fx.transforms?.length || 0,
    fx.clipPaths?.length || 0,
    fx.mixBlendModes?.length || 0,
    fx.pseudoElements?.length || 0,
    fx.videoBackgrounds?.length || 0,
  ].reduce((a, b) => a + b, 0);

  console.log('\n✨ Extraction complete!');
  console.log(`📁 Output: ${outputDir}/`);
  console.log(`   ├── design-tokens.json (${processedTokens.colors.all.length} colors, ${processedTokens.typography.families.length} fonts, ${effectsCount} effects)`);
  console.log(`   ├── section-styles.json (${Object.keys(sectionStyles).length} sections)`);
  console.log(`   ├── interactive-states.json (${interactiveStates.elements.length} elements)`);
  console.log(`   ├── structure.json (depth 6)`);
  console.log(`   ├── screenshots/ (${viewports.length} viewports)`);
  if (fullMode) {
    console.log(`   └── assets/ (images, svgs, fonts)`);
  }
  if (effectsCount > 0) {
    const fxDetails = [];
    if (fx.backdropFilters?.length) fxDetails.push(`${fx.backdropFilters.length} backdrop-filters`);
    if (fx.filters?.length) fxDetails.push(`${fx.filters.length} filters`);
    if (fx.clipPaths?.length) fxDetails.push(`${fx.clipPaths.length} clip-paths`);
    if (fx.pseudoElements?.length) fxDetails.push(`${fx.pseudoElements.length} pseudo-elements`);
    if (fx.videoBackgrounds?.length) fxDetails.push(`${fx.videoBackgrounds.length} videos`);
    if (fx.gradientTexts?.length) fxDetails.push(`${fx.gradientTexts.length} gradient-texts`);
    if (fx.maskImages?.length) fxDetails.push(`${fx.maskImages.length} masks`);
    console.log(`   🎨 Effects: ${fxDetails.join(', ')}`);
  }
  console.log('\nRun with --full to also download images, SVGs, and fonts.');
}

main().catch((err) => {
  console.error('❌ Extraction failed:', err.message);
  process.exit(1);
});
