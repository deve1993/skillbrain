#!/usr/bin/env tsx
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import { withSkillsStore } from '../src/storage/skills-store.js'
import { getRegistryEntry, loadRegistry } from '../src/storage/registry.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SKILLS_DIR = process.argv[2] ?? join(__dirname, '../skills-draft')
const AUTHOR_USER_ID = process.argv[3]
const DRY_RUN = process.argv.includes('--dry')

if (!AUTHOR_USER_ID) {
  console.error('Usage: tsx scripts/bulk-import-skills.ts <skills-dir> <user_id> [--dry]')
  process.exit(1)
}

function resolveSkillBrainRoot(): string {
  const repoName = process.env.SKILLBRAIN_MEMORY_REPO ?? 'skillbrain'
  const envRoot = process.env.SKILLBRAIN_ROOT

  const entry = getRegistryEntry(repoName)
  if (entry) return entry.path

  const entries = loadRegistry()
  if (entries.length === 1) return entries[0].path

  if (envRoot) return envRoot

  throw new Error(
    'Cannot resolve SkillBrain root. Set SKILLBRAIN_ROOT env var or register a repo via codegraph.',
  )
}

const VALID_TYPES = ['domain', 'lifecycle', 'process', 'agent', 'command'] as const
type SkillType = (typeof VALID_TYPES)[number]

const errors: string[] = []
const imported: string[] = []

let root: string
try {
  root = resolveSkillBrainRoot()
} catch (err) {
  console.error((err as Error).message)
  process.exit(1)
}

let files: string[]
try {
  files = readdirSync(SKILLS_DIR).filter((f) => f.endsWith('.md'))
} catch {
  console.error(`Cannot read directory: ${SKILLS_DIR}`)
  process.exit(1)
}

console.log(`Found ${files.length} skill files in ${SKILLS_DIR}`)
if (DRY_RUN) console.log('DRY RUN — no writes\n')

for (const file of files) {
  const filePath = join(SKILLS_DIR, file)
  const raw = readFileSync(filePath, 'utf-8')
  const { data: fm, content } = matter(raw)

  // Required frontmatter
  if (!fm.name || !fm.description || !fm.category || !fm.type || !Array.isArray(fm.tags)) {
    errors.push(`${file}: missing required frontmatter (name, description, category, type, tags)`)
    continue
  }

  // Type validation
  if (!VALID_TYPES.includes(fm.type as SkillType)) {
    errors.push(`${file}: invalid type "${fm.type}" — must be one of: ${VALID_TYPES.join(', ')}`)
    continue
  }

  // Description length
  if (fm.description.length < 80 || fm.description.length > 180) {
    errors.push(
      `${file}: description must be 80-180 chars (got ${fm.description.length}): "${fm.description.slice(0, 60)}..."`,
    )
    continue
  }

  // Tags count
  if (fm.tags.length < 3 || fm.tags.length > 6) {
    errors.push(`${file}: tags must have 3-6 entries (got ${fm.tags.length})`)
    continue
  }

  const trimmedContent = content.trim()
  const lineCount = trimmedContent.split('\n').length

  // Length limit
  if (lineCount > 250) {
    errors.push(`${file}: skill too long — max 250 lines, got ${lineCount}`)
    continue
  }

  if (DRY_RUN) {
    console.log(`[DRY] Would import: ${fm.name} (${lineCount} lines, type=${fm.type}, category=${fm.category})`)
    imported.push(fm.name as string)
    continue
  }

  try {
    withSkillsStore(root, (store) => {
      store.upsert(
        {
          name: fm.name as string,
          category: fm.category as string,
          description: fm.description as string,
          content: trimmedContent,
          type: fm.type as SkillType,
          tags: fm.tags as string[],
          lines: lineCount,
          updatedAt: new Date().toISOString(),
          status: 'active',
          createdByUserId: AUTHOR_USER_ID,
        },
        { changedBy: AUTHOR_USER_ID, reason: 'import' },
      )
    })
    imported.push(fm.name as string)
    console.log(`✓ Imported: ${fm.name}`)
  } catch (err) {
    errors.push(`${file}: import failed — ${(err as Error).message}`)
  }
}

console.log(`\n=== Summary ===`)
console.log(`${DRY_RUN ? 'Would import' : 'Imported'}: ${imported.length}`)
if (errors.length) {
  console.log(`\nErrors (${errors.length}):`)
  errors.forEach((e) => console.log(`  ✗ ${e}`))
  process.exit(1)
}
