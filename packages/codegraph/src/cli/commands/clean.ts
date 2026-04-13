import path from 'node:path'
import fs from 'node:fs'
import { getCodegraphDir } from '../../storage/db.js'
import { removeFromRegistry } from '../../storage/registry.js'
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
