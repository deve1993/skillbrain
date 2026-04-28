/*
 * SkillBrain — Self-hosted AI memory platform
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import fs from 'node:fs'
import path from 'node:path'
import ignore from 'ignore'

const DEFAULT_IGNORE = [
  'node_modules',
  '.git',
  '.next',
  '.codegraph',
  '.gitnexus',
  'dist',
  'build',
  'out',
  '.turbo',
  'coverage',
  '.DS_Store',
  '*.min.js',
  '*.map',
  '*.d.ts',
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
]

const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])

export interface WalkedFile {
  path: string
  relativePath: string
}

export function walkFiles(rootDir: string): WalkedFile[] {
  const ig = ignore()
  ig.add(DEFAULT_IGNORE)

  const gitignorePath = path.join(rootDir, '.gitignore')
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf-8')
    ig.add(content)
  }

  const files: WalkedFile[] = []
  walk(rootDir, rootDir, ig, files)
  return files
}

function walk(dir: string, rootDir: string, ig: ReturnType<typeof ignore>, files: WalkedFile[]): void {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    const relativePath = path.relative(rootDir, fullPath)

    if (ig.ignores(relativePath)) continue

    if (entry.isDirectory()) {
      if (ig.ignores(relativePath + '/')) continue
      walk(fullPath, rootDir, ig, files)
    } else if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name))) {
      files.push({ path: fullPath, relativePath })
    }
  }
}
