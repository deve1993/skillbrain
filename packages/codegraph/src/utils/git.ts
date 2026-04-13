import { execSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'

export function isGitRepo(dir: string): boolean {
  return fs.existsSync(path.join(dir, '.git'))
}

export function getHeadCommit(dir: string): string | null {
  if (!isGitRepo(dir)) return null
  try {
    return execSync('git rev-parse HEAD', { cwd: dir, encoding: 'utf-8' }).trim()
  } catch {
    return null
  }
}

export function getRepoName(dir: string): string {
  if (isGitRepo(dir)) {
    try {
      const remote = execSync('git remote get-url origin', { cwd: dir, encoding: 'utf-8' }).trim()
      const match = remote.match(/\/([^/]+?)(?:\.git)?$/)
      if (match) return match[1]
    } catch {}
  }
  return path.basename(dir)
}

export function getStagedFiles(dir: string): string[] {
  if (!isGitRepo(dir)) return []
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd: dir,
      encoding: 'utf-8',
    }).trim()
    return output ? output.split('\n') : []
  } catch {
    return []
  }
}

export function getChangedFiles(dir: string): string[] {
  if (!isGitRepo(dir)) return []
  try {
    const output = execSync('git diff --name-only --diff-filter=ACMR HEAD', {
      cwd: dir,
      encoding: 'utf-8',
    }).trim()
    return output ? output.split('\n') : []
  } catch {
    return []
  }
}

export function getDiffFiles(dir: string, baseRef: string): string[] {
  if (!isGitRepo(dir)) return []
  try {
    const output = execSync(`git diff --name-only ${baseRef}...HEAD`, {
      cwd: dir,
      encoding: 'utf-8',
    }).trim()
    return output ? output.split('\n') : []
  } catch {
    return []
  }
}
