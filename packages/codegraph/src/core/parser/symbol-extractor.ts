/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import {
  type SourceFile,
  SyntaxKind,
  type FunctionDeclaration,
  type ClassDeclaration,
  type VariableDeclaration,
  type InterfaceDeclaration,
} from 'ts-morph'
import type { GraphNode } from '../graph/types.js'
import { nodeId } from '../../utils/hash.js'

export function extractSymbols(sourceFile: SourceFile, relativePath: string): GraphNode[] {
  const nodes: GraphNode[] = []

  // File node
  nodes.push({
    id: nodeId(relativePath, relativePath, 'File'),
    label: 'File',
    name: relativePath,
    filePath: relativePath,
    startLine: 1,
    endLine: sourceFile.getEndLineNumber(),
    isExported: false,
  })

  // Functions (named declarations)
  for (const fn of sourceFile.getFunctions()) {
    const name = fn.getName()
    if (!name) continue
    nodes.push(functionNode(fn, name, relativePath))
  }

  // Arrow function / function expression assignments: const X = () => {} or const X = function() {}
  for (const varDecl of sourceFile.getVariableDeclarations()) {
    const init = varDecl.getInitializer()
    if (!init) continue
    const kind = init.getKind()
    if (
      kind === SyntaxKind.ArrowFunction ||
      kind === SyntaxKind.FunctionExpression
    ) {
      const name = varDecl.getName()
      nodes.push({
        id: nodeId(relativePath, name, 'Function'),
        label: 'Function',
        name,
        filePath: relativePath,
        startLine: varDecl.getStartLineNumber(),
        endLine: varDecl.getEndLineNumber(),
        isExported: isVarExported(varDecl),
      })
    }
  }

  // Classes
  for (const cls of sourceFile.getClasses()) {
    const name = cls.getName()
    if (!name) continue
    nodes.push(classNode(cls, name, relativePath))

    // Methods
    for (const method of cls.getMethods()) {
      const methodName = method.getName()
      nodes.push({
        id: nodeId(relativePath, `${name}.${methodName}`, 'Method'),
        label: 'Method',
        name: `${name}.${methodName}`,
        filePath: relativePath,
        startLine: method.getStartLineNumber(),
        endLine: method.getEndLineNumber(),
        isExported: false,
        properties: { className: name },
      })
    }
  }

  // Interfaces
  for (const iface of sourceFile.getInterfaces()) {
    const name = iface.getName()
    if (!name) continue
    nodes.push(interfaceNode(iface, name, relativePath))
  }

  // Default export function: export default function Component() {}
  const defaultExport = sourceFile.getDefaultExportSymbol()
  if (defaultExport) {
    const decl = defaultExport.getDeclarations()[0]
    if (decl && !nodes.some((n) => n.startLine === decl.getStartLineNumber() && n.label !== 'File')) {
      const name = defaultExport.getName() === 'default' ? `default_${relativePath.replace(/[^a-zA-Z]/g, '_')}` : defaultExport.getName()
      nodes.push({
        id: nodeId(relativePath, name, 'Function'),
        label: 'Function',
        name,
        filePath: relativePath,
        startLine: decl.getStartLineNumber(),
        endLine: decl.getEndLineNumber(),
        isExported: true,
      })
    }
  }

  return nodes
}

function functionNode(fn: FunctionDeclaration, name: string, filePath: string): GraphNode {
  return {
    id: nodeId(filePath, name, 'Function'),
    label: 'Function',
    name,
    filePath,
    startLine: fn.getStartLineNumber(),
    endLine: fn.getEndLineNumber(),
    isExported: fn.isExported(),
  }
}

function classNode(cls: ClassDeclaration, name: string, filePath: string): GraphNode {
  return {
    id: nodeId(filePath, name, 'Class'),
    label: 'Class',
    name,
    filePath,
    startLine: cls.getStartLineNumber(),
    endLine: cls.getEndLineNumber(),
    isExported: cls.isExported(),
  }
}

function interfaceNode(iface: InterfaceDeclaration, name: string, filePath: string): GraphNode {
  return {
    id: nodeId(filePath, name, 'Interface'),
    label: 'Interface',
    name,
    filePath,
    startLine: iface.getStartLineNumber(),
    endLine: iface.getEndLineNumber(),
    isExported: iface.isExported(),
  }
}

function isVarExported(varDecl: VariableDeclaration): boolean {
  const stmt = varDecl.getVariableStatement()
  return stmt ? stmt.isExported() : false
}
