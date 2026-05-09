/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const REGISTRY_DIR = path.join(os.homedir(), '.codegraph');
const REGISTRY_FILE = path.join(REGISTRY_DIR, 'registry.json');
function ensureDir() {
    if (!fs.existsSync(REGISTRY_DIR)) {
        fs.mkdirSync(REGISTRY_DIR, { recursive: true });
    }
}
export function loadRegistry() {
    ensureDir();
    if (!fs.existsSync(REGISTRY_FILE))
        return [];
    try {
        return JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'));
    }
    catch {
        return [];
    }
}
export function saveRegistry(entries) {
    ensureDir();
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(entries, null, 2));
}
export function upsertRegistry(entry) {
    const entries = loadRegistry();
    const idx = entries.findIndex((e) => e.path === entry.path);
    if (idx >= 0) {
        entries[idx] = entry;
    }
    else {
        entries.push(entry);
    }
    saveRegistry(entries);
}
export function removeFromRegistry(repoPath) {
    const entries = loadRegistry().filter((e) => e.path !== repoPath);
    saveRegistry(entries);
}
export function getRegistryEntry(nameOrPath) {
    const entries = loadRegistry();
    return entries.find((e) => e.name === nameOrPath || e.path === nameOrPath);
}
//# sourceMappingURL=registry.js.map