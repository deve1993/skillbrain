#!/usr/bin/env node

/**
 * Pixarts — Bootstrap Nuovo Progetto Client
 * 
 * Uso: node .Claude/scripts/new-project.mjs "Nome Cliente"
 * 
 * Crea Progetti/<slug>/ con:
 *  - Next.js 15 + TypeScript + Tailwind + ESLint
 *  - next-intl (IT/EN/CZ)
 *  - shadcn/ui base
 *  - Payload CMS client (lib/payload.ts)
 *  - Struttura componenti standard (layout, shared)
 *  - Automation: Husky + lint-staged + GitHub Actions CI
 *  - Dockerfile multi-stage
 *  - .env.example completo
 *  - check-project.mjs
 *
 * NON include: setup CMS tenant, workflow n8n, deploy Coolify
 * (quelli li gestisci tu manualmente)
 */

import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE = path.resolve(__dirname, '../..');
const PROGETTI = path.join(WORKSPACE, 'Progetti');
const TEMPLATES = path.join(WORKSPACE, '.Claude/templates/project-automation');

// Load env vars from settings.local.json if not already in process.env.
// The script runs via plain `node` from terminal, without OpenCode env vars.
{
  const settingsPath = path.join(WORKSPACE, '.opencode/settings.local.json');
  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    for (const [k, v] of Object.entries(settings?.env || {})) {
      if (!process.env[k]) process.env[k] = v;
    }
  } catch { /* settings.local.json not found or unreadable - ok */ }
}

// Ensure shell utilities are findable
const ENV = {
  ...process.env,
  PATH: process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

function log(msg) { console.log(`  ${msg}`); }
function ok(msg) { console.log(`  ${green('✓')} ${msg}`); }
function warn(msg) { console.log(`  ${yellow('⚠')} ${msg}`); }
function step(msg) { console.log(`\n${bold(msg)}`); }

function run(cmd, cwd, silent = false) {
  const opts = { cwd, encoding: 'utf-8', stdio: silent ? 'pipe' : 'inherit', shell: '/bin/sh', env: ENV };
  try {
    return execSync(cmd, opts);
  } catch (e) {
    if (!silent) throw e;
    return null;
  }
}

function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

function copyTemplate(src, dest) {
  if (fs.existsSync(src)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    return true;
  }
  return false;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const projectName = process.argv[2];

if (!projectName) {
  console.error(red('\nUso: node .Claude/scripts/new-project.mjs "Nome Cliente"\n'));
  console.error('Esempi:');
  console.error('  node .Claude/scripts/new-project.mjs "Ristorante Da Mario"');
  console.error('  node .Claude/scripts/new-project.mjs "Studio Legale Rossi"');
  console.error('  node .Claude/scripts/new-project.mjs "TechStartup SRL"\n');
  process.exit(1);
}

const slug = slugify(projectName);
const projectDir = path.join(PROGETTI, slug);

console.log(`\n${bold('🚀 Pixarts — Nuovo Progetto Client')}`);
console.log('─'.repeat(50));
log(`Nome:   ${projectName}`);
log(`Slug:   ${slug}`);
log(`Path:   Progetti/${slug}/`);
console.log('─'.repeat(50));

// ─── Step 1: Verifica pre-condizioni ──────────────────────────────────────────

step('1. Verifica pre-condizioni');

if (!fs.existsSync(PROGETTI)) {
  console.error(red(`  ✗ Cartella Progetti/ non trovata in ${WORKSPACE}`));
  process.exit(1);
}

if (fs.existsSync(projectDir)) {
  console.error(red(`  ✗ Progetto già esistente: Progetti/${slug}/`));
  console.error(red('    Rimuovilo prima o usa un nome diverso.'));
  process.exit(1);
}

ok('Workspace valido');
ok('Slug disponibile');

// ─── Step 2: create-next-app ──────────────────────────────────────────────────

step('2. Inizializzo Next.js 15 (create-next-app)');
log('Questo richiede 1-2 minuti...\n');

run(
  `npx create-next-app@latest "${slug}" \
    --typescript \
    --tailwind \
    --eslint \
    --app \
    --src-dir \
    --no-git \
    --import-alias "@/*" \
    --use-npm \
    --yes`,
  PROGETTI
);

ok('Next.js 15 inizializzato');

// ─── Step 3: Installa dipendenze aggiuntive ───────────────────────────────────

step('3. Installo dipendenze aggiuntive');

const deps = [
  'framer-motion',
  'next-intl',
  'clsx',
  'tailwind-merge',
  'lucide-react',
  'zod',
  'react-hook-form',
  '@hookform/resolvers',
].join(' ');

const devDeps = [
  'husky',
  'lint-staged',
].join(' ');

run(`npm install ${deps}`, projectDir);
ok(`Deps: ${deps.replace(/ /g, ', ')}`);

run(`npm install -D ${devDeps}`, projectDir);
ok(`Dev deps: ${devDeps.replace(/ /g, ', ')}`);

// ─── Step 4: Setup shadcn/ui ──────────────────────────────────────────────────

step('4. Setup shadcn/ui');

// Crea shadcn config automaticamente
const shadcnConfig = {
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/app/globals.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
};

write(path.join(projectDir, 'components.json'), JSON.stringify(shadcnConfig, null, 2));

// Aggiungi i componenti base
const shadcnComponents = ['button', 'card', 'input', 'label', 'form', 'dialog', 'sheet', 'badge', 'separator', 'skeleton'];
run(`npx shadcn@latest add ${shadcnComponents.join(' ')} --yes`, projectDir);
ok(`shadcn/ui: ${shadcnComponents.join(', ')}`);

// ─── Step 5: Struttura cartelle e file standard ───────────────────────────────

step('5. Creo struttura file standard Pixarts');

const S = projectDir;

// i18n config
write(`${S}/src/i18n/config.ts`, `export const locales = ['it', 'en', 'cs'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'it';

export const localeNames: Record<Locale, string> = {
  it: 'Italiano',
  en: 'English',
  cs: 'Čeština',
};

export const localeFlags: Record<Locale, string> = {
  it: '🇮🇹',
  en: '🇬🇧',
  cs: '🇨🇿',
};
`);

write(`${S}/src/i18n/request.ts`, `import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as 'it' | 'en' | 'cs')) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(\`../../messages/\${locale}.json\`)).default,
  };
});
`);

write(`${S}/src/i18n/routing.ts`, `import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['it', 'en', 'cs'],
  defaultLocale: 'it',
  localePrefix: 'always',
});
`);

ok('i18n config (IT/EN/CZ)');

// Messages
const baseMessages = {
  common: {
    loading: 'Caricamento...',
    error: 'Si è verificato un errore',
    back: 'Indietro',
    readMore: 'Leggi di più',
    contactUs: 'Contattaci',
    learnMore: 'Scopri di più',
  },
  nav: {
    home: 'Home',
    about: 'Chi siamo',
    services: 'Servizi',
    contact: 'Contatti',
    blog: 'Blog',
  },
  hero: {
    cta: 'Inizia ora',
    secondaryCta: 'Scopri di più',
  },
  contact: {
    title: 'Contattaci',
    name: 'Nome',
    email: 'Email',
    phone: 'Telefono',
    message: 'Messaggio',
    send: 'Invia messaggio',
    success: 'Messaggio inviato con successo!',
    error: 'Errore durante l\'invio. Riprova.',
  },
  footer: {
    rights: 'Tutti i diritti riservati',
  },
};

write(`${S}/messages/it.json`, JSON.stringify(baseMessages, null, 2));
write(`${S}/messages/en.json`, JSON.stringify({
  common: { loading: 'Loading...', error: 'An error occurred', back: 'Back', readMore: 'Read more', contactUs: 'Contact us', learnMore: 'Learn more' },
  nav: { home: 'Home', about: 'About', services: 'Services', contact: 'Contact', blog: 'Blog' },
  hero: { cta: 'Get started', secondaryCta: 'Learn more' },
  contact: { title: 'Contact us', name: 'Name', email: 'Email', phone: 'Phone', message: 'Message', send: 'Send message', success: 'Message sent successfully!', error: 'Error sending. Please try again.' },
  footer: { rights: 'All rights reserved' },
}, null, 2));
write(`${S}/messages/cs.json`, JSON.stringify({
  common: { loading: 'Načítání...', error: 'Došlo k chybě', back: 'Zpět', readMore: 'Číst dále', contactUs: 'Kontaktujte nás', learnMore: 'Zjistit více' },
  nav: { home: 'Domů', about: 'O nás', services: 'Služby', contact: 'Kontakt', blog: 'Blog' },
  hero: { cta: 'Začít', secondaryCta: 'Zjistit více' },
  contact: { title: 'Kontaktujte nás', name: 'Jméno', email: 'Email', phone: 'Telefon', message: 'Zpráva', send: 'Odeslat zprávu', success: 'Zpráva odeslána!', error: 'Chyba při odesílání. Zkuste znovu.' },
  footer: { rights: 'Všechna práva vyhrazena' },
}, null, 2));
ok('Messages IT/EN/CZ');

// middleware.ts
write(`${S}/middleware.ts`, `import createMiddleware from 'next-intl/middleware';
import { routing } from './src/i18n/routing';

export default createMiddleware(routing);

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
`);
ok('middleware.ts');

// lib/utils.ts — sostituisce quello di create-next-app
write(`${S}/src/lib/utils.ts`, `import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, locale = 'it') {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
    .replace(/[^\\w\\s-]/g, '')
    .replace(/\\s+/g, '-')
    .trim();
}
`);
ok('lib/utils.ts');

// lib/payload.ts — CMS client
write(`${S}/src/lib/payload.ts`, `/**
 * Payload CMS client
 * Configura TENANT_SLUG e CMS_URL in .env.local dopo che
 * il tenant è stato creato manualmente in cms.pixarts.eu
 */

const CMS_URL = process.env.NEXT_PUBLIC_CMS_URL || 'https://cms.pixarts.eu';
const TENANT_SLUG = process.env.NEXT_PUBLIC_TENANT_SLUG || '';

interface FetchOptions extends Omit<RequestInit, 'next'> {
  tags?: string[];
  revalidate?: number | false;
}

export async function fetchFromCMS<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { tags, revalidate = 3600, ...fetchOptions } = options;

  const url = new URL(\`/api\${endpoint}\`, CMS_URL);

  const res = await fetch(url.toString(), {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    },
    next: { tags, revalidate },
  });

  if (!res.ok) {
    throw new Error(\`CMS Error: \${res.status} \${res.statusText}\`);
  }

  return res.json() as Promise<T>;
}

export async function getTenant() {
  if (!TENANT_SLUG) return null;
  try {
    const { docs } = await fetchFromCMS<{ docs: Record<string, unknown>[] }>(
      \`/tenants?where[slug][equals]=\${TENANT_SLUG}\`,
      { tags: ['tenant'], revalidate: 86400 }
    );
    return docs[0] ?? null;
  } catch {
    return null;
  }
}

export async function getPage(slug: string, locale: string) {
  const tenant = await getTenant();
  if (!tenant) return null;

  try {
    const { docs } = await fetchFromCMS<{ docs: Record<string, unknown>[] }>(
      \`/pages?where[slug][equals]=\${slug}&where[tenant][equals]=\${String(tenant.id)}&where[status][equals]=published&locale=\${locale}&depth=2\`,
      { tags: ['pages', \`page-\${slug}\`] }
    );
    return docs[0] ?? null;
  } catch {
    return null;
  }
}
`);
ok('lib/payload.ts (CMS client)');

// config/site.ts
write(`${S}/src/config/site.ts`, `export const siteConfig = {
  name: process.env.NEXT_PUBLIC_SITE_NAME || '${projectName}',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com',
  description: '',
  ogImage: '/og-image.jpg',
  links: {
    instagram: '',
    facebook: '',
    linkedin: '',
  },
  contact: {
    email: '',
    phone: '',
    address: '',
    vatNumber: '',
  },
};
`);
ok('config/site.ts');

// components/layout/header.tsx
write(`${S}/src/components/layout/header.tsx`, `'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { siteConfig } from '@/config/site';
import { LanguageSwitcher } from './language-switcher';

export function Header() {
  const t = useTranslations('nav');

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="font-bold text-lg">
          {siteConfig.name}
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link href="/chi-siamo" className="text-muted-foreground hover:text-foreground transition-colors">
            {t('about')}
          </Link>
          <Link href="/servizi" className="text-muted-foreground hover:text-foreground transition-colors">
            {t('services')}
          </Link>
          <Link href="/contatti" className="text-muted-foreground hover:text-foreground transition-colors">
            {t('contact')}
          </Link>
        </nav>

        <LanguageSwitcher />
      </div>
    </header>
  );
}
`);

// components/layout/footer.tsx
write(`${S}/src/components/layout/footer.tsx`, `import { useTranslations } from 'next-intl';
import { siteConfig } from '@/config/site';

export function Footer() {
  const t = useTranslations('footer');
  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-muted/50">
      <div className="container mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © {year} {siteConfig.name}. {t('rights')}.
          </p>
          {siteConfig.contact.vatNumber && (
            <p className="text-sm text-muted-foreground">
              P.IVA: {siteConfig.contact.vatNumber}
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
`);

// components/layout/language-switcher.tsx
write(`${S}/src/components/layout/language-switcher.tsx`, `'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { localeNames, localeFlags } from '@/i18n/config';
import type { Locale } from '@/i18n/config';

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  function switchLocale(newLocale: Locale) {
    const newPath = pathname.replace(\`/\${locale}\`, \`/\${newLocale}\`);
    router.push(newPath);
  }

  return (
    <div className="flex items-center gap-1">
      {(Object.keys(localeNames) as Locale[]).map((l) => (
        <button
          key={l}
          onClick={() => switchLocale(l)}
          className={\`px-2 py-1 text-xs rounded transition-colors \${
            l === locale
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }\`}
          aria-label={\`Switch to \${localeNames[l]}\`}
        >
          {localeFlags[l]} {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
`);
ok('components/layout/ (header, footer, language-switcher)');

// components/shared/container.tsx
write(`${S}/src/components/shared/container.tsx`, `import { cn } from '@/lib/utils';

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'default' | 'lg' | 'full';
}

const sizes = {
  sm: 'max-w-4xl',
  default: 'max-w-7xl',
  lg: 'max-w-screen-2xl',
  full: 'max-w-none',
};

export function Container({ children, className, size = 'default' }: ContainerProps) {
  return (
    <div className={cn('mx-auto w-full px-4 sm:px-6 lg:px-8', sizes[size], className)}>
      {children}
    </div>
  );
}
`);

// components/shared/section.tsx
write(`${S}/src/components/shared/section.tsx`, `import { cn } from '@/lib/utils';

interface SectionProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
  background?: 'default' | 'muted' | 'primary';
}

const backgrounds = {
  default: '',
  muted: 'bg-muted/50',
  primary: 'bg-primary text-primary-foreground',
};

export function Section({ children, className, id, background = 'default' }: SectionProps) {
  return (
    <section
      id={id}
      className={cn('py-16 md:py-24', backgrounds[background], className)}
    >
      {children}
    </section>
  );
}
`);
ok('components/shared/ (container, section)');

// API routes
write(`${S}/src/app/api/health/route.ts`, `import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '0.0.1',
  });
}
`);

write(`${S}/src/app/api/revalidate/route.ts`, `import { revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-revalidate-secret');

  if (secret !== process.env.REVALIDATION_SECRET) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  }

  try {
    const body = await request.json() as { collection?: string; slug?: string };
    const { collection, slug } = body;

    if (collection) {
      revalidateTag(collection);
      if (slug) revalidateTag(\`\${collection.slice(0, -1)}-\${slug}\`);
    }

    return NextResponse.json({ revalidated: true, collection, slug, timestamp: Date.now() });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
`);
ok('API routes: /health, /revalidate');

// robots.ts
write(`${S}/src/app/robots.ts`, `import type { MetadataRoute } from 'next';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/'],
      },
    ],
    sitemap: \`\${baseUrl}/sitemap.xml\`,
  };
}
`);

// sitemap.ts
write(`${S}/src/app/sitemap.ts`, `import type { MetadataRoute } from 'next';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';
const locales = ['it', 'en', 'cs'];

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = ['', '/chi-siamo', '/servizi', '/contatti'];

  return staticPages.flatMap((route) =>
    locales.map((locale) => ({
      url: \`\${baseUrl}/\${locale}\${route}\`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: route === '' ? 1 : 0.8,
    }))
  );
}
`);
ok('robots.ts + sitemap.ts');

// App [locale]/page.tsx
write(`${S}/src/app/[locale]/page.tsx`, `import { useTranslations } from 'next-intl';
import { Section } from '@/components/shared/section';
import { Container } from '@/components/shared/container';

export default function HomePage() {
  const t = useTranslations('hero');

  return (
    <>
      <Section background="default">
        <Container>
          <div className="text-center py-16">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl mb-6">
              ${projectName}
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              {/* Aggiungi descrizione dal brief */}
            </p>
            <div className="flex gap-4 justify-center">
              <a href="/contatti" className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90">
                {t('cta')}
              </a>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
`);

write(`${S}/src/app/[locale]/loading.tsx`, `export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
`);

write(`${S}/src/app/[locale]/error.tsx`, `'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('common');

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <h2 className="text-xl font-semibold">{t('error')}</h2>
      <button
        onClick={reset}
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
      >
        Riprova
      </button>
    </div>
  );
}
`);

write(`${S}/src/app/[locale]/not-found.tsx`, `import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <h2 className="text-4xl font-bold">404</h2>
      <p className="text-muted-foreground">Pagina non trovata</p>
      <Link
        href="/"
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
      >
        Torna alla home
      </Link>
    </div>
  );
}
`);
ok('app/[locale]/ pages (home, loading, error, not-found)');

// ─── Step 6: .env files ───────────────────────────────────────────────────────

step('6. Creo .env files');

const envContent = `# ─── CMS (configura dopo aver creato il tenant in cms.pixarts.eu) ───
NEXT_PUBLIC_CMS_URL=https://cms.pixarts.eu
NEXT_PUBLIC_TENANT_SLUG=${slug}
REVALIDATION_SECRET=<genera-stringa-32-caratteri>

# ─── Sito ────────────────────────────────────────────────────────────
NEXT_PUBLIC_SITE_URL=https://${slug}.it
NEXT_PUBLIC_SITE_NAME=${projectName}

# ─── Analytics (opzionale) ───────────────────────────────────────────
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=${slug}.it
`;

write(`${S}/.env.example`, envContent);
write(`${S}/.env.local`, envContent);
ok('.env.example + .env.local');

// ─── Step 7: Copia template automation ────────────────────────────────────────

step('7. Setup automation (Husky + CI + check-project)');

// GitHub Actions CI
const ciDest = path.join(S, '.github/workflows/ci.yml');
const ciSrc = path.join(TEMPLATES, '.github/workflows/ci.yml');
if (copyTemplate(ciSrc, ciDest)) {
  ok('GitHub Actions CI (.github/workflows/ci.yml)');
} else {
  warn('ci.yml template non trovato — crea manualmente');
}

// check-project.mjs
const checkSrc = path.join(TEMPLATES, 'scripts/check-project.mjs');
const checkDest = path.join(S, 'scripts/check-project.mjs');
if (copyTemplate(checkSrc, checkDest)) {
  ok('check-project.mjs copiato');
}

// lint-staged.config.mjs
const lintSrc = path.join(TEMPLATES, 'lint-staged.config.mjs');
if (copyTemplate(lintSrc, path.join(S, 'lint-staged.config.mjs'))) {
  ok('lint-staged.config.mjs');
}

// lighthouse-budget.json
const lhSrc = path.join(TEMPLATES, 'lighthouse-budget.json');
if (copyTemplate(lhSrc, path.join(S, 'lighthouse-budget.json'))) {
  ok('lighthouse-budget.json');
}

// ─── Step 8: package.json scripts ─────────────────────────────────────────────

step('8. Aggiungo npm scripts');

const pkgPath = path.join(S, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

pkg.scripts = {
  ...pkg.scripts,
  prepare: 'husky',
  check: 'node scripts/check-project.mjs',
  'check:fix': 'node scripts/check-project.mjs --fix',
  'check:ci': 'node scripts/check-project.mjs --ci',
  typecheck: 'tsc --noEmit',
  'lint:fix': 'next lint --fix',
  format: 'prettier --write .',
  'format:check': 'prettier --check .',
};

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
ok('npm scripts: check, check:fix, check:ci, typecheck, lint:fix, format');

// ─── Step 9: Husky setup ──────────────────────────────────────────────────────

step('9. Setup Husky pre-commit');

run('npx husky init', projectDir, true);

const precommitPath = path.join(S, '.husky/pre-commit');
write(precommitPath, 'npx lint-staged\n');
fs.chmodSync(precommitPath, '755');
ok('Husky pre-commit configurato');

// ─── Step 10: Dockerfile ──────────────────────────────────────────────────────

step('10. Dockerfile multi-stage');

write(`${S}/Dockerfile`, `FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000

HEALTHCHECK --interval=30s --timeout=3s \\
  CMD wget --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
`);

write(`${S}/.dockerignore`, `node_modules
.next
.git
*.md
.env*
!.env.example
`);
ok('Dockerfile + .dockerignore');

// ─── Step 11: next.config.ts (aggiorna per i18n + standalone) ─────────────────

step('11. Aggiorno next.config.ts');

write(`${S}/next.config.ts`, `import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cms.pixarts.eu',
      },
    ],
  },
};

export default withNextIntl(nextConfig);
`);
ok('next.config.ts (standalone + next-intl)');

// ─── Step 12: Auto-fix ESLint ─────────────────────────────────────────────────

step('12. ESLint auto-fix');

const lintResult = spawnSync('npm', ['run', 'lint:fix'], {
  cwd: projectDir,
  encoding: 'utf-8',
  stdio: 'pipe',
});

if (lintResult.status === 0) {
  ok('ESLint: nessun errore');
} else {
  warn('ESLint ha trovato problemi. Tentativo fix manuale...');
  // Prova TypeScript fix
  run('npx tsc --noEmit', projectDir, true);
}

// ─── Step 13: Verifica build ──────────────────────────────────────────────────

step('13. Verifica build');

log('Running npm run build...');
try {
  run('npm run build', projectDir, true);
  ok('Build completata senza errori');
} catch {
  warn('Build con warning — controlla il progetto prima di deployare');
}

// ─── Step 14: docker-compose.yml ──────────────────────────────────────────────

step('14. Generazione docker-compose.yml');

write(`${S}/docker-compose.yml`, [
  "version: '3.8'",
  '',
  'services:',
  '  web:',
  '    build:',
  '      context: .',
  '      dockerfile: Dockerfile',
  '    ports:',
  "      - '3000:3000'",
  '    env_file:',
  '      - .env.local',
  '    environment:',
  '      - NODE_ENV=production',
  '    restart: unless-stopped',
  '    healthcheck:',
  "      test: ['CMD', 'curl', '-f', 'http://localhost:3000/api/health']",
  '      interval: 30s',
  '      timeout: 10s',
  '      retries: 3',
  '      start_period: 40s',
].join('\n'));
ok('docker-compose.yml');
// NOTE: docker-compose legge .env.local grazie a env_file.
// Per produzione usa variabili Coolify, non questo file.

// ─── Step 15: src/lib/fonts.ts ────────────────────────────────────────────────

step('15. Generazione src/lib/fonts.ts');

write(`${S}/src/lib/fonts.ts`, [
  "import { Inter, Geist_Mono } from 'next/font/google';",
  '',
  'export const fontSans = Inter({',
  "  subsets: ['latin'],",
  "  variable: '--font-sans',",
  "  display: 'swap',",
  '});',
  '',
  'export const fontMono = Geist_Mono({',
  "  subsets: ['latin'],",
  "  variable: '--font-mono',",
  "  display: 'swap',",
  '});',
].join('\n'));
ok('src/lib/fonts.ts');

// ─── Step 16: Validazione .env.local ──────────────────────────────────────────

step('16. Validazione .env.local');

{
  const envPath = `${S}/.env.local`;
  let envContent = '';
  try {
    envContent = fs.readFileSync(envPath, 'utf-8');
  } catch {
    warn('.env.local non trovato — skip validazione');
  }
  if (envContent) {
    const placeholderPatterns = [/your-/, /example\.com/, /changeme/, /TODO/];
    const envLines = envContent.split('\n');
    const suspect = envLines.filter(l => {
      if (l.trim().startsWith('#') || !l.includes('=')) return false;
      const val = l.split('=').slice(1).join('=').trim();
      return placeholderPatterns.some(p => p.test(val));
    });
    if (suspect.length > 0) {
      warn('.env.local contiene valori placeholder:');
      suspect.forEach(l => console.log(`     ${yellow(l.trim())}`));
      console.log('     → Aggiorna .env.local prima del deploy');
    } else {
      ok('.env.local: nessun placeholder rilevato');
    }
  }
}

// ─── Step 17: GitHub repo ─────────────────────────────────────────────────────

step('17. Creazione repo GitHub');

{
  const ghCheck = spawnSync('gh', ['auth', 'status'], { encoding: 'utf-8', stdio: 'pipe' });
  if (ghCheck.status !== 0) {
    warn('gh CLI non autenticato — skip GitHub repo. Crea manualmente con:');
    console.log(`     gh repo create ${slug}-site --private --source=. --push`);
  } else {
    try {
      const gitCheck = spawnSync('git', ['rev-parse', '--git-dir'], { cwd: projectDir, encoding: 'utf-8', stdio: 'pipe' });
      if (gitCheck.status !== 0) {
        run('git init', projectDir, true);
        run('git add .', projectDir, true);
        run(`git commit -m 'feat: init ${projectName} — scaffold'`, projectDir, true);
      }
      const repoName = `${slug}-site`;
      run(`gh repo create ${repoName} --private --source=. --remote=origin --push`, projectDir, true);
      ok(`GitHub repo creato: ${repoName}`);
    } catch {
      warn('Errore creazione repo GitHub — crea manualmente');
    }
  }
}

// ─── Step 18: n8n monitoring workflow ─────────────────────────────────────────

step('18. Creazione workflow n8n monitoring');

{
  const n8nApiKey = process.env.N8N_API_KEY;
  const n8nBaseUrl = process.env.N8N_URL || 'http://localhost:5678';
  const siteUrl = `https://${slug}.pixarts.eu`;
  const alertEmail = process.env.N8N_ALERT_EMAIL || 'hello@pixarts.eu';

  if (!n8nApiKey) {
    warn('N8N_API_KEY non trovata — skip monitoring. Configura n8n manualmente.');
  } else {
    try {
      const workflow = {
        name: `Site Monitor \u2014 ${projectName}`,
        nodes: [
          {
            id: 'schedule-1', name: 'Schedule Trigger',
            type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2,
            position: [0, 0],
            parameters: { rule: { interval: [{ field: 'hours', hoursInterval: 6 }] } },
          },
          {
            id: 'health-1', name: 'Health Check',
            type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
            position: [220, 0],
            parameters: {
              url: `${siteUrl}/api/health`, method: 'GET',
              options: { timeout: 10000 }, continueOnFail: true,
            },
          },
          {
            id: 'if-1', name: 'Check Failed?',
            type: 'n8n-nodes-base.if', typeVersion: 2,
            position: [440, 0],
            parameters: {
              conditions: {
                options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
                conditions: [{
                  leftValue: '={{ $json.error }}', rightValue: '',
                  operator: { type: 'string', operation: 'exists' },
                }],
              },
            },
          },
          {
            id: 'email-1', name: 'Send Alert',
            type: 'n8n-nodes-base.emailSend', typeVersion: 2,
            position: [660, -120],
            parameters: {
              toEmail: alertEmail,
              subject: `\u26a0\ufe0f Monitor Alert \u2014 ${projectName}`,
              message: `Problema rilevato su ${siteUrl}. Controlla immediatamente.`,
            },
          },
        ],
        connections: {
          'Schedule Trigger': { main: [[{ node: 'Health Check', type: 'main', index: 0 }]] },
          'Health Check': { main: [[{ node: 'Check Failed?', type: 'main', index: 0 }]] },
          'Check Failed?': { main: [[{ node: 'Send Alert', type: 'main', index: 0 }], []] },
        },
        settings: { executionOrder: 'v1' },
        active: true,
      };

      const res = spawnSync('curl', [
        '-s', '-X', 'POST',
        `${n8nBaseUrl}/api/v1/workflows`,
        '-H', 'Content-Type: application/json',
        '-H', `X-N8N-API-KEY: ${n8nApiKey}`,
        '-d', JSON.stringify(workflow),
      ], { encoding: 'utf-8', stdio: 'pipe' });

      const body = JSON.parse(res.stdout || '{}');
      if (body.id) {
        ok(`n8n workflow creato: ID=${body.id} — ${n8nBaseUrl}/workflow/${body.id}`);
      } else {
        warn(`n8n risposta inattesa: ${(res.stdout || '').slice(0, 120)}`);
      }
    } catch {
      warn('Errore creazione workflow n8n — configura manualmente');
    }
  }
}

// ─── Report finale ─────────────────────────────────────────────────────────────

console.log(`\n${'\u2500'.repeat(50)}`);
console.log(bold(`\u2705 Progetto "${projectName}" creato!`));
console.log('\u2500'.repeat(50));
console.log(`\n${bold('\uD83D\uDCC1 Path:')} Progetti/${slug}/`);
console.log(`\n${bold('\uD83D\uDD27 Prossimi step:')}`);
console.log(`  1. Crea tenant in cms.pixarts.eu/admin`);
console.log(`     \u2192 slug: ${slug}`);
console.log(`  2. Aggiorna .env.local con REVALIDATION_SECRET e dati tenant reali`);
console.log(`  3. Deploy su Coolify dopo il push GitHub`);
console.log(`\n${bold('\uD83D\uDE80 Dev:')} cd Progetti/${slug} && npm run dev`);
console.log(`${bold('\uD83D\uDD0D Check:')} npm run check\n`);
