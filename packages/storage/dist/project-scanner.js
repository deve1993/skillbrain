/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */
/**
 * Scan a workspace directory to auto-detect project metadata.
 * Reads package.json, git, config files, .env.example to deduce
 * stack, repo, CMS, DB, deploy platform, integrations.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
function safeRead(p) {
    try {
        return fs.readFileSync(p, 'utf-8');
    }
    catch {
        return null;
    }
}
function safeExec(cmd, cwd) {
    try {
        return execSync(cmd, { cwd, stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf-8' }).trim();
    }
    catch {
        return null;
    }
}
export function scanProject(workspacePath) {
    const detected = {
        name: path.basename(workspacePath),
        stack: [],
        hasCi: false,
        integrations: {},
        envVarNames: [],
    };
    // ── package.json ──
    const pkgContent = safeRead(path.join(workspacePath, 'package.json'));
    let pkg = null;
    if (pkgContent) {
        try {
            pkg = JSON.parse(pkgContent);
        }
        catch { }
    }
    if (pkg) {
        if (pkg.name)
            detected.name = pkg.name;
        if (pkg.engines?.node)
            detected.nodeVersion = pkg.engines.node;
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        // Language
        if (deps.typescript || fs.existsSync(path.join(workspacePath, 'tsconfig.json'))) {
            detected.language = 'TypeScript';
        }
        else {
            detected.language = 'JavaScript';
        }
        // Package manager
        if (fs.existsSync(path.join(workspacePath, 'pnpm-lock.yaml')))
            detected.packageManager = 'pnpm';
        else if (fs.existsSync(path.join(workspacePath, 'bun.lockb')) || fs.existsSync(path.join(workspacePath, 'bun.lock')))
            detected.packageManager = 'bun';
        else if (fs.existsSync(path.join(workspacePath, 'yarn.lock')))
            detected.packageManager = 'yarn';
        else
            detected.packageManager = 'npm';
        // Framework stack
        if (deps.next)
            detected.stack.push(`Next.js ${deps.next.replace(/[^0-9.]/g, '').split('.')[0]}+`);
        if (deps.react && !deps.next)
            detected.stack.push('React');
        if (deps.astro)
            detected.stack.push('Astro');
        if (deps.nuxt)
            detected.stack.push('Nuxt');
        if (deps['@sveltejs/kit'])
            detected.stack.push('SvelteKit');
        if (deps['react-native'])
            detected.stack.push('React Native');
        if (deps.expo)
            detected.stack.push('Expo');
        // Styling
        if (deps.tailwindcss)
            detected.stack.push(`Tailwind ${deps.tailwindcss.replace(/[^0-9.]/g, '').split('.')[0]}`);
        if (deps['@radix-ui/react-dialog'])
            detected.stack.push('shadcn/ui');
        // i18n
        if (deps['next-intl'])
            detected.stack.push('next-intl');
        // CMS detection
        if (deps.payload || deps['@payloadcms/next']) {
            detected.cmsType = 'Payload';
            detected.cmsAdminUrl = '/admin';
            detected.stack.push('Payload CMS');
        }
        if (deps['@sanity/client'] || deps.sanity) {
            detected.cmsType = 'Sanity';
        }
        if (deps['@strapi/strapi'])
            detected.cmsType = 'Strapi';
        if (deps['@directus/sdk'])
            detected.cmsType = 'Directus';
        // DB detection
        if (deps.mongoose || deps.mongodb)
            detected.dbType = 'MongoDB';
        if (deps['@prisma/client']) {
            const schema = safeRead(path.join(workspacePath, 'prisma', 'schema.prisma'));
            if (schema?.includes('provider = "postgresql"'))
                detected.dbType = 'PostgreSQL (Prisma)';
            else if (schema?.includes('provider = "mysql"'))
                detected.dbType = 'MySQL (Prisma)';
            else if (schema?.includes('provider = "sqlite"'))
                detected.dbType = 'SQLite (Prisma)';
            else
                detected.dbType = 'Database (Prisma)';
        }
        if (deps['@supabase/supabase-js'])
            detected.dbType = 'Supabase';
        if (deps['drizzle-orm'])
            detected.dbType = detected.dbType || 'Database (Drizzle)';
        // Integrations
        if (deps.stripe || deps['@stripe/stripe-js'])
            detected.integrations.payments = 'Stripe';
        if (deps['@lemonsqueezy/lemonsqueezy.js'])
            detected.integrations.payments = 'LemonSqueezy';
        if (deps.resend)
            detected.integrations.email = 'Resend';
        if (deps.nodemailer)
            detected.integrations.email = 'Nodemailer';
        if (deps['@sentry/nextjs'] || deps['@sentry/node'])
            detected.integrations.monitoring = 'Sentry';
        if (deps.posthog || deps['posthog-js'] || deps['posthog-node'])
            detected.integrations.analytics = 'PostHog';
        if (deps['plausible-tracker'])
            detected.integrations.analytics = 'Plausible';
        if (deps['next/third-parties'])
            detected.integrations.analytics = detected.integrations.analytics || 'Google Analytics';
        if (deps.pusher || deps['pusher-js'])
            detected.integrations.realtime = 'Pusher';
        if (deps['socket.io'])
            detected.integrations.realtime = 'Socket.IO';
        if (deps.bullmq)
            detected.integrations.queue = 'BullMQ';
        if (deps.inngest)
            detected.integrations.queue = 'Inngest';
    }
    // ── Git ──
    if (fs.existsSync(path.join(workspacePath, '.git'))) {
        const remote = safeExec('git remote get-url origin 2>/dev/null', workspacePath);
        if (remote) {
            // Normalize: git@github.com:user/repo.git → https://github.com/user/repo
            detected.repoUrl = remote
                .replace(/^git@([^:]+):/, 'https://$1/')
                .replace(/\.git$/, '');
        }
        const branch = safeExec('git branch --show-current', workspacePath);
        if (branch)
            detected.mainBranch = branch;
        const firstCommit = safeExec('git log --reverse --format="%aI" | head -1', workspacePath);
        if (firstCommit)
            detected.startedAt = firstCommit;
    }
    // ── .env.example ──
    const envExample = safeRead(path.join(workspacePath, '.env.example')) || safeRead(path.join(workspacePath, '.env.local.example'));
    if (envExample) {
        const names = envExample
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l && !l.startsWith('#'))
            .map((l) => l.split('=')[0].trim())
            .filter((n) => n && /^[A-Z][A-Z0-9_]*$/i.test(n));
        detected.envVarNames = [...new Set(names)];
    }
    // ── Deploy platform ──
    if (fs.existsSync(path.join(workspacePath, 'Dockerfile')))
        detected.deployPlatform = 'Coolify/Docker';
    if (fs.existsSync(path.join(workspacePath, 'vercel.json')))
        detected.deployPlatform = 'Vercel';
    if (fs.existsSync(path.join(workspacePath, 'netlify.toml')))
        detected.deployPlatform = 'Netlify';
    if (fs.existsSync(path.join(workspacePath, 'railway.json')))
        detected.deployPlatform = 'Railway';
    if (fs.existsSync(path.join(workspacePath, 'fly.toml')))
        detected.deployPlatform = 'Fly.io';
    // CI
    if (fs.existsSync(path.join(workspacePath, '.github', 'workflows'))) {
        const files = safeExec('ls .github/workflows 2>/dev/null', workspacePath);
        detected.hasCi = !!files;
    }
    // ── Legal / cookie banner ──
    if (pkg) {
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (Object.keys(deps).some((d) => d.includes('iubenda')))
            detected.legalCookieBanner = 'Iubenda';
        if (Object.keys(deps).some((d) => d.includes('cookiefirst')))
            detected.legalCookieBanner = 'CookieFirst';
    }
    // ── Missing fields ──
    const missing = [];
    if (!detected.displayName)
        missing.push({ field: 'displayName', prompt: 'Qual e\' il nome da mostrare per questo progetto? (es. "Terrae e Mare")' });
    missing.push({ field: 'clientName', prompt: 'Chi e\' il cliente? (es. "Trattoria Mario", oppure "interno" se non c\'e\')' });
    if (!detected.cmsAdminUrl || detected.cmsAdminUrl === '/admin') {
        missing.push({ field: 'cmsAdminUrl', prompt: `Qual e\' l'URL completo dell'admin ${detected.cmsType || 'CMS'}? (es. https://site.it/admin)` });
    }
    missing.push({ field: 'liveUrl', prompt: 'Qual e\' l\'URL live del sito? (es. https://terraemare.it)' });
    if (detected.dbType)
        missing.push({ field: 'dbReference', prompt: `Reference del ${detected.dbType} (es. "Atlas cluster pixarts-prod")` });
    missing.push({ field: 'category', prompt: 'Categoria progetto? (landing / ecommerce / app / dashboard / corporate-site)' });
    return { detected, missing };
}
//# sourceMappingURL=project-scanner.js.map