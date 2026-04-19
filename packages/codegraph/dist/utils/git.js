import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
export function isGitRepo(dir) {
    return fs.existsSync(path.join(dir, '.git'));
}
export function getHeadCommit(dir) {
    if (!isGitRepo(dir))
        return null;
    try {
        return execSync('git rev-parse HEAD', { cwd: dir, encoding: 'utf-8' }).trim();
    }
    catch {
        return null;
    }
}
export function getRepoName(dir) {
    if (isGitRepo(dir)) {
        try {
            const remote = execSync('git remote get-url origin', { cwd: dir, encoding: 'utf-8' }).trim();
            const match = remote.match(/\/([^/]+?)(?:\.git)?$/);
            if (match)
                return match[1];
        }
        catch { }
    }
    return path.basename(dir);
}
export function getStagedFiles(dir) {
    if (!isGitRepo(dir))
        return [];
    try {
        const output = execSync('git diff --cached --name-only --diff-filter=ACMR', {
            cwd: dir,
            encoding: 'utf-8',
        }).trim();
        return output ? output.split('\n') : [];
    }
    catch {
        return [];
    }
}
export function getChangedFiles(dir) {
    if (!isGitRepo(dir))
        return [];
    try {
        const output = execSync('git diff --name-only --diff-filter=ACMR HEAD', {
            cwd: dir,
            encoding: 'utf-8',
        }).trim();
        return output ? output.split('\n') : [];
    }
    catch {
        return [];
    }
}
export function getDiffFiles(dir, baseRef) {
    if (!isGitRepo(dir))
        return [];
    try {
        const output = execSync(`git diff --name-only ${baseRef}...HEAD`, {
            cwd: dir,
            encoding: 'utf-8',
        }).trim();
        return output ? output.split('\n') : [];
    }
    catch {
        return [];
    }
}
//# sourceMappingURL=git.js.map