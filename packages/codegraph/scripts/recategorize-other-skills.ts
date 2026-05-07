/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import { openDb, closeDb } from '../src/storage/db.js'
import { SkillsStore } from '../src/storage/skills-store.js'

const root = process.env.SKILLBRAIN_ROOT ?? process.cwd()
console.log(`[recategorize-other] target: ${root}`)

const KEYWORD_MAP: Array<[RegExp, string]> = [
  [/seo|sitemap|schema|meta-tag|geo|llm-search/i, 'SEO'],
  [/copy|growth|cro|landing|funnel|saas-copy/i, 'Marketing'],
  [/component|button|ui|tailwind|shadcn|design/i, 'Frontend'],
  [/api|rest|graphql|endpoint|server-action/i, 'Backend'],
  [/cms|payload|wordpress|shopify/i, 'CMS'],
  [/docker|coolify|deploy|ci|cd|github-actions/i, 'Infrastructure'],
  [/security|auth|oauth|csrf|xss/i, 'Security'],
  [/legal|gdpr|privacy|cookie|tos/i, 'Legal'],
  [/perf|performance|core-web-vital|lighthouse/i, 'Performance'],
  [/n8n|workflow|automation/i, 'Automation'],
  [/test|playwright|vitest/i, 'Testing'],
  [/db|database|sqlite|postgres|migration/i, 'Backend'],
]

interface RecategorizeProposal {
  name: string
  currentCategory: string
  proposedCategory: string
  reason: string
  description: string
}

const db = openDb(root)
try {
  const store = new SkillsStore(db)
  const others = store.list().filter((s) => s.category === 'Other')

  const proposals: RecategorizeProposal[] = others.map((s) => {
    const haystack = `${s.name} ${s.description} ${(s.tags || []).join(' ')}`.toLowerCase()
    const match = KEYWORD_MAP.find(([re]) => re.test(haystack))
    return {
      name: s.name,
      currentCategory: s.category,
      proposedCategory: match ? match[1] : 'Other',
      reason: match ? `keyword match: ${match[0].source}` : 'no keyword match — manual review',
      description: s.description,
    }
  })

  console.log(JSON.stringify({ scanned: others.length, proposals }, null, 2))
} finally {
  closeDb(db)
}
