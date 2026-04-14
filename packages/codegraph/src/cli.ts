#!/usr/bin/env node

import { Command } from 'commander'
import { analyzeCommand } from './cli/commands/analyze.js'
import { statusCommand } from './cli/commands/status.js'
import { cleanCommand } from './cli/commands/clean.js'
import { listCommand } from './cli/commands/list.js'
import { setQuiet } from './utils/logger.js'

const program = new Command()

program
  .name('codegraph')
  .description('Code intelligence knowledge graph — analyze, query, and understand your codebase')
  .version('0.1.0')

program
  .command('analyze')
  .description('Index a repository and build the knowledge graph')
  .argument('[path]', 'Path to repository', '.')
  .option('--force', 'Force full re-index')
  .option('--skip-git', 'Index non-git folders')
  .option('--no-progress', 'Suppress progress output')
  .action(async (targetPath: string, options: any) => {
    try {
      if (options.noProgress) setQuiet(true)
      await analyzeCommand(targetPath, options)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[codegraph] Fatal: ${msg}`)
      process.exit(1)
    }
  })

program
  .command('status')
  .description('Show index status for a repository')
  .argument('[path]', 'Path to repository', '.')
  .action((targetPath: string) => {
    statusCommand(targetPath)
  })

program
  .command('clean')
  .description('Remove index for a repository')
  .argument('[path]', 'Path to repository', '.')
  .action((targetPath: string) => {
    cleanCommand(targetPath)
  })

program
  .command('list')
  .description('List all indexed repositories')
  .action(() => {
    listCommand()
  })

program
  .command('migrate-learnings')
  .description('Migrate learnings.md files into the Memory Graph database')
  .argument('[path]', 'Path to workspace root', '.')
  .action(async (targetPath: string) => {
    try {
      const { migrate } = await import('./storage/migrate-learnings.js')
      const result = migrate(targetPath)
      console.log(`✅ Migration complete:`)
      console.log(`   Migrated: ${result.migrated}`)
      console.log(`   Skipped: ${result.skipped}`)
      console.log(`   Edges created: ${result.edges}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[codegraph] Migration failed: ${msg}`)
      process.exit(1)
    }
  })

program
  .command('mcp')
  .description('Start MCP server (stdio by default, or HTTP with --http)')
  .option('--http', 'Start HTTP server instead of stdio')
  .option('--port <port>', 'HTTP port (default: 3737)', '3737')
  .option('--auth-token <token>', 'Bearer token for HTTP auth (or CODEGRAPH_AUTH_TOKEN env)')
  .action(async (options: { http?: boolean; port?: string; authToken?: string }) => {
    try {
      if (options.http) {
        const { startHttpServer } = await import('./mcp/http-server.js')
        const port = parseInt(options.port || process.env.PORT || '3737', 10)
        const authToken = options.authToken || process.env.CODEGRAPH_AUTH_TOKEN
        await startHttpServer(port, authToken)
      } else {
        const { startMcpServer } = await import('./mcp/server.js')
        await startMcpServer()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[codegraph] Fatal: ${msg}`)
      process.exit(1)
    }
  })

program.parse()
