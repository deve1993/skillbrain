import type { SourceFile } from 'ts-morph'
import type { GraphEdge } from '../graph/types.js'
import { nodeId, edgeId } from '../../utils/hash.js'
import path from 'node:path'
import fs from 'node:fs'

export interface ImportInfo {
  fromFile: string
  toModule: string
  specifiers: string[]
  isRelative: boolean
}

export function extractImports(sourceFile: SourceFile, relativePath: string): { edges: GraphEdge[]; imports: ImportInfo[] } {
  const edges: GraphEdge[] = []
  const imports: ImportInfo[] = []

  const fileNodeId = nodeId(relativePath, relativePath, 'File')

  for (const imp of sourceFile.getImportDeclarations()) {
    const moduleSpecifier = imp.getModuleSpecifierValue()
    const isRelative = moduleSpecifier.startsWith('.') || moduleSpecifier.startsWith('/')

    const specifiers: string[] = []

    // Named imports: import { X, Y } from '...'
    for (const named of imp.getNamedImports()) {
      specifiers.push(named.getName())
    }

    // Default import: import X from '...'
    const defaultImport = imp.getDefaultImport()
    if (defaultImport) {
      specifiers.push(defaultImport.getText())
    }

    // Namespace import: import * as X from '...'
    const nsImport = imp.getNamespaceImport()
    if (nsImport) {
      specifiers.push(nsImport.getText())
    }

    if (isRelative) {
      // Resolve relative path to get target file
      const dir = path.dirname(relativePath)
      let resolvedPath = path.normalize(path.join(dir, moduleSpecifier))

      // Resolve missing extensions by probing the filesystem
      if (!path.extname(resolvedPath)) {
        resolvedPath = resolveExtension(resolvedPath, sourceFile.getDirectoryPath()) ?? resolvedPath
      }

      const targetFileId = nodeId(resolvedPath, resolvedPath, 'File')

      edges.push({
        id: edgeId(fileNodeId, targetFileId, 'IMPORTS'),
        sourceId: fileNodeId,
        targetId: targetFileId,
        type: 'IMPORTS',
        confidence: 1.0,
        reason: `${relativePath} imports from ${moduleSpecifier}`,
      })
    }

    imports.push({
      fromFile: relativePath,
      toModule: moduleSpecifier,
      specifiers,
      isRelative,
    })
  }

  return { edges, imports }
}

const RESOLVE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx']

/**
 * Resolve a relative import path without an extension to an actual file.
 * `basePath` is the repo-relative path (e.g. `src/utils/foo`).
 * `dirAbsolute` is the absolute directory of the importing source file
 * (from ts-morph's `sourceFile.getDirectoryPath()`).
 *
 * Probes: foo.ts, foo.tsx, foo.js, foo.jsx, foo/index.ts, foo/index.tsx, etc.
 * Returns the resolved repo-relative path, or undefined if nothing matched.
 */
function resolveExtension(basePath: string, dirAbsolute: string): string | undefined {
  // dirAbsolute is the absolute dir for dirname(relativePath).
  // basePath = normalize(join(dirname(relativePath), moduleSpecifier)).
  // We need the repo root to convert basePath to absolute. Derive it by
  // walking up from dirAbsolute looking for .git or package.json.
  const repoRoot = findRepoRoot(dirAbsolute)
  if (!repoRoot) return undefined

  const absBase = path.join(repoRoot, basePath)

  // Try direct file extensions: ./foo.ts, ./foo.tsx, etc.
  for (const ext of RESOLVE_EXTENSIONS) {
    if (fs.existsSync(absBase + ext)) {
      return basePath + ext
    }
  }

  // Try index files: ./foo/index.ts, ./foo/index.tsx, etc.
  for (const ext of RESOLVE_EXTENSIONS) {
    const indexPath = path.join(absBase, 'index' + ext)
    if (fs.existsSync(indexPath)) {
      return path.join(basePath, 'index' + ext)
    }
  }

  return undefined
}

function findRepoRoot(dir: string): string | undefined {
  let current = dir
  while (current !== path.dirname(current)) {
    if (fs.existsSync(path.join(current, '.git')) || fs.existsSync(path.join(current, 'package.json'))) {
      return current
    }
    current = path.dirname(current)
  }
  return undefined
}
