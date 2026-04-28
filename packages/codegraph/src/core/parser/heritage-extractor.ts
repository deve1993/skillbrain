/*
 * SkillBrain — Self-hosted AI memory platform
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import type { SourceFile } from 'ts-morph'
import type { GraphEdge } from '../graph/types.js'
import { nodeId, edgeId } from '../../utils/hash.js'

export function extractHeritage(sourceFile: SourceFile, relativePath: string): GraphEdge[] {
  const edges: GraphEdge[] = []

  for (const cls of sourceFile.getClasses()) {
    const className = cls.getName()
    if (!className) continue

    const classId = nodeId(relativePath, className, 'Class')

    // extends
    const baseClass = cls.getExtends()
    if (baseClass) {
      const baseName = baseClass.getExpression().getText()
      const baseId = nodeId(relativePath, baseName, 'Class')
      edges.push({
        id: edgeId(classId, baseId, 'EXTENDS'),
        sourceId: classId,
        targetId: baseId,
        type: 'EXTENDS',
        confidence: 1.0,
        reason: `${className} extends ${baseName}`,
      })
    }

    // implements
    for (const impl of cls.getImplements()) {
      const ifaceName = impl.getExpression().getText()
      const ifaceId = nodeId(relativePath, ifaceName, 'Interface')
      edges.push({
        id: edgeId(classId, ifaceId, 'IMPLEMENTS'),
        sourceId: classId,
        targetId: ifaceId,
        type: 'IMPLEMENTS',
        confidence: 1.0,
        reason: `${className} implements ${ifaceName}`,
      })
    }

    // HAS_METHOD edges
    for (const method of cls.getMethods()) {
      const methodName = method.getName()
      const methodId = nodeId(relativePath, `${className}.${methodName}`, 'Method')
      edges.push({
        id: edgeId(classId, methodId, 'HAS_METHOD'),
        sourceId: classId,
        targetId: methodId,
        type: 'HAS_METHOD',
        confidence: 1.0,
      })
    }
  }

  return edges
}
