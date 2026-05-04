/*
 * SkillBrain — Self-hosted AI memory platform
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import path from 'node:path'
import fs from 'node:fs'
import { getCodegraphDir } from '@skillbrain/storage'
import { removeFromRegistry } from '@skillbrain/storage'
import { getRepoName } from '../../utils/git.js'
import { success, warn } from '../../utils/logger.js'

export function cleanCommand(targetPath: string): void {
  const repoPath = path.resolve(targetPath)
  const repoName = getRepoName(repoPath)
  const dir = getCodegraphDir(repoPath)

  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true })
    removeFromRegistry(repoPath)
    success(`Cleaned index for ${repoName}`)
  } else {
    warn(`No index found for ${repoName}`)
  }
}
