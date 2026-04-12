#!/usr/bin/env node

/**
 * compare-screenshots.mjs — Pixel-level Screenshot Comparison
 *
 * Compares original site screenshots against clone screenshots
 * and produces a comparison report with diff scores per viewport.
 *
 * Usage:
 *   node compare-screenshots.mjs --original <dir> --clone <dir> [--output <dir>] [--threshold <0-100>]
 *
 * Output:
 *   <output>/
 *   ├── comparison-report.json    <- Diff scores per viewport
 *   ├── diff-mobile-375.png       <- Visual diff overlay
 *   ├── diff-tablet-768.png
 *   ├── diff-desktop-1024.png
 *   └── diff-wide-1440.png
 *
 * Requirements:
 *   npm install sharp (for image comparison)
 *   Falls back to basic Buffer comparison if sharp is not available.
 */

import { readFile, writeFile, readdir, mkdir } from 'fs/promises';
import { join, basename } from 'path';
import { existsSync } from 'fs';

// --- CLI Args ---
const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : null;
}

const originalDir = getArg('original');
const cloneDir = getArg('clone');
const outputDir = getArg('output') || './clone-output/comparison';
const threshold = parseInt(getArg('threshold') || '5', 10); // Max acceptable diff %

if (!originalDir || !cloneDir) {
  console.error('Usage: node compare-screenshots.mjs --original <dir> --clone <dir> [--output <dir>] [--threshold <0-100>]');
  process.exit(1);
}

// --- Helpers ---
async function ensureDir(dir) {
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
}

/**
 * Compare two image buffers pixel-by-pixel.
 * Returns { diffPixels, totalPixels, diffPercent, diffBuffer }
 * Uses raw PNG decoding to avoid external dependencies.
 */
async function compareImages(buf1, buf2) {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    // sharp not available, use basic comparison
    return compareBasic(buf1, buf2);
  }

  // Use sharp for proper image comparison
  const img1 = sharp(buf1);
  const img2 = sharp(buf2);

  const meta1 = await img1.metadata();
  const meta2 = await img2.metadata();

  // Resize to same dimensions (use smaller)
  const width = Math.min(meta1.width, meta2.width);
  const height = Math.min(meta1.height, meta2.height);

  const raw1 = await img1.resize(width, height, { fit: 'cover' }).raw().toBuffer();
  const raw2 = await img2.resize(width, height, { fit: 'cover' }).raw().toBuffer();

  const channels = 3; // RGB
  const totalPixels = width * height;
  let diffPixels = 0;

  // Create diff buffer (red overlay for differences)
  const diffRaw = Buffer.alloc(width * height * 4); // RGBA

  for (let i = 0; i < totalPixels; i++) {
    const offset = i * channels;
    const r1 = raw1[offset], g1 = raw1[offset + 1], b1 = raw1[offset + 2];
    const r2 = raw2[offset], g2 = raw2[offset + 1], b2 = raw2[offset + 2];

    // Color distance (simple Euclidean in RGB)
    const dist = Math.sqrt(
      Math.pow(r1 - r2, 2) +
      Math.pow(g1 - g2, 2) +
      Math.pow(b1 - b2, 2)
    );

    const diffOffset = i * 4;

    if (dist > 30) { // Tolerance: ~12% color distance
      diffPixels++;
      // Highlight diff in red
      diffRaw[diffOffset] = 255;      // R
      diffRaw[diffOffset + 1] = 0;    // G
      diffRaw[diffOffset + 2] = 0;    // B
      diffRaw[diffOffset + 3] = 180;  // A (semi-transparent)
    } else {
      // Show original dimmed
      diffRaw[diffOffset] = Math.round(r1 * 0.4);
      diffRaw[diffOffset + 1] = Math.round(g1 * 0.4);
      diffRaw[diffOffset + 2] = Math.round(b1 * 0.4);
      diffRaw[diffOffset + 3] = 255;
    }
  }

  // Convert diff to PNG
  const diffBuffer = await sharp(diffRaw, {
    raw: { width, height, channels: 4 },
  }).png().toBuffer();

  return {
    diffPixels,
    totalPixels,
    diffPercent: parseFloat(((diffPixels / totalPixels) * 100).toFixed(2)),
    diffBuffer,
    dimensions: { width, height },
    originalDimensions: { width: meta1.width, height: meta1.height },
    cloneDimensions: { width: meta2.width, height: meta2.height },
  };
}

/**
 * Basic buffer comparison (fallback without sharp).
 * Compares raw file bytes — less accurate but zero dependencies.
 */
function compareBasic(buf1, buf2) {
  const minLen = Math.min(buf1.length, buf2.length);
  const maxLen = Math.max(buf1.length, buf2.length);
  let diffBytes = Math.abs(buf1.length - buf2.length);

  for (let i = 0; i < minLen; i++) {
    if (buf1[i] !== buf2[i]) diffBytes++;
  }

  const diffPercent = parseFloat(((diffBytes / maxLen) * 100).toFixed(2));

  return {
    diffPixels: diffBytes,
    totalPixels: maxLen,
    diffPercent,
    diffBuffer: null,
    dimensions: null,
    note: 'Basic byte comparison (install sharp for pixel-accurate diff)',
  };
}

// --- Main ---
async function main() {
  console.log(`\n📊 Screenshot Comparison Tool`);
  console.log(`   Original: ${originalDir}`);
  console.log(`   Clone:    ${cloneDir}`);
  console.log(`   Output:   ${outputDir}`);
  console.log(`   Threshold: ${threshold}%\n`);

  await ensureDir(outputDir);

  // Find matching screenshot files
  const originalFiles = await readdir(originalDir);
  const cloneFiles = await readdir(cloneDir);

  const viewports = originalFiles
    .filter(f => f.endsWith('.png'))
    .filter(f => cloneFiles.includes(f));

  if (viewports.length === 0) {
    console.error('❌ No matching screenshot files found between directories.');
    console.log(`   Original files: ${originalFiles.join(', ')}`);
    console.log(`   Clone files: ${cloneFiles.join(', ')}`);
    process.exit(1);
  }

  console.log(`🔍 Comparing ${viewports.length} viewports...\n`);

  const results = {};
  let allPassed = true;

  for (const file of viewports) {
    const viewportName = basename(file, '.png');
    const origBuf = await readFile(join(originalDir, file));
    const cloneBuf = await readFile(join(cloneDir, file));

    const result = await compareImages(origBuf, cloneBuf);
    const passed = result.diffPercent <= threshold;

    if (!passed) allPassed = false;

    results[viewportName] = {
      file,
      diffPercent: result.diffPercent,
      diffPixels: result.diffPixels,
      totalPixels: result.totalPixels,
      passed,
      ...(result.dimensions && { dimensions: result.dimensions }),
      ...(result.originalDimensions && { originalDimensions: result.originalDimensions }),
      ...(result.cloneDimensions && { cloneDimensions: result.cloneDimensions }),
      ...(result.note && { note: result.note }),
    };

    // Save diff image if available
    if (result.diffBuffer) {
      await writeFile(join(outputDir, `diff-${viewportName}.png`), result.diffBuffer);
    }

    const icon = passed ? '✅' : '❌';
    console.log(`  ${icon} ${viewportName}: ${result.diffPercent}% diff (${passed ? 'PASS' : 'FAIL'} — threshold: ${threshold}%)`);
  }

  // Summary
  const report = {
    timestamp: new Date().toISOString(),
    originalDir,
    cloneDir,
    threshold,
    overallPassed: allPassed,
    viewports: results,
    summary: {
      total: viewports.length,
      passed: Object.values(results).filter(r => r.passed).length,
      failed: Object.values(results).filter(r => !r.passed).length,
      avgDiff: parseFloat(
        (Object.values(results).reduce((sum, r) => sum + r.diffPercent, 0) / viewports.length).toFixed(2)
      ),
      maxDiff: Math.max(...Object.values(results).map(r => r.diffPercent)),
    },
  };

  await writeFile(
    join(outputDir, 'comparison-report.json'),
    JSON.stringify(report, null, 2),
    'utf8'
  );

  console.log(`\n📊 Summary:`);
  console.log(`   Viewports: ${report.summary.total}`);
  console.log(`   Passed: ${report.summary.passed}`);
  console.log(`   Failed: ${report.summary.failed}`);
  console.log(`   Avg Diff: ${report.summary.avgDiff}%`);
  console.log(`   Max Diff: ${report.summary.maxDiff}%`);
  console.log(`   Overall: ${allPassed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`\n📁 Report saved to: ${join(outputDir, 'comparison-report.json')}`);

  if (!allPassed) {
    console.log('\n⚠️  Some viewports exceed the diff threshold. Check diff-*.png images for visual differences.');
  }
}

main().catch((err) => {
  console.error('❌ Comparison failed:', err.message);
  process.exit(1);
});
