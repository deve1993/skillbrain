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
  .command('mcp')
  .description('Start MCP server on stdio')
  .action(async () => {
    try {
      const { startMcpServer } = await import('./mcp/server.js')
      await startMcpServer()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[codegraph] Fatal: ${msg}`)
      process.exit(1)
    }
  })

program.parse()
