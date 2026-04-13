import type { SourceFile } from 'ts-morph'
import type { GraphEdge } from '../graph/types.js'
import { nodeId, edgeId } from '../../utils/hash.js'
import path from 'node:path'

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

      // Normalize extensions
      if (!path.extname(resolvedPath)) {
        resolvedPath = resolvedPath // Will be resolved in builder phase
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
