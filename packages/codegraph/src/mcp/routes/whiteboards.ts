/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import { Router } from 'express'
import nodemailer from 'nodemailer'
import {
  openDb, closeDb,
  WhiteboardsStore, WhiteboardConcurrencyError,
  MemoryStore, SkillsStore, ProjectsStore,
} from '@skillbrain/storage'
import { dashboardUrl } from '../../constants.js'
import { WHITEBOARD_TEMPLATES, listTemplates, getTemplate } from '../whiteboard-templates.js'
import type { RouteContext } from './index.js'

interface UserBasic { id: string; email: string; name: string }

const ANON_USER: UserBasic = { id: 'anonymous', email: 'anonymous@local', name: 'Anonymous' }

function getUser(skillbrainRoot: string, userId: string | undefined): UserBasic {
  if (!userId) return ANON_USER
  const db = openDb(skillbrainRoot)
  try {
    const row = db.prepare(`SELECT id, email, name FROM users WHERE id = ?`).get(userId) as UserBasic | undefined
    if (!row) return { id: userId, email: `${userId}@local`, name: userId }
    return { ...row, email: row.email || `${userId}@local`, name: row.name || userId }
  } finally {
    closeDb(db)
  }
}

/** True when per-user auth is on (ADMIN_EMAIL configured). */
function authEnabled(): boolean { return !!process.env.ADMIN_EMAIL }

/** Deterministic display color from an email — used for color-by-author. */
function colorForEmail(email: string): string {
  let hash = 0
  for (let i = 0; i < email.length; i++) hash = (hash * 31 + email.charCodeAt(i)) | 0
  const palette = [
    '#fca5a5', '#fdba74', '#fde047', '#bef264', '#86efac', '#67e8f9',
    '#93c5fd', '#a5b4fc', '#c4b5fd', '#f0abfc', '#fbcfe8', '#fda4af',
  ]
  return palette[Math.abs(hash) % palette.length]
}

function extractMentions(body: string): string[] {
  const re = /@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g
  const out = new Set<string>()
  let m
  while ((m = re.exec(body)) !== null) out.add(m[1])
  return [...out]
}

async function sendMentionEmail(opts: {
  to: string
  authorName: string
  boardName: string
  boardId: string
  nodeId: string
  body: string
}): Promise<void> {
  const host = process.env.SMTP_HOST
  if (!host || !opts.to) return
  const port = parseInt(process.env.SMTP_PORT || '587', 10)
  const secure = process.env.SMTP_SECURE === 'true'
  const user = process.env.SMTP_USER || ''
  const pass = process.env.SMTP_PASS || ''
  const from = process.env.SMTP_FROM || 'SkillBrain <noreply@dvesolutions.eu>'
  try {
    const transport = nodemailer.createTransport({ host, port, secure, auth: { user, pass } })
    const link = `${dashboardUrl()}/whiteboard.html?id=${encodeURIComponent(opts.boardId)}&node=${encodeURIComponent(opts.nodeId)}`
    await transport.sendMail({
      from,
      to: opts.to,
      subject: `${opts.authorName} ti ha menzionato su "${opts.boardName}"`,
      text: [
        `${opts.authorName} ti ha menzionato su una whiteboard.`,
        '',
        `Board: ${opts.boardName}`,
        `Apri:  ${link}`,
        '',
        '— Commento —',
        opts.body,
      ].join('\n'),
    })
  } catch (err) {
    console.warn('[whiteboards] mention email failed:', (err as Error).message)
  }
}

export function createWhiteboardsRouter(ctx: RouteContext): Router {
  const router = Router()
  const root = ctx.skillbrainRoot

  // ── List + Create ──

  router.get('/api/whiteboards', (req, res) => {
    try {
      const { scope, projectName, search, tag, pinned, trashed } = req.query as any
      const db = openDb(root)
      const store = new WhiteboardsStore(db)
      const boards = store.list({
        scope: scope === 'team' || scope === 'project' ? scope : undefined,
        projectName: projectName || undefined,
        search: search || undefined,
        tag: tag || undefined,
        pinned: pinned === 'true' || pinned === '1',
        onlyTrashed: trashed === 'true' || trashed === '1',
      })
      closeDb(db)
      res.json({ boards })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  router.get('/api/whiteboards/recent', (req, res) => {
    try {
      const limit = Math.min(50, parseInt((req.query as any).limit || '5', 10))
      const db = openDb(root)
      const boards = new WhiteboardsStore(db).listRecent(limit)
      closeDb(db)
      res.json({ boards })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  router.get('/api/whiteboards/tags', (_req, res) => {
    try {
      const db = openDb(root)
      const tags = new WhiteboardsStore(db).allTags()
      closeDb(db)
      res.json({ tags })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  router.post('/api/whiteboards', (req, res) => {
    const userId = (req as any).userId as string | undefined
    if (authEnabled() && !userId) { res.status(401).json({ error: 'Unauthorized' }); return }
    const user = getUser(root, userId)
    const { name, scope, projectName, templateId, votePool } = req.body || {}
    if (!name || typeof name !== 'string') { res.status(400).json({ error: 'name required' }); return }
    if (scope !== 'team' && scope !== 'project') { res.status(400).json({ error: 'scope must be team|project' }); return }
    if (scope === 'project' && !projectName) { res.status(400).json({ error: 'projectName required when scope=project' }); return }
    try {
      let stateJson: string | undefined
      if (templateId) {
        const tpl = getTemplate(templateId)
        if (!tpl) { res.status(404).json({ error: `template ${templateId} not found` }); return }
        if (!tpl.applyAs.includes('board')) {
          res.status(400).json({ error: `template ${templateId} not applicable as a board` }); return
        }
        stateJson = JSON.stringify({
          nodes: [...tpl.frames, ...tpl.nodes],
          connectors: tpl.connectors ?? [],
          viewport: { x: 0, y: 0, zoom: 1 },
        })
      }
      const db = openDb(root)
      const store = new WhiteboardsStore(db)
      const board = store.create({
        name, scope,
        projectName: scope === 'project' ? projectName : null,
        createdBy: user.email || user.id,
        stateJson,
        votePool: typeof votePool === 'number' ? votePool : undefined,
      })
      closeDb(db)
      res.json({ board })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Linkable search (memory / skill / session / project) ──

  router.get('/api/whiteboards/linkable', (req, res) => {
    const { type, q, projectName, limit } = req.query as any
    const lim = Math.min(parseInt(limit || '20', 10) || 20, 50)
    const query = typeof q === 'string' ? q : ''
    try {
      const db = openDb(root)
      let items: Array<{ id: string; title: string; subtitle?: string; badge?: string }> = []

      if (type === 'memory') {
        const store = new MemoryStore(db)
        const results = query
          ? store.search(query, lim, projectName).map((r) => r.memory)
          : store.query({ status: 'active', project: projectName, limit: lim })
        items = results.map((m) => ({
          id: m.id,
          title: (m.context || m.solution || m.id).slice(0, 80),
          subtitle: (m.tags ?? []).join(', '),
          badge: m.type,
        }))
      } else if (type === 'skill') {
        const store = new SkillsStore(db)
        const results = query
          ? store.search(query, lim).map((r) => r.skill)
          : store.list().slice(0, lim)
        items = results.map((s) => ({
          id: s.name,
          title: s.name,
          subtitle: s.description?.slice(0, 80) || '',
          badge: s.type,
        }))
      } else if (type === 'session') {
        const store = new MemoryStore(db)
        const sessions = store.recentSessions(50)
        const filtered = query
          ? sessions.filter((s) => (s.sessionName + ' ' + (s.summary ?? '')).toLowerCase().includes(query.toLowerCase()))
          : sessions
        items = filtered.slice(0, lim).map((s) => ({
          id: s.id,
          title: s.sessionName || s.id,
          subtitle: s.summary?.slice(0, 80) || '',
          badge: s.status || 'session',
        }))
      } else if (type === 'project') {
        const store = new ProjectsStore(db)
        const projects = store.list()
        const filtered = query
          ? projects.filter((p) => (p.name + ' ' + (p.displayName ?? '')).toLowerCase().includes(query.toLowerCase()))
          : projects
        items = filtered.slice(0, lim).map((p) => ({
          id: p.name,
          title: p.displayName || p.name,
          subtitle: p.clientName || p.description?.slice(0, 80) || '',
          badge: p.status,
        }))
      } else {
        closeDb(db)
        res.status(400).json({ error: 'type must be memory|skill|session|project' }); return
      }

      closeDb(db)
      res.json({ items })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Global search across all boards ──

  router.get('/api/whiteboards/search', (req, res) => {
    const { q, limit } = req.query as any
    if (!q) { res.json({ boards: [] }); return }
    try {
      const db = openDb(root)
      const store = new WhiteboardsStore(db)
      const boards = store.searchAll(String(q), parseInt(limit || '20', 10))
      closeDb(db)
      res.json({ boards })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Comments ──

  router.get('/api/whiteboards/:id/comments', (req, res) => {
    const { nodeId } = req.query as any
    try {
      const db = openDb(root)
      const store = new WhiteboardsStore(db)
      const comments = store.listComments(req.params.id, nodeId || undefined)
      closeDb(db)
      res.json({ comments })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  router.post('/api/whiteboards/:id/comments', async (req, res) => {
    const userId = (req as any).userId as string | undefined
    if (authEnabled() && !userId) { res.status(401).json({ error: 'Unauthorized' }); return }
    const user = getUser(root, userId)
    const { nodeId, parentId, body } = req.body || {}
    if (!nodeId || typeof nodeId !== 'string') { res.status(400).json({ error: 'nodeId required' }); return }
    if (!body || typeof body !== 'string' || !body.trim()) { res.status(400).json({ error: 'body required' }); return }
    try {
      const db = openDb(root)
      const store = new WhiteboardsStore(db)
      const board = store.get(req.params.id)
      if (!board) { closeDb(db); res.status(404).json({ error: 'Whiteboard not found' }); return }
      const comment = store.addComment({
        boardId: req.params.id,
        nodeId,
        parentId: parentId || null,
        authorEmail: user.email,
        body: body.trim(),
      })
      closeDb(db)
      res.json({ comment })

      // Fire-and-forget mention emails + persist in-app notifications
      const mentions = extractMentions(body).filter((m) => m !== user.email)
      for (const to of mentions) {
        sendMentionEmail({
          to,
          authorName: user.name || user.email,
          boardName: board.name,
          boardId: board.id,
          nodeId,
          body: body.trim(),
        })
        try {
          const db2 = openDb(root)
          new WhiteboardsStore(db2).addNotification({
            userEmail: to, type: 'mention',
            boardId: board.id, nodeId, body: body.trim().slice(0, 200),
          })
          closeDb(db2)
        } catch {}
      }
      // Activity entry
      try {
        const db2 = openDb(root)
        new WhiteboardsStore(db2).recordActivity({
          boardId: board.id, userEmail: user.email, action: 'commented', detail: nodeId,
        })
        closeDb(db2)
      } catch {}
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  router.delete('/api/whiteboards/:id/comments/:cid', (req, res) => {
    const userId = (req as any).userId as string | undefined
    if (authEnabled() && !userId) { res.status(401).json({ error: 'Unauthorized' }); return }
    const user = getUser(root, userId)
    try {
      const db = openDb(root)
      const role = userId ? (db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as any)?.role : null
      const store = new WhiteboardsStore(db)
      const ok = (role === 'admin' || !authEnabled())
        ? store.deleteComment(req.params.cid)
        : store.deleteComment(req.params.cid, user.email)
      closeDb(db)
      if (!ok) { res.status(403).json({ error: 'Cannot delete this comment' }); return }
      res.json({ ok: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Export selection to memory ──

  router.post('/api/whiteboards/:id/export-memory', (req, res) => {
    const userId = (req as any).userId as string | undefined
    if (authEnabled() && !userId) { res.status(401).json({ error: 'Unauthorized' }); return }
    const { selection, type, project } = req.body || {}
    if (!Array.isArray(selection) || selection.length === 0) {
      res.status(400).json({ error: 'selection (array of node text/title) required' }); return
    }
    try {
      const db = openDb(root)
      const store = new WhiteboardsStore(db)
      const board = store.get(req.params.id)
      if (!board) { closeDb(db); res.status(404).json({ error: 'Whiteboard not found' }); return }

      const memStore = new MemoryStore(db)
      const bullets = selection.map((s: string) => `- ${s}`).join('\n')
      const context = `From whiteboard "${board.name}":\n${bullets}`
      const memory = memStore.add({
        type: type || 'Fact',
        context,
        problem: '',
        solution: bullets,
        reason: `Exported from whiteboard ${board.name}`,
        confidence: 5,
        importance: 5,
        tags: ['whiteboard', board.name].filter(Boolean),
        project: project || board.projectName || undefined,
      })
      closeDb(db)
      res.json({ ok: true, memoryId: memory.id })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Generators ──

  router.post('/api/whiteboards/generate/memory-cluster', (req, res) => {
    const filters = req.body || {}
    const { projectName } = filters
    if (!projectName) { res.status(400).json({ error: 'projectName required' }); return }
    try {
      const db = openDb(root)
      const memories = fetchFilteredMemories(db, { ...filters, limit: filters.limit || 100 })
      closeDb(db)

      // Cluster by primary tag (first tag)
      const clusters = new Map<string, typeof memories>()
      for (const m of memories) {
        const key = m.tags?.[0] || m.type || 'misc'
        if (!clusters.has(key)) clusters.set(key, [])
        clusters.get(key)!.push(m)
      }
      // Top 6 clusters by size
      const top = [...clusters.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 6)

      const FRAME_W = 320, FRAME_H = 480, FRAME_GAP = 40
      const PALETTE = ['#fef3c7', '#dcfce7', '#dbeafe', '#fce7f3', '#e0e7ff', '#fed7aa']
      const nodes: any[] = []
      const cardOffsetY = 50
      top.forEach(([tag, mems], i) => {
        const fx = i * (FRAME_W + FRAME_GAP)
        nodes.push({
          id: `frame-${i}`, type: 'frame',
          x: fx, y: 0, w: FRAME_W, h: FRAME_H,
          name: tag, color: PALETTE[i % PALETTE.length],
        })
        mems.slice(0, 8).forEach((m, j) => {
          nodes.push({
            id: `card-${i}-${j}`, type: 'sb-card',
            cardKind: 'memory', refId: m.id,
            x: fx + 16, y: cardOffsetY + j * 50,
            w: FRAME_W - 32, h: 44,
            snapshot: { title: (m.context || '').slice(0, 60), badge: m.type },
            color: PALETTE[i % PALETTE.length],
          })
        })
      })
      const stateJson = JSON.stringify({ nodes, connectors: [], viewport: { x: 0, y: 0, zoom: 1 } })
      res.json({ stateJson, clusterCount: top.length })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  router.post('/api/whiteboards/generate/session-timeline', (req, res) => {
    const { projectName, limit } = req.body || {}
    try {
      const db = openDb(root)
      const memStore = new MemoryStore(db)
      const sessions = memStore.recentSessions(limit || 30)
        .filter((s: any) => !projectName || s.project === projectName)
        .reverse() // chronological order
      closeDb(db)

      const CARD_W = 220, CARD_H = 80, GAP = 30
      const nodes: any[] = []
      const connectors: any[] = []
      sessions.forEach((s: any, i: number) => {
        nodes.push({
          id: `sess-${i}`, type: 'sb-card', cardKind: 'session', refId: s.id,
          x: i * (CARD_W + GAP), y: 0,
          w: CARD_W, h: CARD_H,
          snapshot: {
            title: s.sessionName || s.id,
            subtitle: (s.summary || '').slice(0, 60),
            badge: s.status || 'session',
          },
          color: '#dbeafe',
        })
        if (i > 0) {
          connectors.push({
            id: `conn-${i}`,
            from: `sess-${i - 1}`, to: `sess-${i}`,
            kind: 'leads-to', label: '',
          })
        }
      })
      const stateJson = JSON.stringify({ nodes, connectors, viewport: { x: 0, y: 0, zoom: 1 } })
      res.json({ stateJson, sessionCount: sessions.length })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  router.post('/api/whiteboards/generate/skill-graph', (_req, res) => {
    try {
      const db = openDb(root)
      const skillsStore = new SkillsStore(db)
      const skills = skillsStore.list().slice(0, 40)
      const cooc = skillsStore.topCooccurrences(60)
      closeDb(db)

      // Simple force-directed layout (2 iterations of attractive/repulsive)
      const N = skills.length
      const RADIUS = Math.max(300, N * 18)
      type Pos = { x: number; y: number }
      const positions: Record<string, Pos> = {}
      skills.forEach((s, i) => {
        const angle = (i / N) * Math.PI * 2
        positions[s.name] = { x: Math.cos(angle) * RADIUS, y: Math.sin(angle) * RADIUS }
      })

      // Spring simulation: 80 iterations
      const k = 80
      const repK = 12000
      for (let iter = 0; iter < 80; iter++) {
        const forces: Record<string, Pos> = {}
        for (const s of skills) forces[s.name] = { x: 0, y: 0 }
        // Repulsion
        for (let i = 0; i < N; i++) {
          for (let j = i + 1; j < N; j++) {
            const a = positions[skills[i].name], b = positions[skills[j].name]
            const dx = a.x - b.x, dy = a.y - b.y
            const d2 = dx * dx + dy * dy + 1
            const f = repK / d2
            const fx = (dx / Math.sqrt(d2)) * f
            const fy = (dy / Math.sqrt(d2)) * f
            forces[skills[i].name].x += fx; forces[skills[i].name].y += fy
            forces[skills[j].name].x -= fx; forces[skills[j].name].y -= fy
          }
        }
        // Attraction along edges
        for (const e of cooc) {
          const a = positions[e.skillA], b = positions[e.skillB]
          if (!a || !b) continue
          const dx = a.x - b.x, dy = a.y - b.y
          const d = Math.sqrt(dx * dx + dy * dy) + 1
          const f = (d - k) * 0.05 * Math.log(1 + e.count)
          const fx = (dx / d) * f
          const fy = (dy / d) * f
          forces[e.skillA].x -= fx; forces[e.skillA].y -= fy
          forces[e.skillB].x += fx; forces[e.skillB].y += fy
        }
        for (const s of skills) {
          positions[s.name].x += forces[s.name].x * 0.05
          positions[s.name].y += forces[s.name].y * 0.05
        }
      }

      const nodes = skills.map((s) => ({
        id: `skill-${s.name}`, type: 'sb-card', cardKind: 'skill', refId: s.name,
        x: Math.round(positions[s.name].x), y: Math.round(positions[s.name].y),
        w: 160, h: 50,
        snapshot: { title: s.name, badge: s.type },
        color: '#e0e7ff',
      }))
      const connectors = cooc
        .filter((e) => positions[e.skillA] && positions[e.skillB])
        .map((e, i) => ({
          id: `cooc-${i}`,
          from: `skill-${e.skillA}`, to: `skill-${e.skillB}`,
          kind: 'related', label: String(e.count),
        }))
      const stateJson = JSON.stringify({ nodes, connectors, viewport: { x: 0, y: 0, zoom: 0.6 } })
      res.json({ stateJson, skillCount: skills.length, edgeCount: connectors.length })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Filter helper: applies common filters to a memories query ──
  // Reads filters from req.body and returns a filtered memory[] array.
  function fetchFilteredMemories(db: any, filters: any): any[] {
    const memStore = new MemoryStore(db)
    // Use store.query() for the supported filters
    const out = memStore.query({
      project: filters.projectName || undefined,
      type: filters.type || undefined,        // string or string[]
      status: filters.status || 'active',
      minConfidence: typeof filters.minConfidence === 'number' ? filters.minConfidence : undefined,
      tags: Array.isArray(filters.tags) && filters.tags.length ? filters.tags : undefined,
      limit: filters.limit || 300,
    })
    // Then filter by sinceDays + author client-side (not supported by query())
    let filtered = out
    if (typeof filters.sinceDays === 'number' && filters.sinceDays > 0) {
      const cutoff = Date.now() - filters.sinceDays * 86400 * 1000
      filtered = filtered.filter((m: any) => new Date(m.createdAt || m.created_at).getTime() >= cutoff)
    }
    if (filters.authorEmail) {
      // Need to join — simpler: drop down to SQL
      const userIdRow = db.prepare(`SELECT id FROM users WHERE email = ?`).get(filters.authorEmail) as { id: string } | undefined
      if (userIdRow) filtered = filtered.filter((m: any) => m.createdByUserId === userIdRow.id)
    }
    return filtered
  }

  // ── Recipe helpers ──
  // Build a "frame-per-category" layout: each category becomes a colored frame
  // containing its memory cards stacked vertically.
  function frameLayout(
    categories: Array<{ key: string; label: string; items: Array<{ id: string; title: string; subtitle?: string; badge?: string; cardKind: 'memory' | 'skill' | 'session' | 'project' }> }>,
    opts: { frameW?: number; frameH?: number; gap?: number; cardH?: number } = {}
  ) {
    const FRAME_W = opts.frameW ?? 320
    const FRAME_H = opts.frameH ?? 520
    const GAP = opts.gap ?? 30
    const CARD_H = opts.cardH ?? 50
    const PALETTE = ['#fef3c7', '#dcfce7', '#dbeafe', '#fce7f3', '#e0e7ff', '#fed7aa', '#fee2e2', '#cffafe']
    const nodes: any[] = []
    let frameIdx = 0
    for (const cat of categories) {
      const fx = frameIdx * (FRAME_W + GAP)
      nodes.push({
        id: `frame-${frameIdx}`, type: 'frame',
        x: fx, y: 0, w: FRAME_W, h: FRAME_H,
        name: `${cat.label} (${cat.items.length})`,
        color: PALETTE[frameIdx % PALETTE.length],
      })
      cat.items.slice(0, Math.floor((FRAME_H - 60) / (CARD_H + 6))).forEach((it, j) => {
        nodes.push({
          id: `card-${frameIdx}-${j}`, type: 'sb-card',
          cardKind: it.cardKind, refId: it.id,
          x: fx + 16, y: 50 + j * (CARD_H + 6),
          w: FRAME_W - 32, h: CARD_H,
          snapshot: { title: it.title, subtitle: it.subtitle, badge: it.badge },
          color: PALETTE[frameIdx % PALETTE.length],
        })
      })
      frameIdx++
    }
    return JSON.stringify({ nodes, connectors: [], viewport: { x: 0, y: 0, zoom: 1 } })
  }

  // Build a chronological timeline (horizontal cards connected by arrows)
  function timelineLayout(items: Array<{ id: string; title: string; subtitle?: string; badge?: string; cardKind: 'memory' | 'skill' | 'session' | 'project' }>, color = '#dbeafe') {
    const CARD_W = 220, CARD_H = 90, GAP = 30
    const nodes: any[] = items.map((it, i) => ({
      id: `tl-${i}`, type: 'sb-card', cardKind: it.cardKind, refId: it.id,
      x: i * (CARD_W + GAP), y: 0, w: CARD_W, h: CARD_H,
      snapshot: { title: it.title, subtitle: it.subtitle, badge: it.badge },
      color,
    }))
    const connectors = items.slice(1).map((_, i) => ({
      id: `tl-c-${i}`, from: `tl-${i}`, to: `tl-${i + 1}`,
      kind: 'leads-to', label: '',
    }))
    return JSON.stringify({ nodes, connectors, viewport: { x: 0, y: 0, zoom: 1 } })
  }

  // Build a simple grid (N columns)
  function gridLayout(items: Array<{ id: string; title: string; subtitle?: string; badge?: string; cardKind: 'memory' | 'skill' | 'session' | 'project' }>, cols = 5) {
    const CARD_W = 240, CARD_H = 100, GAP = 20
    const nodes: any[] = items.map((it, i) => {
      const r = Math.floor(i / cols), c = i % cols
      return {
        id: `gr-${i}`, type: 'sb-card', cardKind: it.cardKind, refId: it.id,
        x: c * (CARD_W + GAP), y: r * (CARD_H + GAP),
        w: CARD_W, h: CARD_H,
        snapshot: { title: it.title, subtitle: it.subtitle, badge: it.badge },
        color: '#fef3c7',
      }
    })
    return JSON.stringify({ nodes, connectors: [], viewport: { x: 0, y: 0, zoom: 1 } })
  }

  // Helper: turn a memory into card descriptor
  function memCard(m: any) {
    return {
      id: m.id, cardKind: 'memory' as const,
      title: (m.context || m.solution || m.id).slice(0, 60),
      subtitle: (m.tags ?? []).join(', ').slice(0, 50),
      badge: m.type,
    }
  }

  // ── New recipes ──

  /** Memorie raggruppate per tipo (Pattern / Decision / BugFix / ...) */
  router.post('/api/whiteboards/generate/by-type', (req, res) => {
    const filters = req.body || {}
    try {
      const db = openDb(root)
      const memories = fetchFilteredMemories(db, { ...filters, type: undefined /* type is grouping dim */, limit: filters.limit || 200 })
      closeDb(db)
      const byType: Record<string, any[]> = {}
      for (const m of memories) {
        const k = m.type || 'misc'
        if (!byType[k]) byType[k] = []
        byType[k].push(memCard(m))
      }
      const cats = Object.entries(byType)
        .sort((a, b) => b[1].length - a[1].length)
        .map(([type, items]) => ({ key: type, label: type, items }))
      res.json({ stateJson: frameLayout(cats), categoryCount: cats.length })
    } catch (err: any) { res.status(500).json({ error: err.message }) }
  })

  /** Memorie raggruppate per progetto */
  router.post('/api/whiteboards/generate/by-project', (req, res) => {
    const filters = req.body || {}
    try {
      const db = openDb(root)
      const memories = fetchFilteredMemories(db, { ...filters, projectName: undefined /* project is grouping dim */, limit: filters.limit || 300 })
      closeDb(db)
      const byProject: Record<string, any[]> = {}
      for (const m of memories) {
        const k = m.project || '(no project)'
        if (!byProject[k]) byProject[k] = []
        byProject[k].push(memCard(m))
      }
      const cats = Object.entries(byProject)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 10)
        .map(([proj, items]) => ({ key: proj, label: proj, items }))
      res.json({ stateJson: frameLayout(cats), categoryCount: cats.length })
    } catch (err: any) { res.status(500).json({ error: err.message }) }
  })

  /** Memorie raggruppate per skill referenziata */
  router.post('/api/whiteboards/generate/by-skill', (req, res) => {
    const filters = req.body || {}
    try {
      const db = openDb(root)
      const memories = fetchFilteredMemories(db, { ...filters, limit: filters.limit || 300 })
      closeDb(db)
      const bySkill: Record<string, any[]> = {}
      for (const m of memories) {
        if (!m.skill) continue
        if (!bySkill[m.skill]) bySkill[m.skill] = []
        bySkill[m.skill].push(memCard(m))
      }
      const cats = Object.entries(bySkill)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 10)
        .map(([skill, items]) => ({ key: skill, label: `skill: ${skill}`, items }))
      res.json({ stateJson: frameLayout(cats), categoryCount: cats.length })
    } catch (err: any) { res.status(500).json({ error: err.message }) }
  })

  /** Memorie raggruppate per autore */
  router.post('/api/whiteboards/generate/by-author', (req, res) => {
    const { projectName, limit } = req.body || {}
    try {
      const db = openDb(root)
      // Need to join memories with users to get email
      const sql = `
        SELECT m.id, m.type, m.context, m.solution, m.tags, m.project, m.skill, m.created_by_user_id,
               COALESCE(u.email, m.created_by_user_id, '(unknown)') AS author
        FROM memories m
        LEFT JOIN users u ON u.id = m.created_by_user_id
        WHERE m.status = 'active' ${projectName ? 'AND m.project = ?' : ''}
        ORDER BY m.created_at DESC
        LIMIT ${parseInt(limit || '300', 10)}
      `
      const params: any[] = projectName ? [projectName] : []
      const rows = db.prepare(sql).all(...params) as any[]
      closeDb(db)
      const byAuthor: Record<string, any[]> = {}
      for (const m of rows) {
        const tags = (() => { try { return JSON.parse(m.tags || '[]') } catch { return [] } })()
        const card = {
          id: m.id, cardKind: 'memory' as const,
          title: (m.context || m.solution || m.id).slice(0, 60),
          subtitle: tags.join(', ').slice(0, 50),
          badge: m.type,
        }
        if (!byAuthor[m.author]) byAuthor[m.author] = []
        byAuthor[m.author].push(card)
      }
      const cats = Object.entries(byAuthor)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 8)
        .map(([author, items]) => ({ key: author, label: author, items }))
      res.json({ stateJson: frameLayout(cats), categoryCount: cats.length })
    } catch (err: any) { res.status(500).json({ error: err.message }) }
  })

  /** Memorie create negli ultimi N giorni (default 30), grid layout */
  router.post('/api/whiteboards/generate/recent-memories', (req, res) => {
    const { days, projectName, limit } = req.body || {}
    const since = new Date(Date.now() - (days || 30) * 86400 * 1000).toISOString()
    try {
      const db = openDb(root)
      const sql = `SELECT id, type, context, solution, tags FROM memories
                   WHERE status = 'active' AND created_at >= ? ${projectName ? 'AND project = ?' : ''}
                   ORDER BY created_at DESC LIMIT ${parseInt(limit || '50', 10)}`
      const params = projectName ? [since, projectName] : [since]
      const rows = db.prepare(sql).all(...params) as any[]
      closeDb(db)
      const items = rows.map((m) => ({
        id: m.id, cardKind: 'memory' as const,
        title: (m.context || m.solution || m.id).slice(0, 60),
        subtitle: (() => { try { return (JSON.parse(m.tags || '[]') as string[]).join(', ').slice(0, 50) } catch { return '' } })(),
        badge: m.type,
      }))
      res.json({ stateJson: gridLayout(items, 5), count: items.length, sinceDays: days || 30 })
    } catch (err: any) { res.status(500).json({ error: err.message }) }
  })

  /** Solo type=Decision come timeline cronologica */
  router.post('/api/whiteboards/generate/decisions-log', (req, res) => {
    const filters = req.body || {}
    try {
      const db = openDb(root)
      const memories = fetchFilteredMemories(db, { ...filters, type: 'Decision', limit: filters.limit || 30 })
      closeDb(db)
      const sorted = memories.sort((a: any, b: any) => (a.createdAt || '').localeCompare(b.createdAt || ''))
      const items = sorted.map(memCard)
      res.json({ stateJson: timelineLayout(items, '#fde68a'), count: items.length })
    } catch (err: any) { res.status(500).json({ error: err.message }) }
  })

  /** Solo type=AntiPattern in mind-map (radial) */
  router.post('/api/whiteboards/generate/antipatterns', (req, res) => {
    const filters = req.body || {}
    try {
      const db = openDb(root)
      const memories = fetchFilteredMemories(db, { ...filters, type: 'AntiPattern', limit: filters.limit || 24 })
      closeDb(db)
      // Radial layout: central "AntiPatterns" hub + memories around it
      const N = memories.length || 1
      const RADIUS = 280
      const nodes: any[] = [{
        id: 'hub', type: 'sticky', x: -100, y: -40, w: 200, h: 80,
        text: '⚠️ AntiPatterns', color: '#fee2e2',
      }]
      const connectors: any[] = []
      memories.forEach((m: any, i: number) => {
        const angle = (i / N) * Math.PI * 2
        const x = Math.cos(angle) * RADIUS - 110, y = Math.sin(angle) * RADIUS - 30
        nodes.push({
          id: `ap-${i}`, type: 'sb-card', cardKind: 'memory', refId: m.id,
          x, y, w: 220, h: 60,
          snapshot: { title: (m.context || '').slice(0, 60), badge: m.type },
          color: '#fee2e2',
        })
        connectors.push({ id: `ap-c-${i}`, from: 'hub', to: `ap-${i}`, kind: 'blocks', label: '' })
      })
      res.json({ stateJson: JSON.stringify({ nodes, connectors, viewport: { x: 0, y: 0, zoom: 1 } }), count: memories.length })
    } catch (err: any) { res.status(500).json({ error: err.message }) }
  })

  /** Solo type=Todo + status=active in grid */
  router.post('/api/whiteboards/generate/open-todos', (req, res) => {
    const filters = req.body || {}
    try {
      const db = openDb(root)
      const memories = fetchFilteredMemories(db, { ...filters, type: 'Todo', status: 'active', limit: filters.limit || 50 })
      closeDb(db)
      const items = memories.map(memCard)
      res.json({ stateJson: gridLayout(items, 4), count: items.length })
    } catch (err: any) { res.status(500).json({ error: err.message }) }
  })

  /** Top N memorie per usage (proxy: confidence + importance) */
  router.post('/api/whiteboards/generate/most-used-memories', (req, res) => {
    const { projectName, limit } = req.body || {}
    try {
      const db = openDb(root)
      const sql = `SELECT id, type, context, solution, tags, confidence, importance
                   FROM memories WHERE status = 'active' ${projectName ? 'AND project = ?' : ''}
                   ORDER BY (importance * 2 + confidence) DESC, updated_at DESC
                   LIMIT ${parseInt(limit || '20', 10)}`
      const params = projectName ? [projectName] : []
      const rows = db.prepare(sql).all(...params) as any[]
      closeDb(db)
      const items = rows.map((m) => ({
        id: m.id, cardKind: 'memory' as const,
        title: (m.context || m.solution || m.id).slice(0, 60),
        subtitle: `★ imp:${m.importance} · conf:${m.confidence}`,
        badge: m.type,
      }))
      res.json({ stateJson: gridLayout(items, 4), count: items.length })
    } catch (err: any) { res.status(500).json({ error: err.message }) }
  })

  /** Project overview: 3 frame combinati (memorie + sessioni + skills usate) */
  router.post('/api/whiteboards/generate/project-overview', (req, res) => {
    const { projectName } = req.body || {}
    if (!projectName) { res.status(400).json({ error: 'projectName required' }); return }
    try {
      const db = openDb(root)
      const memStore = new MemoryStore(db)
      const memories = memStore.query({ project: projectName, status: 'active', limit: 30 })
      const sessions = memStore.recentSessions(15).filter((s: any) => s.project === projectName)
      // Skills referenced in this project's memories (deduped)
      const skillSet = new Set<string>()
      for (const m of memories) if (m.skill) skillSet.add(m.skill)
      closeDb(db)
      const cats = [
        { key: 'memories', label: '💡 Memorie', items: memories.map(memCard) },
        { key: 'sessions', label: '⏱ Sessioni', items: sessions.map((s: any) => ({
          id: s.id, cardKind: 'session' as const,
          title: s.sessionName || s.id,
          subtitle: (s.summary || '').slice(0, 50),
          badge: s.status || 'session',
        })) },
        { key: 'skills', label: '🛠 Skills usate', items: [...skillSet].map((name) => ({
          id: name, cardKind: 'skill' as const,
          title: name, badge: 'skill',
        })) },
      ]
      res.json({ stateJson: frameLayout(cats, { frameH: 600 }), projectName })
    } catch (err: any) { res.status(500).json({ error: err.message }) }
  })

  /**
   * Semantic clustering via memory_embeddings + K-means.
   * Falls back to tag-vector similarity if no embeddings are available.
   * Each cluster becomes a frame containing its memory cards.
   */
  router.post('/api/whiteboards/generate/semantic-cluster', (req, res) => {
    const filters = req.body || {}
    const k = Math.max(2, Math.min(10, parseInt(filters.k, 10) || 0))  // 0 = auto
    try {
      const db = openDb(root)
      const memories = fetchFilteredMemories(db, { ...filters, limit: filters.limit || 200 })
      if (memories.length < 2) {
        closeDb(db); res.json({ stateJson: '{"nodes":[],"connectors":[],"viewport":{"x":0,"y":0,"zoom":1}}', clusterCount: 0, mode: 'empty' }); return
      }
      // Try to load embeddings; if any memory has none, fall back to tag-vector mode
      const embRows = db.prepare(`SELECT memory_id, embedding FROM memory_embeddings WHERE memory_id IN (${memories.map(() => '?').join(',')})`)
        .all(...memories.map((m: any) => m.id)) as Array<{ memory_id: string; embedding: Buffer }>
      const embMap: Record<string, Float32Array> = {}
      for (const r of embRows) {
        // Buffer → Float32Array (assume native little-endian)
        embMap[r.memory_id] = new Float32Array(r.embedding.buffer, r.embedding.byteOffset, r.embedding.byteLength / 4)
      }
      closeDb(db)

      let vectors: number[][]
      let mode: 'embedding' | 'tag-fallback'
      if (Object.keys(embMap).length === memories.length) {
        // All have embeddings → use them
        vectors = memories.map((m: any) => Array.from(embMap[m.id]))
        mode = 'embedding'
      } else {
        // Fall back to tag bag-of-words vectors (one-hot per tag)
        const allTags = new Set<string>()
        for (const m of memories) for (const t of (m.tags ?? [])) allTags.add(t)
        const tagList = [...allTags]
        vectors = memories.map((m: any) => {
          const v = new Array(tagList.length).fill(0)
          for (const t of (m.tags ?? [])) {
            const i = tagList.indexOf(t)
            if (i >= 0) v[i] = 1
          }
          return v
        })
        mode = 'tag-fallback'
      }

      const K = k || Math.max(2, Math.min(8, Math.round(Math.sqrt(memories.length))))
      const assignments = kMeansCluster(vectors, K, 30)
      // Build clusters
      const clusters: Record<number, any[]> = {}
      memories.forEach((m: any, i: number) => {
        const c = assignments[i]
        if (!clusters[c]) clusters[c] = []
        clusters[c].push(m)
      })
      // Auto-label each cluster: most common tag among its memories, fall back to first word of context
      const cats = Object.entries(clusters)
        .sort((a, b) => b[1].length - a[1].length)
        .map(([k, items], idx) => {
          const tagCounts: Record<string, number> = {}
          for (const m of items) for (const t of (m.tags ?? [])) tagCounts[t] = (tagCounts[t] || 0) + 1
          const topTag = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
          const label = topTag || `Cluster ${idx + 1}`
          return { key: k, label, items: items.map(memCard) }
        })
      res.json({ stateJson: frameLayout(cats), clusterCount: cats.length, mode, K })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  /**
   * Find or create the "Home" whiteboard for a given project.
   * The home board is auto-populated with a Project overview if newly created.
   * Returns { board, created: boolean } so the client can show "opened existing" vs "created new".
   */
  router.post('/api/whiteboards/projects/:projectName/home', (req, res) => {
    const userId = (req as any).userId as string | undefined
    if (authEnabled() && !userId) { res.status(401).json({ error: 'Unauthorized' }); return }
    const projectName = req.params.projectName
    if (!projectName) { res.status(400).json({ error: 'projectName required' }); return }
    try {
      const db = openDb(root)
      const store = new WhiteboardsStore(db)
      // Look for an existing home board (scope=project, name='Home', matching project)
      const existing = store.list({ scope: 'project', projectName }).find((b) => b.name === 'Home')
      if (existing) {
        closeDb(db)
        res.json({ board: existing, created: false })
        return
      }
      // Build a Project overview to seed the new home board
      const memStore = new MemoryStore(db)
      const memories = memStore.query({ project: projectName, status: 'active', limit: 30 })
      const sessions = memStore.recentSessions(15).filter((s: any) => s.project === projectName)
      const skillSet = new Set<string>()
      for (const m of memories) if (m.skill) skillSet.add(m.skill)
      const cats = [
        { key: 'memories', label: '💡 Memorie', items: memories.map(memCard) },
        { key: 'sessions', label: '⏱ Sessioni', items: sessions.map((s: any) => ({
          id: s.id, cardKind: 'session' as const,
          title: s.sessionName || s.id,
          subtitle: (s.summary || '').slice(0, 50),
          badge: s.status || 'session',
        })) },
        { key: 'skills', label: '🛠 Skills usate', items: [...skillSet].map((name) => ({
          id: name, cardKind: 'skill' as const,
          title: name, badge: 'skill',
        })) },
      ]
      const user = getUser(root, userId)
      const board = store.create({
        name: 'Home',
        scope: 'project',
        projectName,
        createdBy: user.email || user.id,
        stateJson: frameLayout(cats, { frameH: 600 }),
      })
      closeDb(db)
      res.json({ board, created: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Share (read-only public link) ──

  router.post('/api/whiteboards/:id/share', (req, res) => {
    const userId = (req as any).userId as string | undefined
    if (authEnabled() && !userId) { res.status(401).json({ error: 'Unauthorized' }); return }
    try {
      const db = openDb(root)
      const store = new WhiteboardsStore(db)
      const board = store.get(req.params.id)
      if (!board) { closeDb(db); res.status(404).json({ error: 'Whiteboard not found' }); return }
      const token = board.shareToken || store.enableShare(req.params.id)
      closeDb(db)
      res.json({ token, url: `/whiteboard.html?share=${encodeURIComponent(token)}` })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  router.delete('/api/whiteboards/:id/share', (req, res) => {
    const userId = (req as any).userId as string | undefined
    if (authEnabled() && !userId) { res.status(401).json({ error: 'Unauthorized' }); return }
    try {
      const db = openDb(root)
      new WhiteboardsStore(db).disableShare(req.params.id)
      closeDb(db)
      res.json({ ok: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // Public read-only endpoint — no auth required, requires valid token
  router.get('/api/whiteboards/shared/:token', (req, res) => {
    try {
      const db = openDb(root)
      const board = new WhiteboardsStore(db).getByShareToken(req.params.token)
      closeDb(db)
      if (!board) { res.status(404).json({ error: 'Invalid or revoked share link' }); return }
      // Strip share_token from response so it's not exposed to the public
      const { shareToken: _drop, ...safe } = board
      res.json({ board: safe, readOnly: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Templates ──

  router.get('/api/whiteboards/templates', (_req, res) => {
    res.json({ templates: listTemplates() })
  })

  router.get('/api/whiteboards/templates/:id', (req, res) => {
    const tpl = getTemplate(req.params.id)
    if (!tpl) { res.status(404).json({ error: 'Template not found' }); return }
    res.json({ template: tpl })
  })

  // ── Author colors (legend) ──

  router.get('/api/whiteboards/:id/authors', (req, res) => {
    try {
      const db = openDb(root)
      const board = new WhiteboardsStore(db).get(req.params.id)
      if (!board) { closeDb(db); res.status(404).json({ error: 'Whiteboard not found' }); return }
      const comments = new WhiteboardsStore(db).listComments(req.params.id)
      closeDb(db)
      const emails = new Set<string>()
      emails.add(board.createdBy)
      for (const c of comments) emails.add(c.authorEmail)
      const authors = [...emails].map((email) => ({ email, color: colorForEmail(email) }))
      res.json({ authors })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Current user color (for new node coloring) ──

  router.get('/api/whiteboards/me/color', (req, res) => {
    const userId = (req as any).userId as string | undefined
    const user = getUser(root, userId)
    res.json({ email: user.email, color: colorForEmail(user.email || user.id), name: user.name })
  })

  // ── /:id routes (declared LAST so static paths above match first) ──

  router.get('/api/whiteboards/:id', (req, res) => {
    try {
      const db = openDb(root)
      const store = new WhiteboardsStore(db)
      const board = store.get(req.params.id)
      closeDb(db)
      if (!board) { res.status(404).json({ error: 'Whiteboard not found' }); return }
      res.json({ board })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  router.put('/api/whiteboards/:id', (req, res) => {
    const { stateJson, expectedVersion, thumbnailDataUrl } = req.body || {}
    if (typeof stateJson !== 'string') { res.status(400).json({ error: 'stateJson (string) required' }); return }
    if (typeof expectedVersion !== 'number') { res.status(400).json({ error: 'expectedVersion (number) required' }); return }
    const userId = (req as any).userId as string | undefined
    try {
      const db = openDb(root)
      const store = new WhiteboardsStore(db)
      // Auto-snapshot: keep one per board per hour
      const lastSnap = (store.listSnapshots(req.params.id, 1)[0])
      const tooRecent = lastSnap && (Date.now() - new Date(lastSnap.createdAt).getTime() < 60 * 60 * 1000)
      if (!tooRecent) {
        try { store.createSnapshot({ boardId: req.params.id, reason: 'auto', createdBy: userId ? getUser(root, userId).email : undefined }) } catch {}
        store.pruneSnapshots(req.params.id, 30)
      }
      const board = store.saveState({
        id: req.params.id, stateJson, expectedVersion,
        thumbnailDataUrl: thumbnailDataUrl || null,
      })
      // Record activity (debounced behavior could batch these — for now record every save)
      try {
        store.recordActivity({
          boardId: req.params.id,
          userEmail: userId ? getUser(root, userId).email : 'anonymous@local',
          action: 'edited',
        })
      } catch {}
      closeDb(db)
      res.json({ board })
    } catch (err: any) {
      if (err instanceof WhiteboardConcurrencyError) {
        res.status(409).json({ error: err.message, code: err.code, currentVersion: err.currentVersion })
        return
      }
      res.status(500).json({ error: err.message })
    }
  })

  router.patch('/api/whiteboards/:id', (req, res) => {
    const { name, votePool } = req.body || {}
    try {
      const db = openDb(root)
      const store = new WhiteboardsStore(db)
      const board = store.updateMeta(req.params.id, {
        name: typeof name === 'string' ? name : undefined,
        votePool: typeof votePool === 'number' ? votePool : undefined,
      })
      closeDb(db)
      if (!board) { res.status(404).json({ error: 'Whiteboard not found' }); return }
      res.json({ board })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  router.delete('/api/whiteboards/:id', (req, res) => {
    const userId = (req as any).userId as string | undefined
    if (authEnabled() && !userId) { res.status(401).json({ error: 'Unauthorized' }); return }
    const permanent = (req.query as any).permanent === 'true'
    try {
      const db = openDb(root)
      const store = new WhiteboardsStore(db)
      const board = store.get(req.params.id)
      if (!board) { closeDb(db); res.status(404).json({ error: 'Whiteboard not found' }); return }
      if (authEnabled()) {
        const user = getUser(root, userId)
        const role = (db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as any)?.role
        if (board.createdBy !== user.email && role !== 'admin') {
          closeDb(db); res.status(403).json({ error: 'Only the creator or an admin can delete this whiteboard' }); return
        }
      }
      // Default: soft delete (move to trash). ?permanent=true forces permanent removal.
      if (permanent || board.deletedAt) {
        store.delete(req.params.id)
      } else {
        store.softDelete(req.params.id)
        store.recordActivity({ boardId: req.params.id, userEmail: getUser(root, userId).email, action: 'trashed' })
      }
      closeDb(db)
      res.json({ ok: true, permanent: permanent || !!board.deletedAt })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Pin / Restore / Duplicate / Move / Mark opened / Metadata ──

  router.post('/api/whiteboards/:id/pin', (req, res) => {
    try {
      const db = openDb(root)
      const newVal = new WhiteboardsStore(db).togglePin(req.params.id)
      closeDb(db)
      res.json({ pinnedAt: newVal })
    } catch (err: any) { res.status(500).json({ error: err.message }) }
  })

  router.post('/api/whiteboards/:id/restore', (req, res) => {
    try {
      const db = openDb(root)
      const ok = new WhiteboardsStore(db).restore(req.params.id)
      if (ok) {
        const userId = (req as any).userId as string | undefined
        new WhiteboardsStore(db).recordActivity({ boardId: req.params.id, userEmail: getUser(root, userId).email, action: 'restored' })
      }
      closeDb(db)
      res.json({ ok })
    } catch (err: any) { res.status(500).json({ error: err.message }) }
  })

  router.post('/api/whiteboards/:id/duplicate', (req, res) => {
    const userId = (req as any).userId as string | undefined
    const user = getUser(root, userId)
    const { newName, newScope, newProjectName } = req.body || {}
    try {
      const db = openDb(root)
      const board = new WhiteboardsStore(db).duplicate(req.params.id, {
        newName, newScope, newProjectName,
        createdBy: user.email,
      })
      closeDb(db)
      if (!board) { res.status(404).json({ error: 'Source not found' }); return }
      res.json({ board })
    } catch (err: any) { res.status(500).json({ error: err.message }) }
  })

  router.post('/api/whiteboards/:id/move', (req, res) => {
    const { scope, projectName } = req.body || {}
    if (scope && scope !== 'team' && scope !== 'project') { res.status(400).json({ error: 'invalid scope' }); return }
    if (scope === 'project' && !projectName) { res.status(400).json({ error: 'projectName required for scope=project' }); return }
    try {
      const db = openDb(root)
      const board = new WhiteboardsStore(db).move(req.params.id, { scope, projectName })
      closeDb(db)
      if (!board) { res.status(404).json({ error: 'Not found' }); return }
      res.json({ board })
    } catch (err: any) { res.status(500).json({ error: err.message }) }
  })

  router.post('/api/whiteboards/:id/opened', (req, res) => {
    try {
      const db = openDb(root)
      new WhiteboardsStore(db).markOpened(req.params.id)
      closeDb(db)
      res.json({ ok: true })
    } catch (err: any) { res.status(500).json({ error: err.message }) }
  })

  router.put('/api/whiteboards/:id/metadata', (req, res) => {
    const { tags, description } = req.body || {}
    try {
      const db = openDb(root)
      const board = new WhiteboardsStore(db).updateMetadata(req.params.id, { tags, description })
      closeDb(db)
      if (!board) { res.status(404).json({ error: 'Not found' }); return }
      res.json({ board })
    } catch (err: any) { res.status(500).json({ error: err.message }) }
  })

  // Bulk operations: takes array of board IDs
  router.post('/api/whiteboards/bulk', (req, res) => {
    const userId = (req as any).userId as string | undefined
    if (authEnabled() && !userId) { res.status(401).json({ error: 'Unauthorized' }); return }
    const { ids, action } = req.body || {}
    if (!Array.isArray(ids) || !ids.length) { res.status(400).json({ error: 'ids[] required' }); return }
    if (!['delete', 'restore', 'pin', 'unpin', 'permanent-delete'].includes(action)) {
      res.status(400).json({ error: 'invalid action' }); return
    }
    try {
      const db = openDb(root)
      const store = new WhiteboardsStore(db)
      let count = 0
      for (const id of ids) {
        try {
          if (action === 'delete') count += store.softDelete(id) ? 1 : 0
          else if (action === 'restore') count += store.restore(id) ? 1 : 0
          else if (action === 'permanent-delete') count += store.delete(id) ? 1 : 0
          else if (action === 'pin' || action === 'unpin') {
            const cur = store.get(id)
            if (!cur) continue
            const wantPinned = action === 'pin'
            const isPinned = !!cur.pinnedAt
            if (wantPinned !== isPinned) { store.togglePin(id); count++ }
          }
        } catch {}
      }
      closeDb(db)
      res.json({ ok: true, count })
    } catch (err: any) { res.status(500).json({ error: err.message }) }
  })

  /**
   * Memory backlinks: which boards have an sb-card pointing to a given memory id?
   * Implementation: scan state_json with LIKE — fast enough for board count <10k.
   */
  router.get('/api/memories/:id/board-mentions', (req, res) => {
    try {
      const db = openDb(root)
      const needle = `"refId":"${req.params.id.replace(/"/g, '\\"')}"`
      const rows = db.prepare(
        `SELECT id, name, scope, project_name AS projectName, updated_at AS updatedAt
         FROM whiteboards
         WHERE deleted_at IS NULL AND state_json LIKE ?`
      ).all(`%${needle}%`) as any[]
      closeDb(db)
      res.json({ boards: rows })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  /**
   * Auto-extract memories from a retrospective board.
   * Input: { mappings: [{ frameNamePattern, memoryType }] }  — defaults provided.
   * Each sticky in matching frame becomes a memory of the mapped type.
   */
  router.post('/api/whiteboards/:id/extract-memories', (req, res) => {
    const userId = (req as any).userId as string | undefined
    if (authEnabled() && !userId) { res.status(401).json({ error: 'Unauthorized' }); return }
    const user = getUser(root, userId)
    const { mappings } = req.body || {}
    // Default mappings for retro template
    const rules: Array<{ pattern: RegExp; type: string }> = (mappings && Array.isArray(mappings)
      ? mappings.map((m: any) => ({ pattern: new RegExp(m.frameNamePattern, 'i'), type: m.memoryType }))
      : [
          { pattern: /went\s*well|good|positive/i, type: 'Pattern' },
          { pattern: /to\s*improve|bad|issue|problem/i, type: 'AntiPattern' },
          { pattern: /action\s*items?|todo|next\s*step/i, type: 'Todo' },
          { pattern: /decision/i, type: 'Decision' },
        ])
    try {
      const db = openDb(root)
      const store = new WhiteboardsStore(db)
      const board = store.get(req.params.id)
      if (!board) { closeDb(db); res.status(404).json({ error: 'Board not found' }); return }
      const state = JSON.parse(board.stateJson || '{}')
      const nodes = state.nodes || []
      const frames = nodes.filter((n: any) => n.type === 'frame')
      const created: Array<{ id: string; type: string; text: string }> = []
      const memStore = new MemoryStore(db)
      for (const frame of frames) {
        const matched = rules.find((r) => r.pattern.test(frame.name || ''))
        if (!matched) continue
        // Find sticky nodes inside this frame's bounds
        const stickies = nodes.filter((n: any) =>
          n.type === 'sticky' &&
          n.x >= frame.x && n.y >= frame.y &&
          n.x + n.w <= frame.x + frame.w &&
          n.y + n.h <= frame.y + frame.h &&
          n.text && n.text.trim()
        )
        for (const s of stickies) {
          const text = (s.text || '').trim().slice(0, 500)
          if (!text) continue
          const memory = memStore.add({
            type: matched.type as any,
            context: text,
            problem: '',
            solution: matched.type === 'Pattern' ? text : '',
            reason: `Extracted from whiteboard "${board.name}" (frame: ${frame.name})`,
            confidence: 5,
            importance: 5,
            tags: ['retro', board.name, frame.name].filter(Boolean).slice(0, 5),
            project: board.projectName || undefined,
            createdByUserId: userId,
          })
          created.push({ id: memory.id, type: matched.type, text: text.slice(0, 60) })
        }
      }
      store.recordActivity({ boardId: board.id, userEmail: user.email, action: 'extracted-memories', detail: `${created.length} memories` })
      closeDb(db)
      res.json({ ok: true, created, count: created.length })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Snapshots ──
  router.get('/api/whiteboards/:id/snapshots', (req, res) => {
    try {
      const db = openDb(root)
      const items = new WhiteboardsStore(db).listSnapshots(req.params.id)
      closeDb(db)
      res.json({ snapshots: items })
    } catch (err: any) { res.status(500).json({ error: err.message }) }
  })

  router.post('/api/whiteboards/:id/snapshots', (req, res) => {
    const userId = (req as any).userId as string | undefined
    const user = getUser(root, userId)
    try {
      const db = openDb(root)
      const id = new WhiteboardsStore(db).createSnapshot({ boardId: req.params.id, reason: 'manual', createdBy: user.email })
      new WhiteboardsStore(db).recordActivity({ boardId: req.params.id, userEmail: user.email, action: 'snapshot' })
      closeDb(db)
      res.json({ id })
    } catch (err: any) { res.status(500).json({ error: err.message }) }
  })

  router.post('/api/whiteboards/:id/restore-snapshot/:snapshotId', (req, res) => {
    const userId = (req as any).userId as string | undefined
    const user = getUser(root, userId)
    try {
      const db = openDb(root)
      const store = new WhiteboardsStore(db)
      const snap = store.getSnapshot(req.params.snapshotId)
      if (!snap || snap.boardId !== req.params.id) { closeDb(db); res.status(404).json({ error: 'Snapshot not found' }); return }
      // Save current as pre-restore snapshot for safety
      store.createSnapshot({ boardId: req.params.id, reason: 'pre-restore', createdBy: user.email })
      const board = store.get(req.params.id)
      if (!board) { closeDb(db); res.status(404).json({ error: 'Board not found' }); return }
      store.saveState({ id: req.params.id, stateJson: snap.stateJson, expectedVersion: board.stateVersion })
      store.recordActivity({ boardId: req.params.id, userEmail: user.email, action: 'restored-snapshot', detail: req.params.snapshotId })
      closeDb(db)
      res.json({ ok: true })
    } catch (err: any) { res.status(500).json({ error: err.message }) }
  })

  // ── Activity log ──
  router.get('/api/whiteboards/:id/activity', (req, res) => {
    try {
      const db = openDb(root)
      const items = new WhiteboardsStore(db).listActivity(req.params.id, parseInt((req.query as any).limit || '50', 10))
      closeDb(db)
      res.json({ activity: items })
    } catch (err: any) { res.status(500).json({ error: err.message }) }
  })

  // ── Notifications ──
  router.get('/api/me/notifications', (req, res) => {
    const userId = (req as any).userId as string | undefined
    const user = getUser(root, userId)
    try {
      const db = openDb(root)
      const store = new WhiteboardsStore(db)
      const items = store.listNotifications(user.email, {
        unreadOnly: (req.query as any).unread === '1',
        limit: parseInt((req.query as any).limit || '50', 10),
      })
      const unread = store.unreadNotificationCount(user.email)
      closeDb(db)
      res.json({ notifications: items, unread })
    } catch (err: any) { res.status(500).json({ error: err.message }) }
  })

  router.post('/api/me/notifications/:id/read', (req, res) => {
    const userId = (req as any).userId as string | undefined
    const user = getUser(root, userId)
    try {
      const db = openDb(root)
      const ok = new WhiteboardsStore(db).markNotificationRead(req.params.id, user.email)
      closeDb(db)
      res.json({ ok })
    } catch (err: any) { res.status(500).json({ error: err.message }) }
  })

  router.post('/api/me/notifications/mark-all-read', (req, res) => {
    const userId = (req as any).userId as string | undefined
    const user = getUser(root, userId)
    try {
      const db = openDb(root)
      const count = new WhiteboardsStore(db).markAllNotificationsRead(user.email)
      closeDb(db)
      res.json({ ok: true, count })
    } catch (err: any) { res.status(500).json({ error: err.message }) }
  })

  // ── Presence (heartbeat-based) ──
  router.post('/api/whiteboards/:id/heartbeat', (req, res) => {
    const userId = (req as any).userId as string | undefined
    const user = getUser(root, userId)
    try {
      const db = openDb(root)
      new WhiteboardsStore(db).recordHeartbeat(req.params.id, user.email)
      closeDb(db)
      res.json({ ok: true })
    } catch (err: any) { res.status(500).json({ error: err.message }) }
  })

  router.get('/api/whiteboards/:id/presence', (req, res) => {
    try {
      const db = openDb(root)
      const editors = new WhiteboardsStore(db).activeEditors(req.params.id)
      closeDb(db)
      res.json({ editors })
    } catch (err: any) { res.status(500).json({ error: err.message }) }
  })

  return router
}

export { WHITEBOARD_TEMPLATES, colorForEmail }

/**
 * Simple K-means clustering on a list of equal-dimension numeric vectors.
 * Returns cluster index (0..K-1) for each input vector.
 * Uses cosine-similarity-friendly distance (L2 on L2-normalized vectors approximates cosine).
 */
function kMeansCluster(vectors: number[][], K: number, maxIter: number): number[] {
  const N = vectors.length
  const D = vectors[0]?.length || 0
  if (N === 0 || D === 0 || K <= 1) return vectors.map(() => 0)
  // L2-normalize each vector
  const norm = (v: number[]) => {
    const m = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1
    return v.map((x) => x / m)
  }
  const points = vectors.map(norm)
  // Init: pick K distinct points as initial centroids (k-means++ light: random first, then farthest)
  const centroids: number[][] = [points[Math.floor(Math.random() * N)].slice()]
  while (centroids.length < K) {
    let best = 0, bestD = -1
    for (let i = 0; i < N; i++) {
      const minD = Math.min(...centroids.map((c) => l2(points[i], c)))
      if (minD > bestD) { bestD = minD; best = i }
    }
    centroids.push(points[best].slice())
  }
  let assignments = new Array(N).fill(0)
  for (let it = 0; it < maxIter; it++) {
    // Assign
    const newAssignments = points.map((p) => {
      let bestK = 0, bestD = Infinity
      for (let k = 0; k < K; k++) {
        const d = l2(p, centroids[k])
        if (d < bestD) { bestD = d; bestK = k }
      }
      return bestK
    })
    // Check convergence
    if (newAssignments.every((v, i) => v === assignments[i])) break
    assignments = newAssignments
    // Recompute centroids
    for (let k = 0; k < K; k++) {
      const members = points.filter((_, i) => assignments[i] === k)
      if (!members.length) continue
      const c = new Array(D).fill(0)
      for (const m of members) for (let d = 0; d < D; d++) c[d] += m[d]
      for (let d = 0; d < D; d++) c[d] /= members.length
      centroids[k] = c
    }
  }
  return assignments
}

function l2(a: number[], b: number[]): number {
  let s = 0
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d }
  return s
}
