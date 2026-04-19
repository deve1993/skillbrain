import fs from 'node:fs';
import path from 'node:path';
import { getCodegraphDir } from './db.js';
const META_FILENAME = 'meta.json';
export function loadMeta(repoPath) {
    const metaPath = path.join(getCodegraphDir(repoPath), META_FILENAME);
    if (!fs.existsSync(metaPath))
        return null;
    try {
        return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    }
    catch {
        return null;
    }
}
export function saveMeta(repoPath, meta) {
    const dir = getCodegraphDir(repoPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(path.join(dir, META_FILENAME), JSON.stringify(meta, null, 2));
}
//# sourceMappingURL=meta.js.map