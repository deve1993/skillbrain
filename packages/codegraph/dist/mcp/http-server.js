/**
 * MCP HTTP Server — Dual mode entry point
 *
 * Serves both:
 * - MCP protocol via Streamable HTTP (POST/GET/DELETE /mcp)
 * - Dashboard web UI and API (GET /, /api/health, /api/data)
 *
 * Usage: node cli.js mcp --http [--port 3737] [--auth-token secret]
 */
import express from 'express';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createMcpServer } from './server.js';
import { loadRegistry } from '../storage/registry.js';
import { openDb, closeDb } from '../storage/db.js';
import { MemoryStore } from '../storage/memory-store.js';
import { SkillsStore } from '../storage/skills-store.js';
import { ProjectsStore } from '../storage/projects-store.js';
import { ComponentsStore } from '../storage/components-store.js';
import { assertEncryptionUsable, decrypt } from '../storage/crypto.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLBRAIN_ROOT = process.env.SKILLBRAIN_ROOT || '/Users/dan/Desktop/progetti-web/MASTER_Fullstack session';
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || '';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
function loadRegistrySafe() {
    try {
        return loadRegistry();
    }
    catch {
        return [];
    }
}
// ── Dashboard data functions (imported from dashboard logic) ──
function getMemoryGraphStats() {
    try {
        const db = openDb(SKILLBRAIN_ROOT);
        const store = new MemoryStore(db);
        const stats = store.stats();
        const topMemories = store.query({ status: 'active', limit: 20 });
        const contradictions = store.getContradictions();
        const recentSessions = store.recentSessions(5);
        closeDb(db);
        return {
            ...stats,
            topMemories: topMemories.map((m) => ({
                id: m.id, type: m.type, confidence: m.confidence,
                context: m.context.slice(0, 120), tags: m.tags, skill: m.skill,
            })),
            contradictions,
            recentSessions: recentSessions.map((s) => ({
                id: s.id, session: s.sessionName, started: s.startedAt,
                summary: s.summary, memories: s.memoriesCreated,
            })),
        };
    }
    catch {
        return { total: 0, byType: {}, byStatus: {}, edges: 0, topMemories: [], contradictions: [], recentSessions: [] };
    }
}
// ── HTTP Server ──
export async function startHttpServer(port, authToken) {
    const app = express();
    app.use(express.json());
    // Session map for MCP transports
    const transports = new Map();
    // ── Auth middleware for /mcp routes (Bearer token) ──
    if (authToken) {
        app.use('/mcp', (req, res, next) => {
            const token = req.headers.authorization?.replace('Bearer ', '');
            if (token !== authToken) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            next();
        });
    }
    // ── Dashboard auth (password-based) ──
    function createSessionToken() {
        const payload = `skillbrain:${Date.now()}`;
        return crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
    }
    function isValidSession(token) {
        if (!DASHBOARD_PASSWORD)
            return true; // no password = no auth
        if (!token)
            return false;
        // Token is valid if it's a proper HMAC hex string (64 chars)
        return /^[a-f0-9]{64}$/.test(token);
    }
    // Login endpoint
    app.post('/auth/login', (req, res) => {
        const { password } = req.body || {};
        if (!DASHBOARD_PASSWORD || password === DASHBOARD_PASSWORD) {
            const token = createSessionToken();
            res.json({ ok: true, token });
        }
        else {
            res.status(401).json({ ok: false, error: 'Wrong password' });
        }
    });
    // Auth check for dashboard routes (not /mcp, not /auth)
    if (DASHBOARD_PASSWORD) {
        app.use((req, res, next) => {
            // Skip auth for MCP protocol and login
            if (req.path.startsWith('/mcp') || req.path.startsWith('/auth/')) {
                next();
                return;
            }
            // Check cookie or Authorization header
            const cookieToken = req.headers.cookie?.split(';')
                .map(c => c.trim().split('='))
                .find(([k]) => k === 'sb_session')?.[1];
            const headerToken = req.headers['x-dashboard-token'];
            if (isValidSession(cookieToken) || isValidSession(headerToken)) {
                next();
            }
            else if (req.path.startsWith('/api/')) {
                res.status(401).json({ error: 'Authentication required' });
            }
            else {
                // Serve login page for HTML requests
                res.type('html').send(getLoginPage());
            }
        });
    }
    // ── MCP Protocol: POST /mcp ──
    app.post('/mcp', async (req, res) => {
        const sessionId = req.headers['mcp-session-id'];
        let transport;
        if (sessionId) {
            transport = transports.get(sessionId);
        }
        if (!transport) {
            if (isInitializeRequest(req.body)) {
                transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: () => randomUUID(),
                    onsessioninitialized: (newSessionId) => {
                        transports.set(newSessionId, transport);
                    },
                });
                transport.onclose = () => {
                    const sid = transport.sessionId;
                    if (sid)
                        transports.delete(sid);
                };
                const server = createMcpServer();
                await server.connect(transport);
            }
            else {
                res.status(400).json({ error: 'No valid session. Send an initialize request first.' });
                return;
            }
        }
        await transport.handleRequest(req, res, req.body);
    });
    // ── MCP Protocol: GET /mcp (SSE stream) ──
    app.get('/mcp', async (req, res) => {
        const sessionId = req.headers['mcp-session-id'];
        if (!sessionId) {
            res.status(400).json({ error: 'Missing mcp-session-id header' });
            return;
        }
        const transport = transports.get(sessionId);
        if (!transport) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }
        await transport.handleRequest(req, res);
    });
    // ── MCP Protocol: DELETE /mcp (close session) ──
    app.delete('/mcp', async (req, res) => {
        const sessionId = req.headers['mcp-session-id'];
        if (!sessionId) {
            res.status(400).json({ error: 'Missing mcp-session-id header' });
            return;
        }
        const transport = transports.get(sessionId);
        if (!transport) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }
        await transport.handleRequest(req, res);
        transports.delete(sessionId);
    });
    // ── Dashboard: Health ──
    app.get('/api/health', (_req, res) => {
        const mg = getMemoryGraphStats();
        const repos = loadRegistrySafe();
        res.json({
            status: 'ok',
            memories: mg.total,
            memoryEdges: mg.edges,
            repos: repos.length,
            activeSessions: transports.size,
            uptime: Math.round(process.uptime()),
            timestamp: new Date().toISOString(),
        });
    });
    // ── Dashboard: Data API ──
    app.get('/api/data', (_req, res) => {
        const mg = getMemoryGraphStats();
        const repos = loadRegistrySafe();
        res.json({
            memoryGraph: mg,
            repos: repos.map((r) => ({ name: r.name, path: r.path, stats: r.stats })),
            activeSessions: transports.size,
            timestamp: new Date().toISOString(),
        });
    });
    // ── API: Skills ──
    app.get('/api/skills', (_req, res) => {
        const { type, category, search, limit } = _req.query;
        try {
            const db = openDb(SKILLBRAIN_ROOT);
            const store = new SkillsStore(db);
            let skills;
            if (search) {
                skills = store.search(search, parseInt(limit || '50', 10)).map((r) => ({
                    name: r.skill.name, category: r.skill.category, type: r.skill.type,
                    description: r.skill.description.slice(0, 150), lines: r.skill.lines,
                    tags: r.skill.tags,
                }));
            }
            else {
                skills = store.list(type, category).map((s) => ({
                    name: s.name, category: s.category, type: s.type,
                    description: s.description.slice(0, 150), lines: s.lines,
                    tags: s.tags,
                }));
            }
            const stats = store.stats();
            closeDb(db);
            res.json({ skills, total: stats.total, stats });
        }
        catch {
            res.json({ skills: [], total: 0, stats: {} });
        }
    });
    app.get('/api/skills/:name', (_req, res) => {
        try {
            const db = openDb(SKILLBRAIN_ROOT);
            const store = new SkillsStore(db);
            const skill = store.get(_req.params.name);
            closeDb(db);
            if (!skill) {
                res.status(404).json({ error: 'Skill not found' });
                return;
            }
            res.json(skill);
        }
        catch {
            res.status(500).json({ error: 'Internal error' });
        }
    });
    // ── API: Memories ──
    app.get('/api/memories', (_req, res) => {
        const { type, minConfidence, skill, project, status, search, limit } = _req.query;
        try {
            const db = openDb(SKILLBRAIN_ROOT);
            const store = new MemoryStore(db);
            let memories;
            if (search) {
                memories = store.search(search, parseInt(limit || '50', 10)).map((r) => ({
                    ...r.memory, edges: r.edges,
                }));
            }
            else {
                const typeArr = type ? (Array.isArray(type) ? type : [type]) : undefined;
                memories = store.query({
                    type: typeArr,
                    minConfidence: minConfidence ? parseInt(minConfidence, 10) : undefined,
                    skill, project, status,
                    limit: parseInt(limit || '50', 10),
                }).map((m) => ({ ...m, edges: store.getEdges(m.id) }));
            }
            const stats = store.stats();
            closeDb(db);
            res.json({ memories, total: stats.total, stats });
        }
        catch {
            res.json({ memories: [], total: 0, stats: {} });
        }
    });
    app.get('/api/memories/:id', (_req, res) => {
        try {
            const db = openDb(SKILLBRAIN_ROOT);
            const store = new MemoryStore(db);
            const memory = store.get(_req.params.id);
            if (!memory) {
                closeDb(db);
                res.status(404).json({ error: 'Memory not found' });
                return;
            }
            const edges = store.getEdges(memory.id);
            closeDb(db);
            res.json({ ...memory, edges });
        }
        catch {
            res.status(500).json({ error: 'Internal error' });
        }
    });
    // ── API: Sessions ──
    app.get('/api/sessions', (_req, res) => {
        const limit = parseInt(_req.query.limit || '20', 10);
        try {
            const db = openDb(SKILLBRAIN_ROOT);
            const store = new MemoryStore(db);
            const sessions = store.recentSessions(limit);
            closeDb(db);
            res.json({ sessions });
        }
        catch {
            res.json({ sessions: [] });
        }
    });
    // ── API: Projects ──
    app.get('/api/projects', (_req, res) => {
        try {
            const db = openDb(SKILLBRAIN_ROOT);
            const store = new MemoryStore(db);
            const projects = store.listProjects();
            closeDb(db);
            res.json({ projects });
        }
        catch {
            res.json({ projects: [] });
        }
    });
    app.get('/api/projects/:name', (_req, res) => {
        try {
            const db = openDb(SKILLBRAIN_ROOT);
            const store = new MemoryStore(db);
            const detail = store.projectDetail(_req.params.name);
            closeDb(db);
            res.json(detail);
        }
        catch {
            res.status(500).json({ error: 'Internal error' });
        }
    });
    // ── API: Memory Edit/Delete ──
    app.delete('/api/memories/:id', (_req, res) => {
        try {
            const db = openDb(SKILLBRAIN_ROOT);
            const store = new MemoryStore(db);
            store.delete(_req.params.id);
            closeDb(db);
            res.json({ ok: true });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    app.put('/api/memories/:id', (_req, res) => {
        try {
            const db = openDb(SKILLBRAIN_ROOT);
            const store = new MemoryStore(db);
            store.updateMemory(_req.params.id, _req.body || {});
            closeDb(db);
            res.json({ ok: true });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // ── API: Session Edit/Delete ──
    app.delete('/api/sessions/:id', (_req, res) => {
        try {
            const db = openDb(SKILLBRAIN_ROOT);
            const store = new MemoryStore(db);
            store.deleteSession(_req.params.id);
            closeDb(db);
            res.json({ ok: true });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    app.put('/api/sessions/:id', (_req, res) => {
        try {
            const db = openDb(SKILLBRAIN_ROOT);
            const store = new MemoryStore(db);
            store.updateSession(_req.params.id, _req.body || {});
            closeDb(db);
            res.json({ ok: true });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // Bulk cleanup: delete duplicate in-progress sessions for same project
    app.post('/api/sessions/cleanup-duplicates', (_req, res) => {
        try {
            const db = openDb(SKILLBRAIN_ROOT);
            const store = new MemoryStore(db);
            const pending = store.pendingSessions();
            // Group by project, keep most recent, delete rest
            const byProject = new Map();
            for (const s of pending) {
                if (!s.project)
                    continue;
                if (!byProject.has(s.project))
                    byProject.set(s.project, []);
                byProject.get(s.project).push(s);
            }
            let deleted = 0;
            for (const [, sessions] of byProject) {
                sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
                // Keep first (most recent), delete the rest
                for (let i = 1; i < sessions.length; i++) {
                    store.deleteSession(sessions[i].id);
                    deleted++;
                }
            }
            closeDb(db);
            res.json({ ok: true, deleted });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // ── API: Projects Metadata (full) ──
    app.get('/api/projects-meta', (_req, res) => {
        try {
            const db = openDb(SKILLBRAIN_ROOT);
            const store = new ProjectsStore(db);
            const projects = store.list();
            closeDb(db);
            res.json({ projects });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    app.get('/api/projects-meta/:name', (_req, res) => {
        try {
            const db = openDb(SKILLBRAIN_ROOT);
            const store = new ProjectsStore(db);
            const project = store.get(_req.params.name);
            closeDb(db);
            if (!project) {
                res.status(404).json({ error: 'Not found' });
                return;
            }
            res.json(project);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    app.put('/api/projects-meta/:name', (_req, res) => {
        try {
            const db = openDb(SKILLBRAIN_ROOT);
            const store = new ProjectsStore(db);
            const project = store.upsert({ name: _req.params.name, ...(_req.body || {}) });
            closeDb(db);
            res.json({ ok: true, project });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // Env var management (list names only — values never returned via API for UI safety)
    app.get('/api/projects-meta/:name/env', (_req, res) => {
        try {
            const environment = _req.query.environment || 'production';
            const db = openDb(SKILLBRAIN_ROOT);
            const store = new ProjectsStore(db);
            const vars = store.listEnvNames(_req.params.name, environment);
            closeDb(db);
            res.json({ vars });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // Reveal single value (requires explicit auth from dashboard)
    app.post('/api/projects-meta/:name/env/reveal', (_req, res) => {
        try {
            const { varName, environment = 'production' } = _req.body || {};
            if (!varName) {
                res.status(400).json({ error: 'varName required' });
                return;
            }
            const db = openDb(SKILLBRAIN_ROOT);
            const store = new ProjectsStore(db);
            const value = store.getEnv(_req.params.name, varName, environment);
            closeDb(db);
            if (value === undefined) {
                res.status(404).json({ error: 'Not found' });
                return;
            }
            res.json({ varName, value });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // Export all env vars as .env format
    app.post('/api/projects-meta/:name/env/export', (_req, res) => {
        try {
            const { environment = 'production' } = _req.body || {};
            const db = openDb(SKILLBRAIN_ROOT);
            const store = new ProjectsStore(db);
            const vars = store.getAllEnv(_req.params.name, environment);
            closeDb(db);
            const content = Object.entries(vars).map(([k, v]) => `${k}=${v}`).join('\n');
            res.json({ content, count: Object.keys(vars).length });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // Import .env content (bulk encrypt & save)
    app.post('/api/projects-meta/:name/env/import', (_req, res) => {
        try {
            const { envContent, environment = 'production' } = _req.body || {};
            if (!envContent) {
                res.status(400).json({ error: 'envContent required' });
                return;
            }
            const db = openDb(SKILLBRAIN_ROOT);
            const store = new ProjectsStore(db);
            let saved = 0;
            for (const line of envContent.split('\n')) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#'))
                    continue;
                const eqIdx = trimmed.indexOf('=');
                if (eqIdx === -1)
                    continue;
                const name = trimmed.slice(0, eqIdx).trim();
                let value = trimmed.slice(eqIdx + 1).trim();
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                if (name && value) {
                    try {
                        store.setEnv(_req.params.name, name, value, environment, '.env', !name.startsWith('NEXT_PUBLIC_'));
                        saved++;
                    }
                    catch { }
                }
            }
            closeDb(db);
            res.json({ ok: true, saved });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    app.delete('/api/projects-meta/:name/env/:varName', (_req, res) => {
        try {
            const environment = _req.query.environment || 'production';
            const db = openDb(SKILLBRAIN_ROOT);
            const store = new ProjectsStore(db);
            store.deleteEnv(_req.params.name, _req.params.varName, environment);
            closeDb(db);
            res.json({ ok: true });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // ── API: Work Log ──
    app.get('/api/worklog', (_req, res) => {
        try {
            const db = openDb(SKILLBRAIN_ROOT);
            const store = new MemoryStore(db);
            const projects = store.workLog();
            closeDb(db);
            res.json({ projects });
        }
        catch {
            res.json({ projects: {} });
        }
    });
    // ── API: UI Components ──
    app.get('/api/components', (_req, res) => {
        const { project, type, tag, search, limit } = _req.query;
        try {
            const db = openDb(SKILLBRAIN_ROOT);
            const store = new ComponentsStore(db);
            let components;
            if (search) {
                components = store.searchComponents(search, parseInt(limit || '50', 10)).map((r) => r.component);
            }
            else {
                components = store.listComponents({ project, sectionType: type, tag, limit: parseInt(limit || '100', 10) });
            }
            const stats = store.componentStats();
            closeDb(db);
            res.json({ components, total: stats.total, stats });
        }
        catch {
            res.json({ components: [], total: 0, stats: {} });
        }
    });
    app.get('/api/components/:id', (_req, res) => {
        try {
            const db = openDb(SKILLBRAIN_ROOT);
            const store = new ComponentsStore(db);
            const component = store.getComponent(_req.params.id);
            closeDb(db);
            if (!component) {
                res.status(404).json({ error: 'Component not found' });
                return;
            }
            res.json(component);
        }
        catch {
            res.status(500).json({ error: 'Internal error' });
        }
    });
    app.post('/api/components', (_req, res) => {
        try {
            const db = openDb(SKILLBRAIN_ROOT);
            const store = new ComponentsStore(db);
            const component = store.addComponent(_req.body || {});
            closeDb(db);
            res.json({ ok: true, component });
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    });
    app.delete('/api/components/:id', (_req, res) => {
        try {
            const db = openDb(SKILLBRAIN_ROOT);
            const store = new ComponentsStore(db);
            store.deleteComponent(_req.params.id);
            closeDb(db);
            res.json({ ok: true });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // ── API: Design Systems ──
    app.get('/api/design-systems', (_req, res) => {
        try {
            const db = openDb(SKILLBRAIN_ROOT);
            const store = new ComponentsStore(db);
            const designSystems = store.listDesignSystems();
            closeDb(db);
            res.json({ designSystems, total: designSystems.length });
        }
        catch {
            res.json({ designSystems: [], total: 0 });
        }
    });
    app.get('/api/design-systems/:project', (_req, res) => {
        try {
            const db = openDb(SKILLBRAIN_ROOT);
            const store = new ComponentsStore(db);
            const ds = store.getDesignSystem(_req.params.project);
            closeDb(db);
            if (!ds) {
                res.status(404).json({ error: 'Design system not found' });
                return;
            }
            res.json(ds);
        }
        catch {
            res.status(500).json({ error: 'Internal error' });
        }
    });
    // ── Static files (dashboard SPA) ──
    const publicDir = path.resolve(__dirname, '..', '..', 'public');
    app.use(express.static(publicDir));
    // SPA fallback: serve index.html for unmatched GET routes
    app.use((_req, res, next) => {
        if (_req.method === 'GET' && !_req.path.startsWith('/api/') && !_req.path.startsWith('/mcp')) {
            res.sendFile(path.join(publicDir, 'index.html'), (err) => {
                if (err)
                    res.type('html').send(getFallbackPage(transports.size));
            });
        }
        else {
            next();
        }
    });
    // Fail-fast on missing/broken ENCRYPTION_KEY if the DB has any encrypted rows.
    // Better to refuse to start than to serve requests that'll crash later.
    {
        const db = openDb(SKILLBRAIN_ROOT);
        try {
            const row = db.prepare(`SELECT COUNT(*) as n FROM project_env_vars`).get();
            if (row.n > 0) {
                assertEncryptionUsable();
                // Verify the current key actually matches the existing DB rows
                const sample = db.prepare(`SELECT encrypted_value, iv, auth_tag FROM project_env_vars LIMIT 1`).get();
                if (sample) {
                    try {
                        decrypt({ ciphertext: sample.encrypted_value, iv: sample.iv, authTag: sample.auth_tag });
                    }
                    catch (err) {
                        throw new Error(`ENCRYPTION_KEY does not match existing encrypted rows in project_env_vars. ` +
                            `Rotating the key requires re-encrypting all stored values first. ` +
                            `Original error: ${err.message}`);
                    }
                }
                console.log(`✅ ENCRYPTION_KEY validated (${row.n} encrypted env vars readable)`);
            }
            else if (process.env.ENCRYPTION_KEY) {
                assertEncryptionUsable(); // key set but no rows yet — still validate roundtrip
                console.log('✅ ENCRYPTION_KEY validated (no encrypted rows yet)');
            }
            else {
                console.warn('⚠️ ENCRYPTION_KEY not set — env var storage disabled until configured');
            }
        }
        finally {
            closeDb(db);
        }
    }
    app.listen(port, () => {
        console.log(`
  SkillBrain Hub (HTTP mode)
  ──────────────────────────
  Dashboard:  http://localhost:${port}
  MCP:        http://localhost:${port}/mcp
  API:        http://localhost:${port}/api/health
  Auth:       ${authToken ? 'Bearer token required for /mcp' : 'disabled'}
`);
    });
}
function getLoginPage() {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SkillBrain — Login</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#08080d;color:#d0d0d0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh}
.login{background:#0e0e16;border:1px solid #1a1a2a;border-radius:12px;padding:32px;width:320px;text-align:center}
h1{font-size:22px;background:linear-gradient(135deg,#6366f1,#8b5cf6,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:4px}
.sub{color:#555;font-size:12px;margin-bottom:24px}
input{width:100%;padding:10px 14px;background:#111118;border:1px solid #1a1a2a;border-radius:8px;color:#d0d0d0;font-size:14px;outline:none;margin-bottom:12px}
input:focus{border-color:#6366f1}
button{width:100%;padding:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;border-radius:8px;color:#fff;font-size:14px;font-weight:600;cursor:pointer}
button:hover{opacity:.9}
.err{color:#f87171;font-size:12px;margin-top:8px;display:none}
</style></head><body>
<div class="login">
<h1>SkillBrain</h1>
<div class="sub">Enter password to access the dashboard</div>
<form onsubmit="return doLogin(event)">
<input type="password" id="pw" placeholder="Password" autofocus>
<button type="submit">Login</button>
</form>
<div class="err" id="err">Wrong password</div>
</div>
<script>
async function doLogin(e){
  e.preventDefault();
  const pw=document.getElementById('pw').value;
  const r=await fetch('/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw})});
  const d=await r.json();
  if(d.ok){
    document.cookie='sb_session='+d.token+';path=/;max-age=604800;SameSite=Lax';
    location.reload();
  } else {
    document.getElementById('err').style.display='block';
  }
  return false;
}
</script></body></html>`;
}
function getFallbackPage(activeSessions) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>SkillBrain</title>
<style>body{background:#08080d;color:#d0d0d0;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0}
.c{text-align:center}h1{font-size:24px;color:#a78bfa}p{color:#555;margin-top:8px}</style>
</head><body><div class="c"><h1>SkillBrain Hub</h1><p>Server running. Dashboard files not found.</p>
<p>Active sessions: ${activeSessions}</p></div></body></html>`;
}
//# sourceMappingURL=http-server.js.map