#!/usr/bin/env node

/**
 * Pixarts Project Checker — Automated quality checks
 * 
 * Usage:
 *   node scripts/check-project.mjs              # Run all checks
 *   node scripts/check-project.mjs --fix        # Run + auto-fix simple issues
 *   node scripts/check-project.mjs --ci         # CI mode (exit code 1 on errors)
 *   node scripts/check-project.mjs --category structure   # Run specific category only
 * 
 * Categories: structure, i18n, seo, gdpr, typescript, a11y, performance, deps, env
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { glob } from 'node:fs/promises';

// ─── Config ──────────────────────────────────────────────────────────────────

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const APP = path.join(SRC, 'app');
const LOCALES = ['it', 'en', 'cs'];
const CI_MODE = process.argv.includes('--ci');
const FIX_MODE = process.argv.includes('--fix');
const CATEGORY_FLAG = process.argv.indexOf('--category');
const ONLY_CATEGORY = CATEGORY_FLAG !== -1 ? process.argv[CATEGORY_FLAG + 1] : null;

const results = { critical: [], warning: [], ok: [] };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function exists(filePath) {
  return fs.existsSync(path.join(ROOT, filePath));
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, filePath), 'utf-8'));
  } catch { return null; }
}

function findFiles(pattern, dir = SRC) {
  try {
    const result = execSync(`git ls-files "${dir}" -- "${pattern}"`, { encoding: 'utf-8', cwd: ROOT });
    return result.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function grepFiles(pattern, filePattern = '*.tsx', dir = 'src') {
  try {
    const result = execSync(
      `git grep -l "${pattern}" -- "${dir}/**/${filePattern}"`,
      { encoding: 'utf-8', cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return result.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function critical(category, message) { results.critical.push({ category, message }); }
function warning(category, message) { results.warning.push({ category, message }); }
function ok(category, message) { results.ok.push({ category, message }); }

// ─── Check: Structure ────────────────────────────────────────────────────────

function checkStructure() {
  const requiredFiles = [
    { path: 'src/app/[locale]/layout.tsx', name: 'Root layout' },
    { path: 'src/app/[locale]/page.tsx', name: 'Home page' },
    { path: 'src/app/[locale]/not-found.tsx', name: '404 page' },
    { path: 'src/app/[locale]/error.tsx', name: 'Error boundary' },
    { path: 'src/app/[locale]/loading.tsx', name: 'Loading UI' },
    { path: 'src/middleware.ts', name: 'Middleware', alt: 'middleware.ts' },
    { path: 'next.config.mjs', name: 'Next config', alt: 'next.config.ts' },
    { path: 'tsconfig.json', name: 'TypeScript config' },
    { path: 'Dockerfile', name: 'Dockerfile' },
    { path: 'src/components/layout/header.tsx', name: 'Header component' },
    { path: 'src/components/layout/footer.tsx', name: 'Footer component' },
    { path: 'src/lib/utils.ts', name: 'Utils (cn helper)' },
  ];

  let passed = 0;
  let failed = 0;

  for (const file of requiredFiles) {
    const found = exists(file.path) || (file.alt && exists(file.alt));
    if (!found) {
      warning('structure', `File mancante: ${file.path} (${file.name})`);
      failed++;
    } else {
      passed++;
    }
  }

  // Check middleware exists at root
  if (!exists('middleware.ts') && !exists('src/middleware.ts')) {
    critical('structure', 'middleware.ts mancante — i18n routing non funzionerà');
  }

  if (failed === 0) ok('structure', `Tutti i ${passed} file standard presenti`);
}

// ─── Check: i18n ─────────────────────────────────────────────────────────────

function checkI18n() {
  const messagesDir = path.join(ROOT, 'messages');
  
  if (!fs.existsSync(messagesDir)) {
    critical('i18n', 'Cartella messages/ mancante');
    return;
  }

  // Check all locale files exist
  const missingLocales = LOCALES.filter(l => !exists(`messages/${l}.json`));
  if (missingLocales.length > 0) {
    critical('i18n', `File traduzione mancanti: ${missingLocales.map(l => `${l}.json`).join(', ')}`);
    return;
  }

  // Compare keys across locales
  const allKeys = {};
  const allLocaleData = {};
  
  for (const locale of LOCALES) {
    const data = readJson(`messages/${locale}.json`);
    if (!data) {
      critical('i18n', `Errore parsing messages/${locale}.json`);
      continue;
    }
    allLocaleData[locale] = data;
    const keys = flattenKeys(data);
    allKeys[locale] = new Set(keys);
  }

  // Find missing keys
  const allUniqueKeys = new Set();
  for (const keys of Object.values(allKeys)) {
    for (const k of keys) allUniqueKeys.add(k);
  }

  let totalMissing = 0;
  for (const locale of LOCALES) {
    if (!allKeys[locale]) continue;
    const missing = [...allUniqueKeys].filter(k => !allKeys[locale].has(k));
    if (missing.length > 0) {
      warning('i18n', `${locale}.json: ${missing.length} chiavi mancanti → ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '...' : ''}`);
      totalMissing += missing.length;

      // Auto-fix: add missing keys with placeholder
      if (FIX_MODE) {
        const data = allLocaleData[locale];
        for (const key of missing) {
          setNestedKey(data, key, `[TODO: translate ${key}]`);
        }
        fs.writeFileSync(
          path.join(ROOT, `messages/${locale}.json`),
          JSON.stringify(data, null, 2) + '\n'
        );
        console.log(`  🔧 Fixed: added ${missing.length} placeholder keys to ${locale}.json`);
      }
    }
  }

  if (totalMissing === 0) ok('i18n', `Tutte le chiavi presenti in ${LOCALES.length} lingue`);
}

function flattenKeys(obj, prefix = '') {
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...flattenKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function setNestedKey(obj, keyPath, value) {
  const parts = keyPath.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

// ─── Check: SEO ──────────────────────────────────────────────────────────────

function checkSeo() {
  // robots.ts
  if (!exists('src/app/robots.ts') && !exists('public/robots.txt')) {
    critical('seo', 'robots.ts/robots.txt mancante');
  } else {
    ok('seo', 'robots.ts presente');
  }

  // sitemap.ts
  const hasSitemap = exists('src/app/sitemap.ts') || exists('src/app/sitemap.xml/route.ts');
  if (!hasSitemap) {
    critical('seo', 'sitemap.ts mancante — Google non indicizzerà tutte le pagine');
  } else {
    ok('seo', 'Sitemap presente');
  }

  // Favicon
  if (!exists('src/app/favicon.ico') && !exists('src/app/icon.tsx') && !exists('public/favicon.ico')) {
    warning('seo', 'Favicon mancante');
  }

  // OG image
  if (!exists('src/app/opengraph-image.tsx') && !exists('public/og-image.jpg') && !exists('public/og-image.png')) {
    warning('seo', 'OG image mancante (1200x630)');
  }

  // Check layout.tsx has metadata export
  const layoutPath = path.join(ROOT, 'src/app/[locale]/layout.tsx');
  if (fs.existsSync(layoutPath)) {
    const content = fs.readFileSync(layoutPath, 'utf-8');
    if (!content.includes('metadata') && !content.includes('generateMetadata')) {
      critical('seo', 'Root layout manca export metadata');
    }
  }

  // Check for schema.org JSON-LD
  const hasSchemaOrg = grepFiles('application/ld\\+json', '*.tsx').length > 0 
    || grepFiles('schema.org', '*.tsx').length > 0;
  if (!hasSchemaOrg) {
    warning('seo', 'Schema.org JSON-LD non trovato — aggiungere per rich results');
  }
}

// ─── Check: GDPR ─────────────────────────────────────────────────────────────

function checkGdpr() {
  // Privacy page
  const hasPrivacy = LOCALES.some(l => 
    exists(`src/app/[locale]/(legal)/privacy/page.tsx`) ||
    exists(`src/app/[locale]/privacy/page.tsx`)
  );
  if (!hasPrivacy) {
    critical('gdpr', 'Privacy policy page mancante');
  }

  // Cookie policy page
  const hasCookie = LOCALES.some(l =>
    exists(`src/app/[locale]/(legal)/cookie-policy/page.tsx`) ||
    exists(`src/app/[locale]/cookie-policy/page.tsx`)
  );
  if (!hasCookie) {
    critical('gdpr', 'Cookie policy page mancante');
  }

  // Cookie banner (Iubenda or custom)
  const hasIubenda = grepFiles('iubenda', '*.tsx').length > 0;
  const hasCookieBanner = grepFiles('cookie-banner\\|cookie-consent\\|CookieBanner\\|CookieConsent', '*.tsx').length > 0;
  if (!hasIubenda && !hasCookieBanner) {
    critical('gdpr', 'Cookie banner non trovato — obbligatorio per GDPR');
  } else {
    ok('gdpr', 'Cookie banner presente');
  }

  // Check if GA/GTM is loaded without consent gate
  const layoutContent = fs.existsSync(path.join(ROOT, 'src/app/[locale]/layout.tsx'))
    ? fs.readFileSync(path.join(ROOT, 'src/app/[locale]/layout.tsx'), 'utf-8')
    : '';
  
  if ((layoutContent.includes('GTM-') || layoutContent.includes('G-') || layoutContent.includes('googletagmanager'))
    && !layoutContent.includes('consent') && !layoutContent.includes('iubenda')) {
    critical('gdpr', 'Analytics caricato direttamente nel layout SENZA gate di consenso → VIOLAZIONE GDPR');
  }

  // Footer P.IVA check
  const footerFiles = grepFiles('P\\.IVA\\|P\\.iva\\|Partita IVA\\|VAT', '*.tsx');
  if (footerFiles.length === 0) {
    warning('gdpr', 'P.IVA non trovata nel footer — obbligatoria per legge italiana');
  }
}

// ─── Check: TypeScript ───────────────────────────────────────────────────────

function checkTypescript() {
  // tsconfig strict mode
  const tsconfig = readJson('tsconfig.json');
  if (tsconfig) {
    if (!tsconfig.compilerOptions?.strict) {
      warning('typescript', 'tsconfig.json: "strict" non è true');
    } else {
      ok('typescript', 'Strict mode abilitato');
    }
  }

  // Check for 'as any'
  const asAnyFiles = grepFiles('as any', '*.ts').concat(grepFiles('as any', '*.tsx'));
  if (asAnyFiles.length > 0) {
    warning('typescript', `'as any' trovato in ${asAnyFiles.length} file: ${asAnyFiles.slice(0, 3).join(', ')}`);
  }

  // Check for @ts-ignore
  const tsIgnoreFiles = grepFiles('@ts-ignore\\|@ts-expect-error', '*.ts')
    .concat(grepFiles('@ts-ignore\\|@ts-expect-error', '*.tsx'));
  if (tsIgnoreFiles.length > 0) {
    warning('typescript', `@ts-ignore/@ts-expect-error in ${tsIgnoreFiles.length} file`);
  }

  // Run tsc --noEmit
  try {
    execSync('npx tsc --noEmit', { cwd: ROOT, stdio: 'pipe' });
    ok('typescript', 'Zero errori di tipo');
  } catch (e) {
    const output = e.stdout?.toString() || '';
    const errorCount = (output.match(/error TS/g) || []).length;
    critical('typescript', `${errorCount || '?'} errori TypeScript (run: npx tsc --noEmit)`);
  }
}

// ─── Check: Accessibility ────────────────────────────────────────────────────

function checkAccessibility() {
  // Images without alt
  const imgNoAlt = grepFiles('<img[^>]*(?!.*alt)', '*.tsx');
  // More precise: look for <img without alt=
  const rawImgFiles = grepFiles('<img ', '*.tsx');
  if (rawImgFiles.length > 0) {
    warning('a11y', `${rawImgFiles.length} file con tag <img> raw — usa next/image con alt text`);
  }

  // Check for aria-label on icon buttons
  const iconButtonFiles = grepFiles('size="icon"', '*.tsx');
  // This is a heuristic — would need AST for precision

  // Check html lang
  const layoutPath = path.join(ROOT, 'src/app/[locale]/layout.tsx');
  if (fs.existsSync(layoutPath)) {
    const content = fs.readFileSync(layoutPath, 'utf-8');
    if (!content.includes('lang=') && !content.includes('lang={')) {
      critical('a11y', 'Root layout: <html> manca attributo lang');
    } else {
      ok('a11y', '<html lang> presente');
    }
  }
}

// ─── Check: Performance ──────────────────────────────────────────────────────

function checkPerformance() {
  // Check for raw <img> instead of next/image
  const rawImgs = grepFiles('<img ', '*.tsx').filter(f => !f.includes('node_modules'));
  if (rawImgs.length > 0) {
    warning('performance', `${rawImgs.length} file con <img> raw — usa next/image per ottimizzazione`);
  }

  // Check for Google Fonts link (should use next/font)
  const googleFontsLink = grepFiles('fonts.googleapis.com', '*.tsx')
    .concat(grepFiles('fonts.googleapis.com', '*.ts'));
  if (googleFontsLink.length > 0) {
    warning('performance', 'Google Fonts caricato via link — usa next/font per self-hosting');
  }

  // Check bundle: look for heavy client components
  const useClientFiles = grepFiles("'use client'", '*.tsx');
  if (useClientFiles.length > 20) {
    warning('performance', `${useClientFiles.length} file con 'use client' — verificare se necessario`);
  } else {
    ok('performance', `${useClientFiles.length} client components (ragionevole)`);
  }
}

// ─── Check: Dependencies ─────────────────────────────────────────────────────

function checkDeps() {
  // Lock file
  const hasLock = exists('package-lock.json') || exists('pnpm-lock.yaml') || exists('yarn.lock');
  if (!hasLock) {
    critical('deps', 'Nessun lock file — build non riproducibili');
  } else {
    ok('deps', 'Lock file presente');
  }

  // npm audit
  try {
    execSync('npm audit --audit-level=critical', { cwd: ROOT, stdio: 'pipe' });
    ok('deps', 'Nessuna vulnerabilità critica');
  } catch (e) {
    const output = e.stdout?.toString() || '';
    if (output.includes('critical')) {
      critical('deps', 'Vulnerabilità CRITICHE trovate — run: npm audit fix');
    } else {
      warning('deps', 'Vulnerabilità trovate (non critiche) — run: npm audit');
    }
  }
}

// ─── Check: Environment ──────────────────────────────────────────────────────

function checkEnv() {
  const envFile = exists('.env.local') ? '.env.local' : exists('.env') ? '.env' : null;
  
  if (!envFile) {
    critical('env', '.env.local mancante');
    return;
  }

  const content = fs.readFileSync(path.join(ROOT, envFile), 'utf-8');
  
  const requiredVars = [
    'NEXT_PUBLIC_SITE_URL',
    'NEXT_PUBLIC_CMS_URL',
    'TENANT_SLUG',
    'REVALIDATION_SECRET',
  ];

  const missing = requiredVars.filter(v => !content.includes(v));
  if (missing.length > 0) {
    warning('env', `Variabili mancanti in ${envFile}: ${missing.join(', ')}`);
  } else {
    ok('env', 'Tutte le variabili ambiente configurate');
  }

  // Check for placeholder values
  if (content.includes('<') && content.includes('>')) {
    warning('env', 'Valori placeholder (<...>) trovati in .env — configurare prima del deploy');
  }
}

// ─── Runner ──────────────────────────────────────────────────────────────────

const checks = {
  structure: checkStructure,
  i18n: checkI18n,
  seo: checkSeo,
  gdpr: checkGdpr,
  typescript: checkTypescript,
  a11y: checkAccessibility,
  performance: checkPerformance,
  deps: checkDeps,
  env: checkEnv,
};

console.log('\n🔍 Pixarts Project Checker\n');
console.log(`📁 ${ROOT}`);
console.log(`📅 ${new Date().toISOString().split('T')[0]}`);
console.log('─'.repeat(60));

for (const [name, fn] of Object.entries(checks)) {
  if (ONLY_CATEGORY && name !== ONLY_CATEGORY) continue;
  
  try {
    fn();
  } catch (err) {
    warning(name, `Check error: ${err.message}`);
  }
}

// ─── Report ──────────────────────────────────────────────────────────────────

console.log('\n📊 RISULTATI\n');
console.log(`🔴 Critici: ${results.critical.length} | 🟡 Warning: ${results.warning.length} | 🟢 OK: ${results.ok.length}`);
console.log('─'.repeat(60));

if (results.critical.length > 0) {
  console.log('\n🔴 CRITICI (da fixare subito)');
  for (const r of results.critical) {
    console.log(`  [${r.category}] ${r.message}`);
  }
}

if (results.warning.length > 0) {
  console.log('\n🟡 WARNING (da fixare prima del deploy)');
  for (const r of results.warning) {
    console.log(`  [${r.category}] ${r.message}`);
  }
}

if (results.ok.length > 0) {
  console.log('\n🟢 OK');
  for (const r of results.ok) {
    console.log(`  [${r.category}] ${r.message} ✓`);
  }
}

console.log('\n' + '─'.repeat(60));

if (CI_MODE && results.critical.length > 0) {
  console.log('❌ CI FAILED: trovati problemi critici');
  process.exit(1);
}

if (results.critical.length === 0 && results.warning.length === 0) {
  console.log('✅ Tutti i check passati!');
} else if (results.critical.length === 0) {
  console.log('⚠️ Nessun problema critico, ma ci sono warning da risolvere');
}

console.log('');
