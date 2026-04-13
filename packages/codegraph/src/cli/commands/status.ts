import path from 'node:path'
import { loadMeta } from '../../storage/meta.js'
import { getHeadCommit, getRepoName } from '../../utils/git.js'
import { info, warn, success } from '../../utils/logger.js'

export function statusCommand(targetPath: string): void {
  const repoPath = path.resolve(targetPath)
  const repoName = getRepoName(repoPath)
  const meta = loadMeta(repoPath)

  if (!meta) {
    warn(`No index found for ${repoName}. Run: codegraph analyze ${targetPath}`)
    return
  }

  const headCommit = getHeadCommit(repoPath)
  const isStale = headCommit !== null && meta.lastCommit !== headCommit

  console.log(`\n  Repository:   ${meta.name}`)
  console.log(`  Path:         ${meta.path}`)
  console.log(`  Indexed at:   ${meta.indexedAt}`)
  console.log(`  Last commit:  ${meta.lastCommit?.slice(0, 7) || 'N/A'}`)
  console.log(`  HEAD commit:  ${headCommit?.slice(0, 7) || 'N/A'}`)
  console.log(`  Status:       ${isStale ? '⚠️  STALE (re-run analyze)' : '✅ Up to date'}`)
  console.log(``)
  console.log(`  Nodes:        ${meta.stats.nodes}`)
  console.log(`  Edges:        ${meta.stats.edges}`)
  console.log(`  Files:        ${meta.stats.files}`)
  console.log(`  Communities:  ${meta.stats.communities}`)
  console.log(`  Processes:    ${meta.stats.processes}`)
  console.log(``)
}
