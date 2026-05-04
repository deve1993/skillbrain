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
import { getCodegraphDir } from './db.js'
import type { RepoMeta } from './types/graph.js'

const META_FILENAME = 'meta.json'

export function loadMeta(repoPath: string): RepoMeta | null {
  const metaPath = path.join(getCodegraphDir(repoPath), META_FILENAME)
  if (!fs.existsSync(metaPath)) return null
  try {
    return JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
  } catch {
    return null
  }
}

export function saveMeta(repoPath: string, meta: RepoMeta): void {
  const dir = getCodegraphDir(repoPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(path.join(dir, META_FILENAME), JSON.stringify(meta, null, 2))
}
