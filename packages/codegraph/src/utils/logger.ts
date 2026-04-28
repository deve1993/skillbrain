/*
 * SkillBrain — Self-hosted AI memory platform
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
}

let quiet = false

export function setQuiet(value: boolean): void {
  quiet = value
}

export function info(msg: string): void {
  if (!quiet) console.log(`${COLORS.cyan}[codegraph]${COLORS.reset} ${msg}`)
}

export function success(msg: string): void {
  if (!quiet) console.log(`${COLORS.green}[codegraph]${COLORS.reset} ${msg}`)
}

export function warn(msg: string): void {
  if (!quiet) console.log(`${COLORS.yellow}[codegraph]${COLORS.reset} ${msg}`)
}

export function error(msg: string): void {
  console.error(`${COLORS.red}[codegraph]${COLORS.reset} ${msg}`)
}

export function dim(msg: string): void {
  if (!quiet) console.log(`${COLORS.dim}${msg}${COLORS.reset}`)
}
