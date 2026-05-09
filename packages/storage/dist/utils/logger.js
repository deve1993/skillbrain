/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */
const COLORS = {
    reset: '\x1b[0m',
    yellow: '\x1b[33m',
};
let quiet = false;
export function setQuiet(value) {
    quiet = value;
}
export function warn(msg) {
    if (!quiet)
        console.log(`${COLORS.yellow}[skillbrain]${COLORS.reset} ${msg}`);
}
//# sourceMappingURL=logger.js.map