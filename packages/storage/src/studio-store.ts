/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import type Database from 'better-sqlite3'
import { randomId } from './utils/hash.js'
import { openDb, closeDb } from './db.js'
import { MemoryStore } from './memory-store.js'
import { getRegistryEntry, loadRegistry } from './registry.js'

// ── Public types ──────────────────────────────────────────────────────────────

export interface BriefData {
  goal?: string
  audience?: string
  tone?: string
  constraints?: string
  [key: string]: unknown
}

export type ConversationStatus = 'idle' | 'generating' | 'done' | 'error'

export interface Conversation {
  id: string
  title: string
  status: ConversationStatus
  briefData: BriefData | null
  skillId: string | null
  dsId: string | null
  directionId: string | null
  createdAt: string
  updatedAt: string
}

export interface ConversationSummary {
  id: string
  title: string
  status: ConversationStatus
  skillId: string | null
  dsId: string | null
  directionId: string | null
  updatedAt: string
}

export type MessageRole = 'user' | 'assistant' | 'artifact'

export interface Message {
  id: string
  convId: string
  role: MessageRole
  content: string
  artifactHtml: string | null
  createdAt: string
}

export type JobStatus = 'pending' | 'running' | 'done' | 'error'

export interface Job {
  id: string
  convId: string
  status: JobStatus
  agentModel: string
  critiqueModel: string
  promptSnapshot: string
  artifactHtml: string | null
  critiqueJson: string | null
  errorMsg: string | null
  createdAt: string
  updatedAt: string
}

export interface DesignSystem {
  id: string
  name: string
  category: string
  sourceUrl: string | null
  tokensJson: string
  guidelinesJson: string
  customTokensJson: string | null
  customNotes: string | null
  createdAt: string
  updatedAt: string
}

export interface DesignSystemSummary {
  id: string
  name: string
  category: string
  sourceUrl: string | null
  tokensJson: string
  updatedAt: string
}

export interface DsVersion {
  id: string
  dsId: string
  authorEmail: string
  changeJson: string
  createdAt: string
}

export interface StudioSkill {
  id: string
  name: string
  description: string
  category: string
  createdAt: string
}

export interface StudioDirection {
  id: string
  name: string
  description: string
  moodboardJson: string
  createdAt: string
}

export type MediaTemplateType = 'image' | 'video' | 'hyperframe' | 'audio'

export interface MediaTemplate {
  id: string
  name: string
  type: MediaTemplateType
  promptTemplate: string
  category: string | null
  createdAt: string
}

// ── Private row interfaces ────────────────────────────────────────────────────

interface ConversationRow {
  id: string
  title: string
  status: ConversationStatus
  brief_json: string | null
  skill_id: string | null
  ds_id: string | null
  direction_id: string | null
  created_at: string
  updated_at: string
}

interface MessageRow {
  id: string
  conv_id: string
  role: MessageRole
  content: string
  artifact_html: string | null
  created_at: string
}

interface JobRow {
  id: string
  conv_id: string
  status: JobStatus
  agent_model: string
  critique_model: string
  prompt_snapshot: string
  artifact_html: string | null
  critique_json: string | null
  error_msg: string | null
  created_at: string
  updated_at: string
}

interface DesignSystemRow {
  id: string
  name: string
  category: string
  source_url: string | null
  tokens_json: string
  guidelines_json: string
  custom_tokens_json: string | null
  custom_notes: string | null
  created_at: string
  updated_at: string
}

interface DsVersionRow {
  id: string
  ds_id: string
  author_email: string
  change_json: string
  created_at: string
}

interface StudioSkillRow {
  id: string
  name: string
  description: string
  category: string
  created_at: string
}

interface StudioDirectionRow {
  id: string
  name: string
  description: string
  moodboard_json: string
  created_at: string
}

interface MediaTemplateRow {
  id: string
  name: string
  type: MediaTemplateType
  prompt_template: string
  category: string | null
  created_at: string
}

// ── Row mappers ───────────────────────────────────────────────────────────────

function rowToConversation(r: ConversationRow): Conversation {
  let briefData: BriefData | null = null
  if (r.brief_json) {
    try { briefData = JSON.parse(r.brief_json) as BriefData } catch { briefData = null }
  }
  return {
    id: r.id,
    title: r.title,
    status: r.status,
    briefData,
    skillId: r.skill_id,
    dsId: r.ds_id,
    directionId: r.direction_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function rowToConversationSummary(r: ConversationRow): ConversationSummary {
  return {
    id: r.id,
    title: r.title,
    status: r.status,
    skillId: r.skill_id,
    dsId: r.ds_id,
    directionId: r.direction_id,
    updatedAt: r.updated_at,
  }
}

function rowToMessage(r: MessageRow): Message {
  return {
    id: r.id,
    convId: r.conv_id,
    role: r.role,
    content: r.content,
    artifactHtml: r.artifact_html,
    createdAt: r.created_at,
  }
}

function rowToJob(r: JobRow): Job {
  return {
    id: r.id,
    convId: r.conv_id,
    status: r.status,
    agentModel: r.agent_model,
    critiqueModel: r.critique_model,
    promptSnapshot: r.prompt_snapshot,
    artifactHtml: r.artifact_html,
    critiqueJson: r.critique_json,
    errorMsg: r.error_msg,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function rowToDesignSystem(r: DesignSystemRow): DesignSystem {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    sourceUrl: r.source_url,
    tokensJson: r.tokens_json,
    guidelinesJson: r.guidelines_json,
    customTokensJson: r.custom_tokens_json,
    customNotes: r.custom_notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function rowToDesignSystemSummary(r: DesignSystemRow): DesignSystemSummary {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    sourceUrl: r.source_url,
    tokensJson: r.tokens_json,
    updatedAt: r.updated_at,
  }
}

function rowToDsVersion(r: DsVersionRow): DsVersion {
  return {
    id: r.id,
    dsId: r.ds_id,
    authorEmail: r.author_email,
    changeJson: r.change_json,
    createdAt: r.created_at,
  }
}

function rowToSkill(r: StudioSkillRow): StudioSkill {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    category: r.category,
    createdAt: r.created_at,
  }
}

function rowToDirection(r: StudioDirectionRow): StudioDirection {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    moodboardJson: r.moodboard_json,
    createdAt: r.created_at,
  }
}

function rowToMediaTemplate(r: MediaTemplateRow): MediaTemplate {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    promptTemplate: r.prompt_template,
    category: r.category,
    createdAt: r.created_at,
  }
}

// ── Store ─────────────────────────────────────────────────────────────────────

export class StudioStore {
  constructor(private db: Database.Database) {}

  // ── Conversations ──

  listConversations(filter?: {
    status?: ConversationStatus
    skillId?: string
    dsId?: string
    directionId?: string
    limit?: number
  }): ConversationSummary[] {
    const where: string[] = []
    const params: unknown[] = []
    if (filter?.status) { where.push('status = ?'); params.push(filter.status) }
    if (filter?.skillId) { where.push('skill_id = ?'); params.push(filter.skillId) }
    if (filter?.dsId) { where.push('ds_id = ?'); params.push(filter.dsId) }
    if (filter?.directionId) { where.push('direction_id = ?'); params.push(filter.directionId) }
    const sql = `SELECT id, title, status, skill_id, ds_id, direction_id, updated_at
                 FROM studio_conversations
                 ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY updated_at DESC
                 LIMIT ?`
    params.push(filter?.limit ?? 100)
    const rows = this.db.prepare(sql).all(...params) as ConversationRow[]
    return rows.map(rowToConversationSummary)
  }

  createConversation(input: {
    title: string
    briefData?: BriefData | null
    skillId?: string | null
    dsId?: string | null
    directionId?: string | null
  }): Conversation {
    const id = randomId()
    const now = new Date().toISOString()
    this.db.prepare(
      `INSERT INTO studio_conversations (id, title, brief_json, skill_id, ds_id, direction_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.title,
      input.briefData ? JSON.stringify(input.briefData) : null,
      input.skillId ?? null,
      input.dsId ?? null,
      input.directionId ?? null,
      now,
      now,
    )
    return this.getConversation(id)!
  }

  getConversation(id: string): Conversation | undefined {
    const row = this.db.prepare(`SELECT * FROM studio_conversations WHERE id = ?`).get(id) as ConversationRow | undefined
    return row ? rowToConversation(row) : undefined
  }

  updateConversation(id: string, patch: {
    title?: string
    status?: ConversationStatus
    briefData?: BriefData | null
    skillId?: string | null
    dsId?: string | null
    directionId?: string | null
  }): Conversation | undefined {
    const sets: string[] = []
    const params: unknown[] = []
    if (patch.title !== undefined) { sets.push('title = ?'); params.push(patch.title) }
    if (patch.status !== undefined) { sets.push('status = ?'); params.push(patch.status) }
    if ('briefData' in patch) { sets.push('brief_json = ?'); params.push(patch.briefData ? JSON.stringify(patch.briefData) : null) }
    if ('skillId' in patch) { sets.push('skill_id = ?'); params.push(patch.skillId ?? null) }
    if ('dsId' in patch) { sets.push('ds_id = ?'); params.push(patch.dsId ?? null) }
    if ('directionId' in patch) { sets.push('direction_id = ?'); params.push(patch.directionId ?? null) }
    if (!sets.length) return this.getConversation(id)
    sets.push('updated_at = ?'); params.push(new Date().toISOString())
    params.push(id)
    this.db.prepare(`UPDATE studio_conversations SET ${sets.join(', ')} WHERE id = ?`).run(...params)
    return this.getConversation(id)
  }

  deleteConversation(id: string): boolean {
    const r = this.db.prepare(`DELETE FROM studio_conversations WHERE id = ?`).run(id)
    return r.changes > 0
  }

  // ── Messages ──

  listMessages(convId: string): Message[] {
    const rows = this.db.prepare(
      `SELECT * FROM studio_messages WHERE conv_id = ? ORDER BY created_at ASC`
    ).all(convId) as MessageRow[]
    return rows.map(rowToMessage)
  }

  addMessage(input: {
    convId: string
    role: MessageRole
    content: string
    artifactHtml?: string | null
  }): Message {
    const id = randomId()
    const now = new Date().toISOString()
    this.db.prepare(
      `INSERT INTO studio_messages (id, conv_id, role, content, artifact_html, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, input.convId, input.role, input.content, input.artifactHtml ?? null, now)
    // touch conversation updated_at
    this.db.prepare(`UPDATE studio_conversations SET updated_at = ? WHERE id = ?`).run(now, input.convId)
    return rowToMessage(
      this.db.prepare(`SELECT * FROM studio_messages WHERE id = ?`).get(id) as MessageRow
    )
  }

  // ── Jobs ──

  createJob(input: {
    convId: string
    agentModel: string
    critiqueModel: string
    promptSnapshot?: string
  }): Job {
    const id = randomId()
    const now = new Date().toISOString()
    this.db.prepare(
      `INSERT INTO studio_jobs (id, conv_id, agent_model, critique_model, prompt_snapshot, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, input.convId, input.agentModel, input.critiqueModel, input.promptSnapshot ?? '', now, now)
    return this.getJob(id)!
  }

  getJob(id: string): Job | undefined {
    const row = this.db.prepare(`SELECT * FROM studio_jobs WHERE id = ?`).get(id) as JobRow | undefined
    return row ? rowToJob(row) : undefined
  }

  updateJob(id: string, patch: {
    status?: JobStatus
    artifactHtml?: string | null
    critiqueJson?: string | null
    errorMsg?: string | null
    promptSnapshot?: string
  }): Job | undefined {
    const sets: string[] = []
    const params: unknown[] = []
    if (patch.status !== undefined) { sets.push('status = ?'); params.push(patch.status) }
    if ('artifactHtml' in patch) { sets.push('artifact_html = ?'); params.push(patch.artifactHtml ?? null) }
    if ('critiqueJson' in patch) { sets.push('critique_json = ?'); params.push(patch.critiqueJson ?? null) }
    if ('errorMsg' in patch) { sets.push('error_msg = ?'); params.push(patch.errorMsg ?? null) }
    if (patch.promptSnapshot !== undefined) { sets.push('prompt_snapshot = ?'); params.push(patch.promptSnapshot) }
    if (!sets.length) return this.getJob(id)
    sets.push('updated_at = ?'); params.push(new Date().toISOString())
    params.push(id)
    this.db.prepare(`UPDATE studio_jobs SET ${sets.join(', ')} WHERE id = ?`).run(...params)
    return this.getJob(id)
  }

  listJobs(convId: string, limit = 20): Job[] {
    const rows = this.db.prepare(
      `SELECT * FROM studio_jobs WHERE conv_id = ? ORDER BY created_at DESC LIMIT ?`
    ).all(convId, limit) as JobRow[]
    return rows.map(rowToJob)
  }

  listJobsForConv(convId: string): Job[] {
    const rows = this.db
      .prepare(`SELECT * FROM studio_jobs WHERE conv_id = ? ORDER BY created_at DESC`)
      .all(convId) as JobRow[]
    return rows.map(rowToJob)
  }

  // ── Design Systems ──

  listDesignSystems(filter?: {
    category?: string
    search?: string
    limit?: number
  }): DesignSystemSummary[] {
    const where: string[] = []
    const params: unknown[] = []
    if (filter?.category) { where.push('category = ?'); params.push(filter.category) }
    if (filter?.search) {
      where.push("LOWER(name) LIKE ?")
      params.push(`%${filter.search.toLowerCase()}%`)
    }
    const sql = `SELECT id, name, category, source_url, tokens_json, updated_at
                 FROM studio_design_systems
                 ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY name ASC
                 LIMIT ?`
    params.push(filter?.limit ?? 200)
    const rows = this.db.prepare(sql).all(...params) as DesignSystemRow[]
    return rows.map(rowToDesignSystemSummary)
  }

  getDesignSystem(id: string): DesignSystem | undefined {
    const row = this.db.prepare(`SELECT * FROM studio_design_systems WHERE id = ?`).get(id) as DesignSystemRow | undefined
    return row ? rowToDesignSystem(row) : undefined
  }

  updateDesignSystem(id: string, patch: {
    customTokensJson?: string | null
    customNotes?: string | null
    guidelinesJson?: string
  }): DesignSystem | undefined {
    const sets: string[] = []
    const params: unknown[] = []
    if ('customTokensJson' in patch) { sets.push('custom_tokens_json = ?'); params.push(patch.customTokensJson ?? null) }
    if ('customNotes' in patch) { sets.push('custom_notes = ?'); params.push(patch.customNotes ?? null) }
    if (patch.guidelinesJson !== undefined) { sets.push('guidelines_json = ?'); params.push(patch.guidelinesJson) }
    if (!sets.length) return this.getDesignSystem(id)
    sets.push('updated_at = ?'); params.push(new Date().toISOString())
    params.push(id)
    this.db.prepare(`UPDATE studio_design_systems SET ${sets.join(', ')} WHERE id = ?`).run(...params)
    return this.getDesignSystem(id)
  }

  // ── Design System Versions ──

  createDsVersion(input: {
    dsId: string
    authorEmail: string
    changeJson: string
  }): DsVersion {
    const id = randomId()
    const now = new Date().toISOString()
    this.db.prepare(
      `INSERT INTO studio_ds_versions (id, ds_id, author_email, change_json, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, input.dsId, input.authorEmail, input.changeJson, now)
    return rowToDsVersion(
      this.db.prepare(`SELECT * FROM studio_ds_versions WHERE id = ?`).get(id) as DsVersionRow
    )
  }

  listDsVersions(dsId: string, limit = 20): DsVersion[] {
    const rows = this.db.prepare(
      `SELECT * FROM studio_ds_versions WHERE ds_id = ? ORDER BY created_at DESC LIMIT ?`
    ).all(dsId, limit) as DsVersionRow[]
    return rows.map(rowToDsVersion)
  }

  // ── Skills ──

  listSkills(filter?: { category?: string }): StudioSkill[] {
    const where = filter?.category ? 'WHERE category = ?' : ''
    const params = filter?.category ? [filter.category] : []
    const rows = this.db.prepare(
      `SELECT * FROM studio_skills ${where} ORDER BY category ASC, name ASC`
    ).all(...params) as StudioSkillRow[]
    return rows.map(rowToSkill)
  }

  // ── Directions ──

  listDirections(): StudioDirection[] {
    const rows = this.db.prepare(
      `SELECT * FROM studio_directions ORDER BY name ASC`
    ).all() as StudioDirectionRow[]
    return rows.map(rowToDirection)
  }

  // ── Media Templates ──

  listMediaTemplates(filter?: {
    type?: MediaTemplateType
    category?: string
  }): MediaTemplate[] {
    const where: string[] = []
    const params: unknown[] = []
    if (filter?.type) { where.push('type = ?'); params.push(filter.type) }
    if (filter?.category) { where.push('category = ?'); params.push(filter.category) }
    const rows = this.db.prepare(
      `SELECT * FROM studio_media_templates
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY type ASC, name ASC`
    ).all(...params) as MediaTemplateRow[]
    return rows.map(rowToMediaTemplate)
  }

  // ── Context ──

  private resolveMemoryRepo(): string | null {
    const name = process.env.SKILLBRAIN_MEMORY_REPO || 'skillbrain'
    const entry = getRegistryEntry(name)
    if (entry) return entry.path
    const entries = loadRegistry()
    if (entries.length === 1) return entries[0].path
    const root = process.env.SKILLBRAIN_ROOT
    if (root) return root
    return null
  }

  buildContextBlock(convId: string): string {
    const conv = this.getConversation(convId)
    if (!conv) return ''

    const repoPath = this.resolveMemoryRepo()
    if (!repoPath) return ''

    let memoriesBlock = ''
    try {
      const memDb = openDb(repoPath)
      const memStore = new MemoryStore(memDb)
      try {
        const briefData = conv.briefData ?? {}
        const surface = typeof briefData.surface === 'string' ? briefData.surface : ''
        const queryParts = [surface, conv.skillId ?? ''].filter(Boolean)
        const query = queryParts.join(' ') || conv.title
        const mems = memStore.search(query, 5)
        if (mems.length) {
          memoriesBlock = '<memories>\n' +
            mems.map((r) =>
              `  <memory type="${r.memory.type}">${r.memory.context || r.memory.solution}</memory>`
            ).join('\n') +
            '\n</memories>'
        }
      } finally {
        closeDb(memDb)
      }
    } catch {
      // memory search is best-effort
    }

    return memoriesBlock
  }
}
