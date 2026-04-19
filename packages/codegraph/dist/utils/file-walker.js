import fs from 'node:fs';
import path from 'node:path';
import ignore from 'ignore';
const DEFAULT_IGNORE = [
    'node_modules',
    '.git',
    '.next',
    '.codegraph',
    '.gitnexus',
    'dist',
    'build',
    'out',
    '.turbo',
    'coverage',
    '.DS_Store',
    '*.min.js',
    '*.map',
    '*.d.ts',
    'pnpm-lock.yaml',
    'package-lock.json',
    'yarn.lock',
];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
export function walkFiles(rootDir) {
    const ig = ignore();
    ig.add(DEFAULT_IGNORE);
    const gitignorePath = path.join(rootDir, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
        const content = fs.readFileSync(gitignorePath, 'utf-8');
        ig.add(content);
    }
    const files = [];
    walk(rootDir, rootDir, ig, files);
    return files;
}
function walk(dir, rootDir, ig, files) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    }
    catch {
        return;
    }
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(rootDir, fullPath);
        if (ig.ignores(relativePath))
            continue;
        if (entry.isDirectory()) {
            if (ig.ignores(relativePath + '/'))
                continue;
            walk(fullPath, rootDir, ig, files);
        }
        else if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name))) {
            files.push({ path: fullPath, relativePath });
        }
    }
}
//# sourceMappingURL=file-walker.js.map