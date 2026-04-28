/*
 * SkillBrain — Self-hosted AI memory platform
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import { Project, type SourceFile } from 'ts-morph'
import path from 'node:path'
import fs from 'node:fs'
import type { WalkedFile } from '../../utils/file-walker.js'

export function createProject(repoPath: string, files: WalkedFile[]): Project {
  const tsConfigPath = findTsConfig(repoPath)

  const project = new Project({
    tsConfigFilePath: tsConfigPath ?? undefined,
    skipAddingFilesFromTsConfig: true,
    compilerOptions: tsConfigPath
      ? undefined
      : {
          allowJs: true,
          jsx: 4, // react-jsx
          esModuleInterop: true,
          target: 99, // ESNext
          module: 199, // Node16
          moduleResolution: 3, // Node16
          strict: false,
        },
  })

  for (const file of files) {
    try {
      project.addSourceFileAtPath(file.path)
    } catch {
      // Skip files that can't be parsed
    }
  }

  return project
}

function findTsConfig(dir: string): string | null {
  const candidates = ['tsconfig.json', 'tsconfig.app.json', 'jsconfig.json']
  for (const name of candidates) {
    const p = path.join(dir, name)
    if (fs.existsSync(p)) return p
  }
  return null
}

export function getSourceFiles(project: Project): SourceFile[] {
  return project.getSourceFiles()
}
