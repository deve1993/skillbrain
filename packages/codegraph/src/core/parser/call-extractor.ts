/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import { type SourceFile, SyntaxKind } from 'ts-morph'
import type { GraphEdge } from '../graph/types.js'
import { nodeId, edgeId } from '../../utils/hash.js'

export function extractCalls(sourceFile: SourceFile, relativePath: string): GraphEdge[] {
  const edges: GraphEdge[] = []
  const seen = new Set<string>()

  // Find all call expressions in this file
  const callExprs = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)

  for (const call of callExprs) {
    const expr = call.getExpression()
    let calledName: string | null = null

    // Simple call: foo()
    if (expr.getKind() === SyntaxKind.Identifier) {
      calledName = expr.getText()
    }
    // Method call: obj.method() — extract method name
    else if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
      calledName = expr.getText()
    }

    if (!calledName || calledName.length > 100) continue

    // Find which function/method this call is inside
    const containingFn = findContainingFunction(call)
    if (!containingFn) continue

    const callerName = containingFn.name
    const callerId = nodeId(relativePath, callerName, containingFn.label)
    const calledId = nodeId(relativePath, calledName, 'Function')

    const key = `${callerId}->${calledName}`
    if (seen.has(key)) continue
    seen.add(key)

    edges.push({
      id: edgeId(callerId, calledId, 'CALLS'),
      sourceId: callerId,
      targetId: calledId,
      type: 'CALLS',
      confidence: 0.8,
      reason: `${callerName} calls ${calledName}`,
    })
  }

  // JSX component usage: <ComponentName ... /> counts as a CALLS edge
  const jsxElements = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
  ]

  for (const jsx of jsxElements) {
    const tagName = jsx.getTagNameNode().getText()
    // Only PascalCase tags are custom components (lowercase = HTML elements)
    if (!tagName || tagName[0] !== tagName[0].toUpperCase() || tagName[0] === tagName[0].toLowerCase()) continue
    if (tagName.length > 100 || tagName.includes('.')) continue

    const containingFn = findContainingFunction(jsx)
    if (!containingFn) continue

    const callerName = containingFn.name
    const callerId = nodeId(relativePath, callerName, containingFn.label)
    const calledId = nodeId(relativePath, tagName, 'Function')

    const key = `${callerId}->${tagName}`
    if (seen.has(key)) continue
    seen.add(key)

    edges.push({
      id: edgeId(callerId, calledId, 'CALLS'),
      sourceId: callerId,
      targetId: calledId,
      type: 'CALLS',
      confidence: 0.85,
      reason: `${callerName} calls ${tagName}`,
    })
  }

  return edges
}

interface ContainingFunction {
  name: string
  label: 'Function' | 'Method'
}

function findContainingFunction(node: any): ContainingFunction | null {
  let current = node.getParent()
  while (current) {
    const kind = current.getKind()

    // Function declaration
    if (kind === SyntaxKind.FunctionDeclaration) {
      const name = current.getName?.()
      if (name) return { name, label: 'Function' }
    }

    // Arrow function or function expression assigned to variable
    if (kind === SyntaxKind.ArrowFunction || kind === SyntaxKind.FunctionExpression) {
      const parent = current.getParent()
      if (parent?.getKind() === SyntaxKind.VariableDeclaration) {
        const name = parent.getName?.()
        if (name) return { name, label: 'Function' }
      }
    }

    // Method declaration
    if (kind === SyntaxKind.MethodDeclaration) {
      const methodName = current.getName?.()
      const cls = current.getParent()
      if (cls?.getKind() === SyntaxKind.ClassDeclaration) {
        const className = cls.getName?.()
        if (className && methodName) {
          return { name: `${className}.${methodName}`, label: 'Method' }
        }
      }
    }

    current = current.getParent()
  }
  return null
}
