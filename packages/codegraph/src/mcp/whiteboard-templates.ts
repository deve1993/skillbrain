/*
 * SkillBrain — Self-hosted AI memory platform
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

/**
 * Whiteboard templates — pre-made layouts that can be applied as a whole
 * board (`applyAs: ["board"]`) or dropped as a single frame inside an
 * existing board (`applyAs: ["frame"]`). Both forms share the same node
 * format used by the canvas.
 */

export interface FrameNode {
  id: string
  type: 'frame'
  x: number
  y: number
  w: number
  h: number
  name: string
  color: string
}

export interface StickyNode {
  id: string
  type: 'sticky'
  x: number
  y: number
  w: number
  h: number
  text: string
  color?: string
}

export interface ConnectorEdge {
  id: string
  from: string
  to: string
  kind?: 'related' | 'depends-on' | 'blocks' | 'leads-to'
  label?: string
}

export interface WhiteboardTemplate {
  id: string
  name: string
  description: string
  applyAs: Array<'board' | 'frame'>
  frames: FrameNode[]
  nodes: StickyNode[]
  connectors?: ConnectorEdge[]
}

const FRAME_W = 360
const FRAME_H = 520
const FRAME_GAP = 30

export const WHITEBOARD_TEMPLATES: WhiteboardTemplate[] = [
  {
    id: 'retro',
    name: 'Sprint Retrospective',
    description: 'Went well / To improve / Action items',
    applyAs: ['board', 'frame'],
    frames: [
      { id: 'retro-f1', type: 'frame', x: 0, y: 0, w: FRAME_W, h: FRAME_H, name: 'Went well', color: '#dcfce7' },
      { id: 'retro-f2', type: 'frame', x: FRAME_W + FRAME_GAP, y: 0, w: FRAME_W, h: FRAME_H, name: 'To improve', color: '#fef3c7' },
      { id: 'retro-f3', type: 'frame', x: 2 * (FRAME_W + FRAME_GAP), y: 0, w: FRAME_W, h: FRAME_H, name: 'Action items', color: '#dbeafe' },
    ],
    nodes: [],
  },
  {
    id: 'brainstorm-3-step',
    name: 'Brainstorm (3 steps)',
    description: 'Diverge → Cluster → Converge',
    applyAs: ['board', 'frame'],
    frames: [
      { id: 'bs-f1', type: 'frame', x: 0, y: 0, w: FRAME_W, h: FRAME_H, name: '1. Diverge — generate ideas', color: '#fce7f3' },
      { id: 'bs-f2', type: 'frame', x: FRAME_W + FRAME_GAP, y: 0, w: FRAME_W, h: FRAME_H, name: '2. Cluster — group themes', color: '#e0e7ff' },
      { id: 'bs-f3', type: 'frame', x: 2 * (FRAME_W + FRAME_GAP), y: 0, w: FRAME_W, h: FRAME_H, name: '3. Converge — pick winners', color: '#dcfce7' },
    ],
    nodes: [],
  },
  {
    id: 'kanban',
    name: 'Kanban Board',
    description: 'Backlog / To do / In progress / Done',
    applyAs: ['board', 'frame'],
    frames: [
      { id: 'kb-f1', type: 'frame', x: 0, y: 0, w: FRAME_W, h: FRAME_H, name: 'Backlog', color: '#f3f4f6' },
      { id: 'kb-f2', type: 'frame', x: FRAME_W + FRAME_GAP, y: 0, w: FRAME_W, h: FRAME_H, name: 'To do', color: '#fef3c7' },
      { id: 'kb-f3', type: 'frame', x: 2 * (FRAME_W + FRAME_GAP), y: 0, w: FRAME_W, h: FRAME_H, name: 'In progress', color: '#dbeafe' },
      { id: 'kb-f4', type: 'frame', x: 3 * (FRAME_W + FRAME_GAP), y: 0, w: FRAME_W, h: FRAME_H, name: 'Done', color: '#dcfce7' },
    ],
    nodes: [],
  },
  {
    id: 'okr',
    name: 'OKR Planning',
    description: 'Objective + 3 Key Results',
    applyAs: ['board', 'frame'],
    frames: [
      { id: 'okr-f1', type: 'frame', x: 0, y: 0, w: 2 * FRAME_W + FRAME_GAP, h: 180, name: 'Objective', color: '#e0e7ff' },
      { id: 'okr-f2', type: 'frame', x: 0, y: 220, w: FRAME_W, h: 360, name: 'KR 1', color: '#dcfce7' },
      { id: 'okr-f3', type: 'frame', x: FRAME_W + FRAME_GAP, y: 220, w: FRAME_W, h: 360, name: 'KR 2', color: '#fef3c7' },
      { id: 'okr-f4', type: 'frame', x: 2 * (FRAME_W + FRAME_GAP), y: 220, w: FRAME_W, h: 360, name: 'KR 3', color: '#fce7f3' },
    ],
    nodes: [
      { id: 'okr-s1', type: 'sticky', x: 20, y: 60, w: 240, h: 80, text: 'Our objective is...', color: '#fff' },
    ],
  },
  {
    id: 'mind-map',
    name: 'Mind Map',
    description: 'Central idea + 4 branches',
    applyAs: ['board', 'frame'],
    frames: [],
    nodes: [
      { id: 'mm-c', type: 'sticky', x: 0, y: 0, w: 200, h: 100, text: 'Central idea', color: '#fde68a' },
      { id: 'mm-b1', type: 'sticky', x: 360, y: -160, w: 160, h: 70, text: 'Branch A', color: '#dcfce7' },
      { id: 'mm-b2', type: 'sticky', x: 360, y: 0, w: 160, h: 70, text: 'Branch B', color: '#dbeafe' },
      { id: 'mm-b3', type: 'sticky', x: 360, y: 160, w: 160, h: 70, text: 'Branch C', color: '#fce7f3' },
      { id: 'mm-b4', type: 'sticky', x: -360, y: 0, w: 160, h: 70, text: 'Branch D', color: '#e0e7ff' },
    ],
    connectors: [
      { id: 'mm-e1', from: 'mm-c', to: 'mm-b1', kind: 'related' },
      { id: 'mm-e2', from: 'mm-c', to: 'mm-b2', kind: 'related' },
      { id: 'mm-e3', from: 'mm-c', to: 'mm-b3', kind: 'related' },
      { id: 'mm-e4', from: 'mm-c', to: 'mm-b4', kind: 'related' },
    ],
  },
]

export function listTemplates(): Array<Pick<WhiteboardTemplate, 'id' | 'name' | 'description' | 'applyAs'>> {
  return WHITEBOARD_TEMPLATES.map(({ id, name, description, applyAs }) => ({ id, name, description, applyAs }))
}

export function getTemplate(id: string): WhiteboardTemplate | undefined {
  return WHITEBOARD_TEMPLATES.find((t) => t.id === id)
}
