/*
 * SkillBrain — Self-hosted AI memory platform
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */
import { randomUUID } from 'node:crypto';
export function randomId() {
    return randomUUID().replace(/-/g, '').slice(0, 12);
}
//# sourceMappingURL=hash.js.map