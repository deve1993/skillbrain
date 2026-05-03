/*
 * SkillBrain — Self-hosted AI memory platform
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import { Router, json } from 'express'
import { openDb, closeDb } from '../../storage/db.js'
import { MemoryStore } from '../../storage/memory-store.js'
import { ProjectsStore } from '../../storage/projects-store.js'
import { ComponentsStore } from '../../storage/components-store.js'
import { AuditStore } from '../../storage/audit-store.js'
import { decrypt } from '../../storage/crypto.js'
import type { RouteContext } from './index.js'

export function createProjectsRouter(ctx: RouteContext): Router {
  const router = Router()

  // Session-based project views (from MemoryStore)
  router.get('/api/projects', (_req, res) => {
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new MemoryStore(db)
      const projects = store.listProjects()
      closeDb(db)
      res.json({ projects })
    } catch {
      res.json({ projects: [] })
    }
  })

  router.get('/api/projects/:name', (req, res) => {
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new MemoryStore(db)
      const detail = store.projectDetail(req.params.name)
      closeDb(db)
      res.json(detail)
    } catch {
      res.status(500).json({ error: 'Internal error' })
    }
  })

  // Project metadata CRUD (from ProjectsStore)
  router.get('/api/projects-meta', (_req, res) => {
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new ProjectsStore(db)
      const projects = store.listSanitized()
      closeDb(db)
      res.json({ projects })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  router.get('/api/projects-meta/:name', (req, res) => {
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new ProjectsStore(db)
      const project = store.getSanitized(req.params.name)
      closeDb(db)
      if (!project) { res.status(404).json({ error: 'Not found' }); return }
      res.json(project)
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  router.put('/api/projects-meta/:name', (req, res) => {
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new ProjectsStore(db)
      const project = store.upsert({ name: req.params.name, ...(req.body || {}) })
      closeDb(db)
      res.json({ ok: true, project })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  router.delete('/api/projects-meta/:name', (req, res) => {
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new ProjectsStore(db)
      store.delete(req.params.name)
      closeDb(db)
      res.json({ ok: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  router.post('/api/projects-meta/merge', (req, res) => {
    const { primary, aliases } = req.body || {}
    if (!primary || !aliases?.length) {
      res.status(400).json({ error: 'primary and aliases[] required' }); return
    }
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new ProjectsStore(db)
      const result = store.merge(primary, aliases)
      closeDb(db)
      res.json({ ok: true, ...result })
    } catch (err: any) {
      res.status(400).json({ error: err.message })
    }
  })

  // Project env vars
  router.get('/api/projects-meta/:name/env', (req, res) => {
    try {
      const environment = (req.query as any).environment || 'production'
      const db = openDb(ctx.skillbrainRoot)
      const store = new ProjectsStore(db)
      const vars = store.listEnvNames(String(req.params.name), environment)
      closeDb(db)
      res.json({ vars })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  router.post('/api/projects-meta/:name/env/reveal', (req, res) => {
    const { varName, environment } = req.body || {}
    if (!varName) { res.status(400).json({ error: 'varName required' }); return }
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new ProjectsStore(db)
      const value = store.getEnv(req.params.name, varName, environment)
      closeDb(db)
      if (value === undefined) { res.status(404).json({ error: 'Not found' }); return }
      res.json({ varName, value })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  router.post('/api/projects-meta/:name/env/export', (req, res) => {
    const { environment } = req.body || {}
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new ProjectsStore(db)
      const vars = store.getAllEnv(req.params.name, environment)
      closeDb(db)
      const content = Object.entries(vars).map(([k, v]) => `${k}=${v}`).join('\n')
      res.json({ content, count: Object.keys(vars).length })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  router.post('/api/projects-meta/:name/env/import', (req, res) => {
    const { envContent, environment, category, service } = req.body || {}
    if (!envContent) { res.status(400).json({ error: 'envContent required' }); return }
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new ProjectsStore(db)
      const lines = envContent.split('\n')
      let saved = 0
      const errors: string[] = []
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue
        const name = trimmed.slice(0, eqIdx).trim()
        let value = trimmed.slice(eqIdx + 1).trim()
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1)
        }
        if (!name || !value) continue
        try {
          const isSecret = !name.startsWith('NEXT_PUBLIC_') && !name.startsWith('PUBLIC_')
          store.setEnv(req.params.name, name, value, environment || 'production', '.env', isSecret, undefined, category, service)
          saved++
        } catch (e: any) {
          errors.push(`${name}: ${e.message}`)
        }
      }
      closeDb(db)
      res.json({ ok: true, saved, errors })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  router.delete('/api/projects-meta/:name/env/:varName', (req, res) => {
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new ProjectsStore(db)
      store.deleteEnv(req.params.name, req.params.varName)
      closeDb(db)
      res.json({ ok: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // Worklog
  router.get('/api/worklog', (_req, res) => {
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new MemoryStore(db)
      const log = store.workLog()
      closeDb(db)
      res.json(log)
    } catch {
      res.json({})
    }
  })

  // Components
  router.get('/api/components', (req, res) => {
    const { project, type, tag, search, limit } = req.query as any
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new ComponentsStore(db)
      let components
      if (search) {
        components = store.searchComponents(search, parseInt(limit || '50', 10)).map((r) => r.component)
      } else {
        components = store.listComponents({ project, sectionType: type, tag, limit: parseInt(limit || '100', 10) })
      }
      const stats = store.componentStats()
      closeDb(db)
      res.json({ components, total: stats.total, stats })
    } catch {
      res.json({ components: [], total: 0, stats: {} })
    }
  })

  router.get('/api/components/:id', (req, res) => {
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new ComponentsStore(db)
      const component = store.getComponent(String(req.params.id))
      closeDb(db)
      if (!component) { res.status(404).json({ error: 'Component not found' }); return }
      res.json(component)
    } catch {
      res.status(500).json({ error: 'Internal error' })
    }
  })

  router.post('/api/components', (req, res) => {
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new ComponentsStore(db)
      const component = store.addComponent(req.body || {})
      closeDb(db)
      res.json({ ok: true, component })
    } catch (err: any) {
      res.status(400).json({ error: err.message })
    }
  })

  router.delete('/api/components/:id', (req, res) => {
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new ComponentsStore(db)
      store.deleteComponent(String(req.params.id))
      closeDb(db)
      res.json({ ok: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // Design Systems
  router.get('/api/design-systems', (_req, res) => {
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new ComponentsStore(db)
      const designSystems = store.listDesignSystems()
      closeDb(db)
      res.json({ designSystems, total: designSystems.length })
    } catch {
      res.json({ designSystems: [], total: 0 })
    }
  })

  router.get('/api/design-systems/:project', (req, res) => {
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new ComponentsStore(db)
      const ds = store.getDesignSystem(String(req.params.project))
      closeDb(db)
      if (!ds) { res.status(404).json({ error: 'Design system not found' }); return }
      res.json(ds)
    } catch {
      res.status(500).json({ error: 'Internal error' })
    }
  })

  router.post('/api/design-systems/merge', (req, res) => {
    const { primary, alias } = req.body as { primary: string; alias: string }
    if (!primary || !alias) { res.status(400).json({ error: 'primary and alias required' }); return }
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new ComponentsStore(db)
      const result = store.mergeDesignSystems(primary, alias)
      closeDb(db)
      res.json({ ok: true, designSystem: result })
    } catch (err: any) {
      res.status(400).json({ error: err.message })
    }
  })

  router.get('/api/design-systems/pending', (_req, res) => {
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new ComponentsStore(db)
      const scans = store.getPendingScans()
      closeDb(db)
      res.json({ scans })
    } catch {
      res.status(500).json({ error: 'Internal error' })
    }
  })

  router.get('/api/design-systems/scans/:project', (req, res) => {
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new ComponentsStore(db)
      const scans = store.getPendingScans(String(req.params.project))
      closeDb(db)
      res.json({ scans })
    } catch {
      res.status(500).json({ error: 'Internal error' })
    }
  })

  router.post('/api/design-systems/:project/apply-scan', json(), (req, res) => {
    const { scanId, resolved } = req.body as { scanId: string; resolved: Record<string, unknown> }
    if (!scanId) { res.status(400).json({ error: 'scanId required' }); return }
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new ComponentsStore(db)
      const ds = store.applyDesignSystemScan(scanId, resolved)
      closeDb(db)
      res.json({ ok: true, designSystem: ds })
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  router.delete('/api/design-systems/scans/:scanId', (req, res) => {
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new ComponentsStore(db)
      store.dismissDesignSystemScan(String(req.params.scanId))
      closeDb(db)
      res.json({ ok: true })
    } catch {
      res.status(500).json({ error: 'Internal error' })
    }
  })

  return router
}
