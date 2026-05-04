#!/usr/bin/env node
/*
 * SkillBrain — Self-hosted AI memory platform
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadRegistry } from '@skillbrain/storage'
import { openDb, closeDb } from '@skillbrain/storage'
import { GraphStore } from '@skillbrain/storage'
import { MemoryStore } from '@skillbrain/storage'
import { ComponentsStore } from '@skillbrain/storage'
import { SkillsStore } from '@skillbrain/storage'

const PORT = parseInt(process.env.PORT || '3737', 10)
const SKILLBRAIN_ROOT = process.env.SKILLBRAIN_ROOT || process.cwd()

// --- Skill categories for granular display ---
const SKILL_CATEGORIES: Record<string, string[]> = {
  'Core Frontend': ['nextjs', 'tailwind', 'shadcn', 'fonts', 'animations', 'motion-system', 'state', 'mobile-first', 'i18n'],
  'Backend & API': ['trpc', 'auth', 'forms', 'database', 'email', 'payments', 'odoo-crm-lead', 'odoo-api-query'],
  'Real-time & Async': ['realtime', 'background-jobs', 'n8n'],
  'CMS': ['payload', 'cms', 'mongodb'],
  'Infrastructure': ['ci-cd', 'coolify', 'docker', 'project-automation'],
  'Monitoring & Security': ['monitoring-nextjs', 'security-headers', 'analytics', 'analytics-tracking'],
  'Performance & PWA': ['performance', 'pwa'],
  'Files & Media': ['file-handling', 'media', 'ffmpeg', 'remotion'],
  'SEO': ['seo', 'seo-for-devs', 'seo-audit', 'seo-page', 'seo-technical', 'seo-content', 'seo-schema', 'seo-images', 'seo-sitemap', 'seo-geo', 'seo-plan', 'seo-programmatic', 'seo-competitor-pages', 'seo-hreflang', 'seo-sitemap-advanced', 'ai-seo', 'programmatic-seo', 'schema-markup', 'sitemap', 'site-architecture'],
  'Marketing & CRO': ['landing-architecture', 'copywriting', 'copy-editing', 'cro-patterns', 'form-cro', 'popup-cro', 'signup-flow-cro', 'onboarding-cro', 'paywall-upgrade-cro', 'ab-testing', 'email-sequence', 'cold-email', 'social-content', 'ad-creative', 'marketing-ideas', 'marketing-psychology', 'launch-strategy', 'pricing-strategy', 'free-tool-strategy', 'referral-program', 'churn-prevention', 'sales-enablement', 'revops', 'paid-ads', 'product-marketing-context', 'content-strategy', 'competitor-alternatives'],
  'Legal & GDPR': ['gdpr', 'legal-templates', 'iubenda'],
  'Frameworks': ['astro', 'nuxt', 'sveltekit'],
  'Pixarts Workflow': ['pixarts/workflow', 'pixarts/client-site', 'pixarts/multitenancy', 'pixarts/design-system', 'pixarts/template-architecture', 'pixarts/cms-modules'],
  'Tools & MCP': ['figma', 'stitch', 'agent-browser', 'website-cloning', 'scraping'],
  'Quality & Process': ['quality-gates', 'testing', 'project-health-check', 'skill-creator', 'skill-eval', 'skill-template-2.0'],
}

const AGENT_CATEGORIES: Record<string, string[]> = {
  'Process / Lifecycle': ['brainstorming', 'systematic-debugging', 'writing-plans', 'executing-plans', 'test-driven-development', 'subagent-driven-development', 'dispatching-parallel-agents', 'verification-before-completion', 'requesting-code-review', 'receiving-code-review', 'using-git-worktrees', 'finishing-a-development-branch', 'using-superpowers', 'writing-skills', 'codegraph-context', 'capture-learning', 'load-learnings', 'post-session-review'],
  'Frontend & Design': ['frontend-design', 'ui-ux-pro-max', 'web-design-guidelines', 'next-best-practices', 'vercel-react-best-practices', 'audit-website'],
  'AI & LLM': ['ai-sdk', 'rag-architect', 'prompt-engineer', 'fine-tuning-expert', 'mcp-developer'],
  'Mobile': ['react-native-best-practices', 'react-native-expert', 'building-native-ui', 'native-data-fetching', 'expo-tailwind-setup', 'expo-cicd-workflows', 'expo-api-routes', 'expo-deployment', 'expo-dev-client', 'expo-module', 'expo-ui-swiftui', 'expo-ui-jetpack-compose', 'upgrading-expo', 'upgrading-react-native', 'react-native-brownfield-migration', 'use-dom'],
  'Backend & DB': ['api-designer', 'graphql-architect', 'postgres-pro', 'database-optimizer', 'sql-pro', 'redis-development', 'microservices-architect', 'nestjs-expert', 'fastapi-expert'],
  'DevOps & Infra': ['devops-engineer', 'terraform-engineer', 'kubernetes-specialist', 'sre-engineer', 'cloud-architect', 'chaos-engineer', 'docker', 'github-actions'],
  'Security': ['secure-code-guardian', 'security-reviewer'],
  'Languages': ['typescript-pro', 'javascript-pro', 'python-pro', 'golang-pro', 'rust-engineer', 'cpp-pro', 'csharp-developer', 'java-architect', 'kotlin-specialist', 'swift-expert', 'php-pro'],
  'Frameworks (External)': ['react-expert', 'nextjs-developer', 'vue-expert', 'vue-expert-js', 'django-expert', 'rails-expert', 'laravel-specialist', 'spring-boot-engineer', 'dotnet-core-expert', 'flutter-expert', 'shopify-expert', 'wordpress-pro', 'salesforce-developer'],
  'Other': ['fullstack-guardian', 'test-master', 'code-documenter', 'code-reviewer', 'cli-developer', 'embedded-systems', 'game-developer', 'legacy-modernizer', 'ml-pipeline', 'spark-engineer', 'monitoring-expert', 'playwright-expert', 'websocket-engineer', 'feature-forge', 'spec-miner', 'the-fool', 'validate-skills', 'architecture-designer', 'debugging-wizard', 'hads'],
}

function getRepoDetails() {
  return loadRegistry().map((e) => {
    const details: any = { ...e }
    try {
      const db = openDb(e.path)
      const store = new GraphStore(db)
      details.topSymbols = store.rawQuery("SELECT name, label, file_path FROM nodes WHERE label IN ('Function','Class','Interface') AND is_exported = 1 ORDER BY name LIMIT 20")
      details.edgeTypes = store.rawQuery("SELECT type, COUNT(*) as count FROM edges GROUP BY type ORDER BY count DESC")
      details.communities = store.rawQuery("SELECT n.name, json_extract(n.properties, '$.memberCount') as members FROM nodes n WHERE n.label = 'Community' ORDER BY members DESC")
      details.processes = store.rawQuery("SELECT name, json_extract(properties, '$.entryPoint') as entry, json_extract(properties, '$.stepCount') as steps FROM nodes WHERE label = 'Process' ORDER BY steps DESC")
      details.fileDist = store.rawQuery("SELECT CASE WHEN file_path LIKE 'src/components/%' THEN 'components' WHEN file_path LIKE 'src/app/%' THEN 'app' WHEN file_path LIKE 'src/lib/%' THEN 'lib' WHEN file_path LIKE 'src/hooks/%' THEN 'hooks' WHEN file_path LIKE 'src/utils/%' THEN 'utils' ELSE 'other' END as dir, COUNT(*) as count FROM nodes WHERE label != 'File' AND label != 'Community' AND label != 'Process' GROUP BY dir ORDER BY count DESC")
      closeDb(db)
    } catch {}
    return details
  })
}

function getSkillsGrouped() {
  const domainDir = path.join(SKILLBRAIN_ROOT, '.opencode', 'skill')
  const agentDir = path.join(SKILLBRAIN_ROOT, '.agents', 'skills')
  const commandDir = path.join(SKILLBRAIN_ROOT, '.opencode', 'command')
  const all = getDirs(domainDir).map((n) => ({ name: n, lines: countLines(path.join(domainDir, n, 'SKILL.md')), hasLearnings: fs.existsSync(path.join(domainDir, n, 'learnings.md')), loc: 'domain' }))
  const agents = getDirs(agentDir).filter((n) => !n.startsWith('_') && !n.startsWith('.')).map((n) => ({ name: n, lines: countLines(path.join(agentDir, n, 'SKILL.md')), hasLearnings: fs.existsSync(path.join(agentDir, n, 'learnings.md')), loc: 'agent' }))
  const commands = getFiles(commandDir, '.md').map((f) => f.replace('.md', ''))
  // Categorize
  const domainGrouped: Record<string, any[]> = {}
  for (const [cat, names] of Object.entries(SKILL_CATEGORIES)) {
    domainGrouped[cat] = all.filter((s) => names.includes(s.name))
  }
  domainGrouped['Uncategorized'] = all.filter((s) => !Object.values(SKILL_CATEGORIES).flat().includes(s.name))
  const agentGrouped: Record<string, any[]> = {}
  for (const [cat, names] of Object.entries(AGENT_CATEGORIES)) {
    agentGrouped[cat] = agents.filter((s) => names.includes(s.name))
  }
  agentGrouped['Uncategorized'] = agents.filter((s) => !Object.values(AGENT_CATEGORIES).flat().includes(s.name))
  return { domainGrouped, agentGrouped, commands, totalDomain: all.length, totalAgent: agents.length }
}

function getLearnings() {
  const learnings: any[] = []
  for (const dir of [path.join(SKILLBRAIN_ROOT, '.agents', 'skills'), path.join(SKILLBRAIN_ROOT, '.opencode', 'skill')]) {
    for (const name of getDirs(dir)) {
      const lPath = path.join(dir, name, 'learnings.md')
      if (!fs.existsSync(lPath)) continue
      const content = fs.readFileSync(lPath, 'utf-8')
      const matches = content.match(/^## Learning .+$/gm)
      if (!matches || matches.length === 0) continue
      const entries = matches.map((m) => {
        const id = m.replace('## Learning ', '')
        const conf = content.match(new RegExp(`${id}[\\s\\S]*?confidence:\\s*(\\d+)`))
        const type = content.match(new RegExp(`${id}[\\s\\S]*?type:\\s*"?([^"\\n]+)`))
        const problem = content.match(new RegExp(`${id}[\\s\\S]*?problem:\\s*"?([^"\\n]+)`))
        return { id, confidence: conf ? +conf[1] : 0, type: type?.[1]?.trim() || 'unknown', problem: problem?.[1]?.trim().slice(0, 80) || '' }
      })
      learnings.push({ skill: name, count: matches.length, entries })
    }
  }
  return learnings
}

function getAutomation() {
  const hooksDir = path.join(process.env.HOME || '', '.config', 'skillbrain', 'hooks')
  const scripts = getFiles(hooksDir, '.sh').map((s) => {
    const desc: Record<string, string> = {
      'secrets-scan.sh': 'Pre-commit secret detection (15+ patterns)',
      'env-check.sh': 'Validate env vars vs dependencies',
      'new-project.sh': 'Bootstrap .env.local + secrets',
      'pre-deploy.sh': 'Full deploy checklist (8 checks)',
      'dep-audit.sh': 'Dependency vulnerabilities + weight',
      'commit-msg-check.sh': 'Conventional commits format',
      'post-commit': 'Auto re-index CodeGraph',
    }
    return { name: s, description: desc[s] || '' }
  })
  return { scripts, botRunning: fs.existsSync('/tmp/skillbrain-bot.pid'), botCommands: ['status','projects','env','audit','deploy','secrets','learnings','skills','ip','uptime','help'] }
}

function getMemoryGraph() {
  try {
    const db = openDb(SKILLBRAIN_ROOT)
    const store = new MemoryStore(db)
    const stats = store.stats()
    const topMemories = store.query({ status: 'active', limit: 20 })
    const contradictions = store.getContradictions()
    closeDb(db)
    return {
      ...stats,
      topMemories: topMemories.map((m) => ({
        id: m.id, type: m.type, confidence: m.confidence,
        context: m.context.slice(0, 100), tags: m.tags, skill: m.skill,
      })),
      contradictions,
    }
  } catch {
    return { total: 0, byType: {}, byStatus: {}, edges: 0, topMemories: [], contradictions: [] }
  }
}

function getComponentCatalog() {
  try {
    const db = openDb(SKILLBRAIN_ROOT)
    const store = new ComponentsStore(db)
    const stats = store.componentStats()
    const components = store.listComponents({ limit: 200 })
    closeDb(db)
    return { total: stats.total, byProject: stats.byProject, bySectionType: stats.bySectionType, components }
  } catch {
    return { total: 0, byProject: {}, bySectionType: {}, components: [] }
  }
}

function getDesignSystemsCatalog() {
  try {
    const db = openDb(SKILLBRAIN_ROOT)
    const store = new ComponentsStore(db)
    const designSystems = store.listDesignSystems()
    closeDb(db)
    return { total: designSystems.length, designSystems }
  } catch {
    return { total: 0, designSystems: [] }
  }
}

function getSkillsUsage() {
  try {
    const db = openDb(SKILLBRAIN_ROOT)
    const store = new SkillsStore(db)
    const topRouted = store.topRouted(24, 10)
    const topLoaded = store.topLoaded(24, 10)
    const topApplied = store.topApplied(24, 10)
    const deadSkills = store.deadSkills(30, 10)
    const totalLast24h = store.totalUsageSince(24)
    const confidenceStats = store.confidenceStats()
    const topCooccurrences = store.topCooccurrences(20)
    closeDb(db)
    return { topRouted, topLoaded, topApplied, deadSkills, totalLast24h, confidenceStats, topCooccurrences }
  } catch {
    return { topRouted: [], topLoaded: [], topApplied: [], deadSkills: [], totalLast24h: 0, confidenceStats: { growing: [], declining: [], usefulRate: [] }, topCooccurrences: [] }
  }
}

function getDirs(d: string) { try { return fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) } catch { return [] } }
function getFiles(d: string, ext: string) { try { return fs.readdirSync(d).filter((f) => f.endsWith(ext)) } catch { return [] } }
function countLines(f: string) { try { return fs.readFileSync(f, 'utf-8').split('\n').length } catch { return 0 } }

const HTML = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SkillBrain — Neural Map</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#08080d;color:#d0d0d0;padding:20px 24px}
h1{font-size:32px;background:linear-gradient(135deg,#6366f1,#8b5cf6,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:2px}
.sub{color:#555;font-size:13px;margin-bottom:20px}
.refresh{position:fixed;top:12px;right:16px;font-size:11px;color:#333}
.pulse{animation:pulse 2s infinite}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}

/* Totals */
.totals{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px}
.tot{background:#0e0e16;border:1px solid #1a1a2a;border-radius:10px;padding:12px 20px;text-align:center;min-width:100px}
.tot-v{font-size:28px;font-weight:800;background:linear-gradient(135deg,#6366f1,#a855f7);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.tot-l{font-size:10px;color:#555;text-transform:uppercase;letter-spacing:.5px}

/* Section */
.section{margin-bottom:24px}
.section-title{font-size:18px;font-weight:700;color:#a78bfa;margin-bottom:12px;display:flex;align-items:center;gap:8px}
.section-title .icon{font-size:20px}

/* Cards grid */
.g2{display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:12px}
.g3{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}

/* Card */
.card{background:#0e0e16;border:1px solid #1a1a2a;border-radius:10px;padding:16px;transition:border-color .2s}
.card:hover{border-color:#2a2a4a}
.card h3{font-size:14px;color:#8b8bab;text-transform:uppercase;letter-spacing:.8px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center}
.card h3 .cnt{font-size:12px;padding:1px 8px;background:#1a1a2e;border-radius:8px;color:#a78bfa}

/* Stat rows */
.sr{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #111118;font-size:13px}
.sr:last-child{border:none}
.sr-l{color:#777}.sr-v{font-weight:600}

/* Tags */
.tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}
.tag{padding:2px 8px;border-radius:5px;font-size:11px;background:#111120;border:1px solid #1e1e30;color:#999}
.tag.learn{border-color:#059669;color:#34d399}
.tag.fn{color:#60a5fa}.tag.cls{color:#f59e0b}.tag.iface{color:#ec4899}

/* Bars */
.bar{display:flex;align-items:center;gap:6px;padding:3px 0;font-size:12px}
.bar-label{min-width:120px;color:#888}
.bar-track{flex:1;height:6px;background:#111118;border-radius:3px;overflow:hidden}
.bar-fill{height:100%;border-radius:3px}
.bar-val{min-width:30px;text-align:right;color:#666}

/* Collapsible */
details{margin-bottom:4px}
details summary{cursor:pointer;padding:4px 0;font-size:13px;color:#888;list-style:none}
details summary::before{content:'+ ';color:#555}
details[open] summary::before{content:'- '}
details .inner{padding:6px 0 6px 12px}

/* Process */
.proc{padding:6px 0;border-bottom:1px solid #111118}
.proc-name{font-size:13px;color:#ccc}.proc-meta{font-size:11px;color:#555}

/* Status dot */
.dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:6px}
.dot.on{background:#34d399}.dot.off{background:#f87171}

/* Learning entry */
.le{padding:4px 0;border-bottom:1px solid #0d0d14;font-size:12px}
.le-id{color:#a78bfa;font-weight:600}.le-conf{color:#34d399}.le-type{color:#666;font-style:italic}
.le-prob{color:#888;margin-top:2px}

/* Footer */
.footer{text-align:center;color:#333;font-size:11px;margin-top:32px;padding:12px 0;border-top:1px solid #111118}
</style></head><body>
<h1>SkillBrain</h1>
<div class="sub">Neural Map — Live Dashboard <span class="pulse" style="color:#34d399">&#9679;</span></div>
<div class="refresh" id="ref">Loading...</div>
<div class="totals" id="totals"></div>
<div id="app"></div>
<div class="footer">SkillBrain Neural Map — auto-refreshes every 30s — built with CodeGraph</div>

<script>
const EC={CALLS:'#6366f1',IMPORTS:'#34d399',EXTENDS:'#f59e0b',IMPLEMENTS:'#ec4899',HAS_METHOD:'#8b5cf6',MEMBER_OF:'#60a5fa',STEP_IN_PROCESS:'#fb923c'}
const LC={Function:'fn',Class:'cls',Interface:'iface',Method:'fn'}

async function load(){
  try{const r=await fetch('/api/data');const d=await r.json();render(d);document.getElementById('ref').textContent='Updated '+new Date().toLocaleTimeString()}
  catch(e){document.getElementById('ref').textContent='Error: '+e.message}
}

function render(d){
  const tn=d.repos.reduce((s,r)=>s+(r.stats?.nodes||0),0)
  const te=d.repos.reduce((s,r)=>s+(r.stats?.edges||0),0)
  const ts=d.skills.totalDomain+d.skills.totalAgent
  const tl=d.learnings.reduce((s,l)=>s+l.count,0)
  const mg=d.memoryGraph||{}
  const tc=d.components?.total||0
  const tds=d.designSystems?.total||0
  document.getElementById('totals').innerHTML=[
    T(d.repos.length,'Repos'),T(tn,'Symbols'),T(te,'Connections'),T(ts,'Skills'),T(mg.total||0,'Memories'),T(tc,'Components'),T(tds,'Design Systems'),T(d.skills.commands.length,'Commands')
  ].join('')

  let h=''

  // === REPOS ===
  h+='<div class="section"><div class="section-title"><span class="icon">&#128472;</span> Code Intelligence (CodeGraph)</div><div class="g2">'
  for(const r of d.repos){
    h+='<div class="card"><h3>'+r.name+'</h3>'
    h+='<div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:10px">'
    h+=S(r.stats?.nodes||0,'nodes')+S(r.stats?.edges||0,'edges')+S(r.stats?.communities||0,'communities')+S(r.stats?.processes||0,'processes')+S(r.stats?.files||0,'files')
    h+='</div>'

    // File distribution
    if(r.fileDist?.length){h+='<details><summary>File Distribution</summary><div class="inner">';const mx=Math.max(...r.fileDist.map(f=>f.count));r.fileDist.forEach(f=>{h+=bar(f.dir,f.count,mx,'#6366f1')});h+='</div></details>'}

    // Edge types
    if(r.edgeTypes?.length){h+='<details><summary>Edge Types</summary><div class="inner">';const mx=Math.max(...r.edgeTypes.map(e=>e.count));r.edgeTypes.forEach(e=>{h+=bar(e.type,e.count,mx,EC[e.type]||'#666')});h+='</div></details>'}

    // Communities
    if(r.communities?.length){h+='<details><summary>Communities ('+r.communities.length+')</summary><div class="inner">';r.communities.forEach(c=>{h+='<div class="sr"><span class="sr-l">'+c.name+'</span><span class="sr-v">'+(c.members||'?')+' members</span></div>'});h+='</div></details>'}

    // Processes
    if(r.processes?.length){h+='<details><summary>Processes ('+r.processes.length+')</summary><div class="inner">';r.processes.forEach(p=>{h+='<div class="proc"><span class="proc-name">'+p.name+'</span><span class="proc-meta"> — '+p.steps+' steps, entry: '+p.entry+'</span></div>'});h+='</div></details>'}

    // Top symbols
    if(r.topSymbols?.length){h+='<details><summary>Exported Symbols ('+r.topSymbols.length+')</summary><div class="inner"><div class="tags">';r.topSymbols.forEach(s=>{h+='<span class="tag '+LC[s.label]+'">'+s.name+'</span>'});h+='</div></div></details>'}

    h+='</div>'
  }
  h+='</div></div>'

  // === DOMAIN SKILLS ===
  h+='<div class="section"><div class="section-title"><span class="icon">&#128218;</span> Domain Skills ('+d.skills.totalDomain+')</div><div class="g3">'
  for(const [cat,skills] of Object.entries(d.skills.domainGrouped)){
    if(!skills.length)continue
    h+='<div class="card"><h3>'+cat+'<span class="cnt">'+skills.length+'</span></h3><div class="tags">'
    skills.sort((a,b)=>b.lines-a.lines).forEach(s=>{h+='<span class="tag '+(s.hasLearnings?'learn':'')+'" title="'+s.lines+' lines">'+s.name+'</span>'})
    h+='</div></div>'
  }
  h+='</div></div>'

  // === AGENT SKILLS ===
  h+='<div class="section"><div class="section-title"><span class="icon">&#129302;</span> Agent & External Skills ('+d.skills.totalAgent+')</div><div class="g3">'
  for(const [cat,skills] of Object.entries(d.skills.agentGrouped)){
    if(!skills.length)continue
    h+='<div class="card"><h3>'+cat+'<span class="cnt">'+skills.length+'</span></h3><div class="tags">'
    skills.sort((a,b)=>b.lines-a.lines).forEach(s=>{h+='<span class="tag '+(s.hasLearnings?'learn':'')+'" title="'+s.lines+' lines">'+s.name+'</span>'})
    h+='</div></div>'
  }
  h+='</div></div>'

  // === LEARNINGS ===
  h+='<div class="section"><div class="section-title"><span class="icon">&#129504;</span> Learnings ('+tl+')</div><div class="g2">'
  d.learnings.sort((a,b)=>b.count-a.count).forEach(l=>{
    h+='<div class="card"><h3>'+l.skill+'<span class="cnt">'+l.count+'</span></h3>'
    l.entries.forEach(e=>{
      h+='<div class="le"><span class="le-id">'+e.id+'</span> <span class="le-conf">conf:'+e.confidence+'</span> <span class="le-type">'+e.type+'</span>'
      if(e.problem)h+='<div class="le-prob">'+e.problem+'</div>'
      h+='</div>'
    })
    h+='</div>'
  })
  h+='</div></div>'

  // === MEMORY GRAPH ===
  if(mg.total>0){
    h+='<div class="section"><div class="section-title"><span class="icon">&#128161;</span> Memory Graph ('+mg.total+' memories, '+mg.edges+' edges)</div><div class="g2">'
    // Stats by type
    h+='<div class="card"><h3>By Type</h3>'
    const mxT=Math.max(...Object.values(mg.byType||{}).map(Number))
    for(const[t,c]of Object.entries(mg.byType||{})){h+=bar(t,Number(c),mxT,'#a78bfa')}
    h+='</div>'
    // Stats by status
    h+='<div class="card"><h3>By Status</h3>'
    for(const[s,c]of Object.entries(mg.byStatus||{})){const col=s==='active'?'#34d399':s==='pending-review'?'#f59e0b':'#f87171';h+='<div class="sr"><span class="sr-l"><span class="dot" style="background:'+col+'"></span>'+s+'</span><span class="sr-v">'+c+'</span></div>'}
    if(mg.contradictions?.length){h+='<div style="margin-top:8px;padding:8px;background:#1a0a0a;border:1px solid #3a1a1a;border-radius:6px;font-size:12px;color:#f87171">'+mg.contradictions.length+' active contradiction(s)</div>'}
    h+='</div>'
    // Top memories
    h+='<div class="card" style="grid-column:1/-1"><h3>Active Memories<span class="cnt">top '+mg.topMemories?.length+'</span></h3>'
    ;(mg.topMemories||[]).forEach(function(m){
      h+='<div class="le"><span class="le-id">'+m.id+'</span> <span class="le-conf">conf:'+m.confidence+'</span> <span class="le-type">'+m.type+'</span> <span style="color:#555;font-size:11px">'+( m.skill||'')+'</span>'
      h+='<div class="le-prob">'+m.context+'</div>'
      if(m.tags?.length){h+='<div class="tags" style="margin-top:3px">';m.tags.forEach(function(t){h+='<span class="tag">'+t+'</span>'});h+='</div>'}
      h+='</div>'
    })
    h+='</div></div></div>'
  }

  // === COMPONENT CATALOG ===
  const comps=d.components||{total:0,components:[],byProject:{},bySectionType:{}}
  h+='<div class="section"><div class="section-title"><span class="icon">&#129521;</span> Component Catalog ('+comps.total+')</div>'
  if(comps.total===0){
    h+='<div class="card" style="color:#555;font-size:13px">No components yet. Use <code>component_add</code> after building any Hero, Footer, CTA, or Pricing section.</div>'
  } else {
    // Stats row
    h+='<div class="g3" style="margin-bottom:12px">'
    h+='<div class="card"><h3>By Project</h3>'
    for(const[proj,cnt]of Object.entries(comps.byProject)){const mx=Math.max(...Object.values(comps.byProject).map(Number));h+=bar(proj,Number(cnt),mx,'#6366f1')}
    h+='</div>'
    h+='<div class="card"><h3>By Section Type</h3>'
    for(const[type,cnt]of Object.entries(comps.bySectionType)){const mx=Math.max(...Object.values(comps.bySectionType).map(Number));h+=bar(type,Number(cnt),mx,'#8b5cf6')}
    h+='</div>'
    h+='</div>'
    // Component grid grouped by section_type
    const byType={}
    comps.components.forEach(c=>{if(!byType[c.sectionType])byType[c.sectionType]=[];byType[c.sectionType].push(c)})
    h+='<div class="g3">'
    for(const[type,items]of Object.entries(byType)){
      h+='<div class="card"><h3>'+type+'<span class="cnt">'+items.length+'</span></h3>'
      items.forEach(c=>{
        h+='<div class="le"><span class="le-id">'+c.project+'</span> <span style="color:#ccc">'+c.name+'</span>'
        if(c.filePath)h+='<div class="le-prob" style="color:#555;font-size:11px">'+c.filePath+'</div>'
        if(c.tags?.length){h+='<div class="tags" style="margin-top:3px">';c.tags.forEach(t=>{h+='<span class="tag">'+t+'</span>'});h+='</div>'}
        h+='</div>'
      })
      h+='</div>'
    }
    h+='</div>'
  }
  h+='</div>'

  // === DESIGN SYSTEMS ===
  const ds=d.designSystems||{total:0,designSystems:[]}
  h+='<div class="section"><div class="section-title"><span class="icon">&#127912;</span> Design Systems ('+ds.total+')</div>'
  if(ds.total===0){
    h+='<div class="card" style="color:#555;font-size:13px">No design systems yet. Use <code>design_system_set</code> to save client brand tokens.</div>'
  } else {
    h+='<div class="g2">'
    ds.designSystems.forEach(function(s){
      h+='<div class="card"><h3>'+s.project+(s.clientName?' <span style="font-weight:400;color:#555;font-size:12px">('+s.clientName+')</span>':'')+'</h3>'
      // Color swatches
      const cols=Object.entries(s.colors||{})
      if(cols.length){
        h+='<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">'
        cols.forEach(function([k,v]){h+='<div title="'+k+': '+v+'" style="width:28px;height:28px;border-radius:6px;background:'+v+';border:1px solid #222;cursor:help"></div>'})
        h+='</div>'
        h+='<div style="font-size:11px;color:#555;margin-bottom:8px">'+cols.map(function([k,v]){return k+': '+v}).join(' · ')+'</div>'
      }
      // Font info
      const fonts=s.fonts||{}
      if(Object.keys(fonts).length){
        h+='<div class="sr"><span class="sr-l">Fonts</span><span class="sr-v" style="font-size:12px">'+Object.values(fonts).join(', ')+'</span></div>'
      }
      // Badges
      h+='<div class="tags" style="margin-top:8px">'
      h+='<span class="tag">'+s.colorFormat+'</span>'
      if(s.darkMode)h+='<span class="tag learn">dark mode</span>'
      if(s.animations?.length)h+='<span class="tag">'+s.animations.length+' animations</span>'
      h+='<span class="tag" style="color:#555">updated '+s.updatedAt.split("T")[0]+'</span>'
      h+='</div>'
      h+='</div>'
    })
    h+='</div>'
  }
  h+='</div>'

  // === COMMANDS ===
  h+='<div class="section"><div class="section-title"><span class="icon">&#9889;</span> Commands ('+d.skills.commands.length+')</div><div class="card"><div class="tags">'
  d.skills.commands.forEach(c=>{h+='<span class="tag">/'+c+'</span>'})
  h+='</div></div></div>'

  // === SKILLS USAGE 24H ===
  const su=d.skillsUsage||{topRouted:[],topLoaded:[],topApplied:[],deadSkills:[],totalLast24h:0}
  h+='<div class="section"><div class="section-title"><span class="icon">&#128202;</span> Skills Usage 24h <span style="font-size:12px;color:#555;font-weight:400">('+su.totalLast24h+' events)</span></div><div class="g3">'
  // Top routed
  h+='<div class="card"><h3>Top Routed<span class="cnt">'+su.topRouted.length+'</span></h3>'
  if(su.topRouted.length){const mx=Math.max(...su.topRouted.map(r=>r.count));su.topRouted.forEach(r=>{h+=bar(r.skill_name,r.count,mx,'#6366f1')})}
  else{h+='<div style="color:#444;font-size:12px">No data yet</div>'}
  h+='</div>'
  // Top loaded
  h+='<div class="card"><h3>Top Loaded<span class="cnt">'+su.topLoaded.length+'</span></h3>'
  if(su.topLoaded.length){const mx=Math.max(...su.topLoaded.map(r=>r.count));su.topLoaded.forEach(r=>{h+=bar(r.skill_name,r.count,mx,'#8b5cf6')})}
  else{h+='<div style="color:#444;font-size:12px">No data yet</div>'}
  h+='</div>'
  // Dead skills (not used in N days)
  h+='<div class="card"><h3>Unused (30d)<span class="cnt">'+su.deadSkills.length+'</span></h3>'
  if(su.deadSkills.length){h+='<div class="tags">';su.deadSkills.forEach(s=>{h+='<span class="tag" style="color:#f87171">'+s.skill_name+'</span>'});h+='</div>'}
  else{h+='<div style="color:#34d399;font-size:12px">All skills used recently</div>'}
  h+='</div>'
  h+='</div></div>'

  // === SKILL REINFORCEMENT ===
  const cs=su.confidenceStats||{growing:[],declining:[],usefulRate:[]}
  const cooc=su.topCooccurrences||[]
  if(cs.growing.length||cs.declining.length||cs.usefulRate.length||cooc.length){
    h+='<div class="section"><div class="section-title"><span class="icon">&#127941;</span> Skill Reinforcement</div><div class="g3">'
    // Growing
    h+='<div class="card"><h3>Growing (conf ≥7)<span class="cnt">'+cs.growing.length+'</span></h3>'
    if(cs.growing.length){cs.growing.forEach(s=>{h+=bar(s.name,s.confidence,10,'#34d399')})}
    else{h+='<div style="color:#444;font-size:12px">None yet</div>'}
    h+='</div>'
    // Declining / suggested deprecations
    h+='<div class="card"><h3>Declining (conf ≤3)<span class="cnt">'+cs.declining.length+'</span></h3>'
    if(cs.declining.length){cs.declining.forEach(s=>{h+=bar(s.name+' ('+s.sessionsStale+'s)',s.confidence,10,'#f87171')})}
    else{h+='<div style="color:#34d399;font-size:12px">No skills declining</div>'}
    h+='</div>'
    // Useful rate
    h+='<div class="card"><h3>Useful Rate<span class="cnt">'+cs.usefulRate.length+'</span></h3>'
    if(cs.usefulRate.length){const mx=1;cs.usefulRate.forEach(s=>{h+=bar(s.name,Math.round(s.rate*100),100,'#a78bfa')})}
    else{h+='<div style="color:#444;font-size:12px">No feedback yet</div>'}
    h+='</div>'
    // Co-occurrence top pairs
    if(cooc.length){
      h+='<div class="card" style="grid-column:1/-1"><h3>Co-occurrence Top Pairs<span class="cnt">'+cooc.length+'</span></h3><div class="tags">'
      cooc.forEach(c=>{h+='<span class="tag" title="count:'+c.count+'">'+c.skillA+' + '+c.skillB+'<span style="color:#666;margin-left:4px">×'+c.count+'</span></span>'})
      h+='</div></div>'
    }
    h+='</div></div>'
  }

  // === AUTOMATION ===
  h+='<div class="section"><div class="section-title"><span class="icon">&#9881;</span> Automation</div><div class="g2">'
  // Bot
  h+='<div class="card"><h3>Telegram Bot<span class="cnt">'+(d.automation.botRunning?'<span class="dot on"></span>running':'<span class="dot off"></span>stopped')+'</span></h3>'
  h+='<div class="tags">';d.automation.botCommands.forEach(c=>{h+='<span class="tag">/'+c+'</span>'});h+='</div></div>'
  // Scripts
  h+='<div class="card"><h3>Quality Gate Scripts<span class="cnt">'+d.automation.scripts.length+'</span></h3>'
  d.automation.scripts.forEach(s=>{h+='<div class="sr"><span class="sr-l">'+s.name+'</span><span class="sr-v" style="font-size:11px;color:#666;max-width:200px;text-align:right">'+s.description+'</span></div>'})
  h+='</div>'
  h+='</div></div>'

  document.getElementById('app').innerHTML=h
}

function T(v,l){return '<div class="tot"><div class="tot-v">'+v+'</div><div class="tot-l">'+l+'</div></div>'}
function S(v,l){return '<div style="text-align:center"><div style="font-size:20px;font-weight:700">'+v+'</div><div style="font-size:10px;color:#555;text-transform:uppercase">'+l+'</div></div>'}
function bar(label,val,max,color){return '<div class="bar"><span class="bar-label">'+label+'</span><div class="bar-track"><div class="bar-fill" style="width:'+(val/max*100)+'%;background:'+(color||'#666')+'"></div></div><span class="bar-val">'+val+'</span></div>'}

load();setInterval(load,30000)
</script></body></html>`

const server = http.createServer((req, res) => {
  if (req.url === '/api/health') {
    const mg = getMemoryGraph()
    const repos = loadRegistry()
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'ok',
      memories: mg.total,
      memoryEdges: mg.edges,
      repos: repos.length,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    }))
    return
  }
  if (req.url === '/api/skills-usage') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
    res.end(JSON.stringify(getSkillsUsage()))
    return
  }
  if (req.url === '/api/data') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
    res.end(JSON.stringify({ repos: getRepoDetails(), skills: getSkillsGrouped(), learnings: getLearnings(), memoryGraph: getMemoryGraph(), automation: getAutomation(), components: getComponentCatalog(), designSystems: getDesignSystemsCatalog(), skillsUsage: getSkillsUsage(), ts: new Date().toISOString() }))
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(HTML)
  }
})
// Only start standalone when run directly (not when imported by http-server)
const isDirectRun = process.argv[1]?.includes('dashboard/server')
if (isDirectRun) {
  server.listen(PORT, () => console.log(`\n  SkillBrain Dashboard: http://localhost:${PORT}\n`))
}

export { server, HTML, getRepoDetails, getSkillsGrouped, getLearnings, getMemoryGraph, getAutomation }
