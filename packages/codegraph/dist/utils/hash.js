import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
export function fileHash(filePath) {
    const content = fs.readFileSync(filePath);
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
}
export function contentHash(content) {
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
}
export function randomId() {
    return randomUUID().replace(/-/g, '').slice(0, 12);
}
export function nodeId(filePath, name, label) {
    return createHash('sha256').update(`${filePath}:${label}:${name}`).digest('hex').slice(0, 16);
}
export function edgeId(sourceId, targetId, type) {
    return createHash('sha256').update(`${sourceId}-${type}->${targetId}`).digest('hex').slice(0, 16);
}
//# sourceMappingURL=hash.js.map