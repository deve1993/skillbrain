#!/usr/bin/env node

/**
 * Pixarts — Aggiorna Progetto Client Esistente
 *
 * Uso: node .Claude/scripts/update-project.mjs "Nome Cliente" [--deps-only] [--check-only] [--no-build]
 *
 * Esegue:
 *  1. Verifica che Progetti/<slug>/ esista
 *  2. npm outdated + npm update (patch/minor)
 *  3. npm audit fix
 *  4. Aggiorna template CI/CD se obsoleto
 *  5. Verifica Husky + lint-staged
 *  6. npm run lint:fix
 *  7. npm run build
 *  8. node scripts/check-project.mjs
 *  9. Salva log in .client-briefs/<slug>/update-log.md
 */

import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE = path.resolve(__dirname, '../..');
const PROGETTI = path.join(WORKSPACE, 'Progetti');
const TEMPLATES = path.join(WORKSPACE, '.Claude/templates/project-automation');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

function log(msg) { console.log(`  ${msg}`); }
function ok(msg) { console.log(`  ${green('✓')} ${msg}`); }
function warn(msg) { console.log(`  ${yellow('⚠')} ${msg}`); }
function fail(msg) { console.log(`  ${red('✗')} ${msg}`); }
function step(msg) { console.log(`\n${bold(msg)}`); }

function run(cmd, cwd, silent = false) {
  const opts = {
    cwd,
    encoding: 'utf-8',
    stdio: silent ? 'pipe' : 'inherit',
    shell: '/bin/sh',
    env: { ...process.env, PATH: process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin' },
  };
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

// ─── Parse args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const projectName = args.find(a => !a.startsWith('--'));
const depsOnly = args.includes('--deps-only');
const checkOnly = args.includes('--check-only');
const noBuild = args.includes('--no-build');

if (!projectName) {
  console.error(red('\nUso: node .Claude/scripts/update-project.mjs "Nome Cliente" [--deps-only] [--check-only] [--no-build]\n'));
  process.exit(1);
}

const slug = slugify(projectName);
const projectDir = path.join(PROGETTI, slug);
const S = projectDir;

// ─── Verifica progetto esiste ─────────────────────────────────────────────────

if (!fs.existsSync(projectDir)) {
  console.error(red(`\nProgetto non trovato: Progetti/${slug}/`));
  console.error(dim(`  Progetti disponibili:`));
  try {
    fs.readdirSync(PROGETTI).forEach(d => console.error(dim(`    - ${d}`)));
  } catch { /* ignore */ }
  process.exit(1);
}

// ─── Log setup ────────────────────────────────────────────────────────────────

const briefDir = path.join(WORKSPACE, '.client-briefs', slug);
fs.mkdirSync(briefDir, { recursive: true });
const logPath = path.join(briefDir, 'update-log.md');
const logLines = [`# Update Log: ${projectName}`, ``, `**Data**: ${new Date().toISOString().slice(0, 10)}`, ``];
function logEntry(entry) { logLines.push(entry); }

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(bold(`🔄 Aggiornamento "${projectName}"`));
console.log(dim(`   Path: Progetti/${slug}/`));
console.log('─'.repeat(50));

// ─── Read brief if available ──────────────────────────────────────────────────

const briefPath = path.join(briefDir, 'brief.json');
if (fs.existsSync(briefPath)) {
  try {
    const brief = JSON.parse(fs.readFileSync(briefPath, 'utf-8'));
    log(dim(`Brief trovato: ${brief.project?.name || slug}`));
  } catch { /* ignore */ }
}

// ─── STEP 1: Dipendenze ───────────────────────────────────────────────────────

if (!checkOnly) {
  step('1. Aggiornamento dipendenze');

  // npm outdated
  const outdated = spawnSync('npm', ['outdated', '--json'], {
    cwd: projectDir, encoding: 'utf-8', stdio: 'pipe',
  });

  let outdatedData = {};
  try { outdatedData = JSON.parse(outdated.stdout || '{}'); } catch { /* ignore */ }
  const outdatedPkgs = Object.keys(outdatedData);

  if (outdatedPkgs.length === 0) {
    ok('Tutte le dipendenze sono aggiornate');
    logEntry('## Dipendenze\n\n- Tutte aggiornate ✓');
  } else {
    // Separate major from patch/minor
    const majorUpdates = [];
    const safeUpdates = [];

    for (const [pkg, info] of Object.entries(outdatedData)) {
      const current = info.current || '0.0.0';
      const wanted = info.wanted || current;
      const latest = info.latest || current;
      const currentMajor = parseInt(current.split('.')[0]);
      const latestMajor = parseInt(latest.split('.')[0]);

      if (latestMajor > currentMajor) {
        majorUpdates.push({ pkg, current, wanted, latest });
      } else {
        safeUpdates.push({ pkg, current, wanted, latest });
      }
    }

    // Apply safe updates silently
    if (safeUpdates.length > 0) {
      run('npm update', projectDir, true);
      ok(`Aggiornati ${safeUpdates.length} pacchetti (patch/minor):`);
      safeUpdates.forEach(({ pkg, current, latest }) =>
        log(dim(`  ${pkg}: ${current} → ${latest}`))
      );
      logEntry(`## Dipendenze\n\n### Aggiornati (patch/minor)\n${safeUpdates.map(p => `- ${p.pkg}: ${p.current} → ${p.latest}`).join('\n')}`);
    }

    // Warn about major updates - don't auto-apply
    if (majorUpdates.length > 0) {
      warn(`${majorUpdates.length} aggiornamenti MAJOR disponibili (non applicati automaticamente):`);
      majorUpdates.forEach(({ pkg, current, latest }) =>
        log(`  ${yellow(pkg)}: ${current} → ${yellow(latest)} (major - controlla breaking changes)`)
      );
      logEntry(`\n### Major disponibili (non aggiornati)\n${majorUpdates.map(p => `- ${p.pkg}: ${p.current} → ${p.latest}`).join('\n')}`);
    }
  }

  // npm audit fix
  log('Eseguo npm audit fix...');
  const audit = spawnSync('npm', ['audit', 'fix'], {
    cwd: projectDir, encoding: 'utf-8', stdio: 'pipe',
  });
  if (audit.status === 0) {
    ok('npm audit fix completato');
    logEntry('\n### Audit\n\n- npm audit fix: OK ✓');
  } else {
    warn('npm audit fix: vulnerabilità residue (potrebbe richiedere --force)');
    logEntry('\n### Audit\n\n- npm audit fix: vulnerabilita residue ⚠');
  }
}

// ─── STEP 2: Aggiorna CI/CD template ─────────────────────────────────────────

if (!depsOnly && !checkOnly) {
  step('2. Verifica automation template');

  const ciSrc = path.join(TEMPLATES, '.github/workflows/ci.yml');
  const ciDest = path.join(projectDir, '.github/workflows/ci.yml');

  if (!fs.existsSync(ciDest)) {
    if (fs.existsSync(ciSrc)) {
      fs.mkdirSync(path.dirname(ciDest), { recursive: true });
      fs.copyFileSync(ciSrc, ciDest);
      ok('ci.yml aggiunto (era mancante)');
      logEntry('\n## Automation\n\n- ci.yml: aggiunto (era mancante)');
    }
  } else {
    // Check if template is newer than project file
    const srcMtime = fs.statSync(ciSrc).mtimeMs;
    const destMtime = fs.statSync(ciDest).mtimeMs;
    if (srcMtime > destMtime) {
      fs.copyFileSync(ciSrc, ciDest);
      ok('ci.yml aggiornato al template corrente');
      logEntry('\n## Automation\n\n- ci.yml: aggiornato al template corrente');
    } else {
      ok('ci.yml aggiornato');
    }
  }

  // Verifica Husky
  const huskyDir = path.join(projectDir, '.husky');
  if (!fs.existsSync(huskyDir)) {
    warn('Husky non configurato — esegui: npx husky init');
    logEntry('\n- Husky: non configurato ⚠');
  } else {
    ok('Husky configurato');
  }

  // Verifica check-project.mjs
  const checkScript = path.join(projectDir, 'scripts/check-project.mjs');
  const checkSrc = path.join(TEMPLATES, 'scripts/check-project.mjs');
  if (!fs.existsSync(checkScript) && fs.existsSync(checkSrc)) {
    fs.mkdirSync(path.dirname(checkScript), { recursive: true });
    fs.copyFileSync(checkSrc, checkScript);
    ok('scripts/check-project.mjs aggiunto');
    logEntry('\n- check-project.mjs: aggiunto');
  }
}

// ─── STEP 3: Lint fix ────────────────────────────────────────────────────────

if (!depsOnly && !checkOnly) {
  step('3. ESLint auto-fix');

  const lintResult = spawnSync('npm', ['run', 'lint:fix'], {
    cwd: projectDir, encoding: 'utf-8', stdio: 'pipe',
  });
  if (lintResult.status === 0) {
    ok('ESLint: nessun errore');
    logEntry('\n## Lint\n\n- ESLint: OK ✓');
  } else {
    warn('ESLint: alcuni problemi rimasti — controlla manualmente');
    logEntry('\n## Lint\n\n- ESLint: problemi residui ⚠');
  }
}

// ─── STEP 4: Build verify ────────────────────────────────────────────────────

if (!depsOnly && !checkOnly && !noBuild) {
  step('4. Verifica build');

  try {
    run('npm run build', projectDir, true);
    ok('Build OK');
    logEntry('\n## Build\n\n- Build: OK ✓');
  } catch {
    fail('Build fallita — controlla i log');
    logEntry('\n## Build\n\n- Build: FALLITA ✗');
    warn('Esegui manualmente: cd Progetti/' + slug + ' && npm run build');
  }
}

// ─── STEP 5: Project check ───────────────────────────────────────────────────

if (!depsOnly) {
  step('5. Quality check');

  const checkScript = path.join(projectDir, 'scripts/check-project.mjs');
  if (fs.existsSync(checkScript)) {
    try {
      const checkOutput = spawnSync(
        process.execPath, [checkScript, '--ci'],
        { cwd: projectDir, encoding: 'utf-8', stdio: 'pipe' }
      );
      const output = checkOutput.stdout || '';
      const criticals = (output.match(/🔴/g) || []).length;
      const warnings = (output.match(/🟡/g) || []).length;
      const oks = (output.match(/🟢/g) || []).length;

      if (criticals > 0) {
        fail(`Check: ${criticals} critici, ${warnings} warning, ${oks} OK`);
      } else if (warnings > 0) {
        warn(`Check: ${warnings} warning, ${oks} OK`);
      } else {
        ok(`Check: tutto OK (${oks} check passati)`);
      }
      logEntry(`\n## Quality Check\n\n- Critici: ${criticals} | Warning: ${warnings} | OK: ${oks}`);
    } catch {
      warn('check-project.mjs non eseguibile — skip');
    }
  } else {
    warn('scripts/check-project.mjs non trovato — skip quality check');
    logEntry('\n## Quality Check\n\n- Skip: check-project.mjs non trovato');
  }
}

// ─── Salva log ────────────────────────────────────────────────────────────────

logLines.push(`\n---\n*Generato da update-project.mjs*`);
fs.writeFileSync(logPath, logLines.join('\n'), 'utf-8');

// ─── Report finale ────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(bold(`✅ Aggiornamento "${projectName}" completato!`));
console.log('─'.repeat(50));
console.log(dim(`\n📋 Log salvato in: .client-briefs/${slug}/update-log.md`));
console.log(`\n${bold('🚀 Dev:')} cd Progetti/${slug} && npm run dev\n`);
