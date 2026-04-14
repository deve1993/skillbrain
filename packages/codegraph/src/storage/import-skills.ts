/**
 * Import skills, agents, and commands from filesystem into SQLite.
 *
 * Walks .opencode/skill/, .agents/skills/, .opencode/agents/, .opencode/command/
 * and imports all SKILL.md, AGENT.md, and command .md files.
 */

import fs from 'node:fs'
import path from 'node:path'
import { openDb, closeDb } from './db.js'
import { SkillsStore, type Skill, type SkillType } from './skills-store.js'

// Category detection from skill name
const CATEGORY_MAP: Record<string, string> = {
  nextjs: 'Frontend', tailwind: 'Frontend', shadcn: 'Frontend', fonts: 'Frontend',
  animations: 'Frontend', 'motion-system': 'Frontend', state: 'Frontend',
  'mobile-first': 'Frontend', i18n: 'Frontend',
  trpc: 'Backend', auth: 'Backend', forms: 'Backend', database: 'Backend',
  email: 'Backend', payments: 'Backend', 'odoo-crm-lead': 'Backend',
  realtime: 'Realtime', 'background-jobs': 'Realtime', n8n: 'Automation',
  payload: 'CMS', cms: 'CMS', mongodb: 'CMS',
  'ci-cd': 'Infrastructure', coolify: 'Infrastructure', docker: 'Infrastructure',
  'monitoring-nextjs': 'Monitoring', 'security-headers': 'Security',
  analytics: 'Monitoring', performance: 'Performance', pwa: 'Performance',
  'file-handling': 'Files', media: 'Files', ffmpeg: 'Files', remotion: 'Video',
  seo: 'SEO', 'seo-for-devs': 'SEO', 'seo-audit': 'SEO',
  'landing-architecture': 'Marketing', copywriting: 'Marketing',
  'cro-patterns': 'Marketing', gdpr: 'Legal', iubenda: 'Legal',
  'legal-templates': 'Legal',
}

function detectCategory(name: string): string {
  if (CATEGORY_MAP[name]) return CATEGORY_MAP[name]
  if (name.startsWith('seo-')) return 'SEO'
  if (name.startsWith('pixarts')) return 'Pixarts'
  if (name.includes('cro') || name.includes('marketing') || name.includes('strategy')) return 'Marketing'
  return 'Other'
}

function parseFrontmatter(content: string): { name?: string; description?: string; [key: string]: any } {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}

  const yaml = match[1]
  const result: Record<string, string> = {}

  for (const line of yaml.split('\n')) {
    const kv = line.match(/^(\w[\w-]*):\s*(.+)$/)
    if (kv) {
      result[kv[1]] = kv[2].replace(/^["']|["']$/g, '').trim()
    }
  }

  // Handle multi-line description
  const descMatch = yaml.match(/description:\s*>\s*\n([\s\S]*?)(?=\n\w|\n---|\n$)/)
  if (descMatch) {
    result.description = descMatch[1].replace(/\n\s*/g, ' ').trim()
  }

  return result
}

function walkDir(dir: string, callback: (file: string, name: string) => void): void {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      // Look for SKILL.md or AGENT.md in subdirectory
      for (const mdFile of ['SKILL.md', 'AGENT.md']) {
        const mdPath = path.join(full, mdFile)
        if (fs.existsSync(mdPath)) {
          callback(mdPath, entry.name)
        }
      }
    } else if (entry.name.endsWith('.md')) {
      callback(full, entry.name.replace('.md', ''))
    }
  }
}

export function importSkills(workspacePath: string): { skills: number; agents: number; commands: number } {
  const db = openDb(workspacePath)
  const store = new SkillsStore(db)

  const now = new Date().toISOString()
  const skills: Skill[] = []
  let agentCount = 0
  let commandCount = 0

  // Import domain skills from .opencode/skill/
  const domainDir = path.join(workspacePath, '.opencode', 'skill')
  walkDir(domainDir, (filePath, name) => {
    if (name === 'INDEX') return // skip INDEX.md
    const content = fs.readFileSync(filePath, 'utf-8')
    const fm = parseFrontmatter(content)
    skills.push({
      name: fm.name || name,
      category: detectCategory(name),
      description: fm.description || `Domain skill: ${name}`,
      content,
      type: 'domain',
      tags: extractTags(name, content),
      lines: content.split('\n').length,
      updatedAt: now,
    })
  })

  // Import lifecycle/process skills from .agents/skills/
  const agentsSkillDir = path.join(workspacePath, '.agents', 'skills')
  walkDir(agentsSkillDir, (filePath, name) => {
    const content = fs.readFileSync(filePath, 'utf-8')
    const fm = parseFrontmatter(content)
    const type: SkillType = isLifecycleSkill(name) ? 'lifecycle' : 'process'
    skills.push({
      name: fm.name || name,
      category: type === 'lifecycle' ? 'Lifecycle' : 'Process',
      description: fm.description || `${type} skill: ${name}`,
      content,
      type,
      tags: extractTags(name, content),
      lines: content.split('\n').length,
      updatedAt: now,
    })
  })

  // Import agents from .opencode/agents/ (subdirs with AGENT.md)
  const agentsDir = path.join(workspacePath, '.opencode', 'agents')
  walkDir(agentsDir, (filePath, name) => {
    const content = fs.readFileSync(filePath, 'utf-8')
    const fm = parseFrontmatter(content)
    skills.push({
      name: `agent:${name}`,
      category: 'Agents',
      description: fm.description || `Agent: ${name}`,
      content,
      type: 'agent',
      tags: [name, 'agent', fm.model || 'sonnet'].filter(Boolean),
      lines: content.split('\n').length,
      updatedAt: now,
    })
    agentCount++
  })

  // Also import .opencode/agent/*.md (flat agent files)
  const agentFlatDir = path.join(workspacePath, '.opencode', 'agent')
  if (fs.existsSync(agentFlatDir)) {
    for (const entry of fs.readdirSync(agentFlatDir)) {
      if (!entry.endsWith('.md')) continue
      const filePath = path.join(agentFlatDir, entry)
      const name = entry.replace(/^\d+-/, '').replace('.md', '')
      const content = fs.readFileSync(filePath, 'utf-8')
      const fm = parseFrontmatter(content)
      if (!skills.find((s) => s.name === `agent:${name}`)) {
        skills.push({
          name: `agent:${name}`,
          category: 'Agents',
          description: fm.description || `Agent: ${name}`,
          content,
          type: 'agent',
          tags: [name, 'agent'].filter(Boolean),
          lines: content.split('\n').length,
          updatedAt: now,
        })
        agentCount++
      }
    }
  }

  // Import commands from .opencode/command/
  const commandDir = path.join(workspacePath, '.opencode', 'command')
  if (fs.existsSync(commandDir)) {
    for (const entry of fs.readdirSync(commandDir)) {
      if (!entry.endsWith('.md')) continue
      const filePath = path.join(commandDir, entry)
      const name = entry.replace('.md', '')
      const content = fs.readFileSync(filePath, 'utf-8')
      skills.push({
        name: `command:${name}`,
        category: 'Commands',
        description: `Slash command: /${name}`,
        content,
        type: 'command',
        tags: [name, 'command'],
        lines: content.split('\n').length,
        updatedAt: now,
      })
      commandCount++
    }
  }

  // Import INDEX.md as a special skill
  const indexPath = path.join(domainDir, 'INDEX.md')
  if (fs.existsSync(indexPath)) {
    const content = fs.readFileSync(indexPath, 'utf-8')
    skills.push({
      name: '_routing-index',
      category: 'System',
      description: 'Master routing table — maps tasks to skills',
      content,
      type: 'domain',
      tags: ['routing', 'index', 'system'],
      lines: content.split('\n').length,
      updatedAt: now,
    })
  }

  // Batch insert
  store.upsertBatch(skills)

  closeDb(db)

  const domainCount = skills.filter((s) => s.type === 'domain').length
  return { skills: domainCount, agents: agentCount, commands: commandCount }
}

function isLifecycleSkill(name: string): boolean {
  return ['codegraph-context', 'capture-learning', 'load-learnings', 'post-session-review', 'using-superpowers'].includes(name)
}

function extractTags(name: string, content: string): string[] {
  const tags = [name]
  // Extract from frontmatter tags if present
  const tagMatch = content.match(/tags:\s*\[([^\]]+)\]/)
  if (tagMatch) {
    tags.push(...tagMatch[1].split(',').map((t) => t.trim().replace(/["']/g, '')))
  }
  return [...new Set(tags)].slice(0, 5)
}

// CLI entry point
if (process.argv[1]?.endsWith('import-skills.js')) {
  const workspace = process.argv[2] || process.cwd()
  console.log(`Importing skills from: ${workspace}`)
  const result = importSkills(workspace)
  console.log(`✅ Import complete:`)
  console.log(`   Skills: ${result.skills}`)
  console.log(`   Agents: ${result.agents}`)
  console.log(`   Commands: ${result.commands}`)
}
