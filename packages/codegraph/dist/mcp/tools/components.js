import { z } from 'zod';
import { openDb, closeDb } from '../../storage/db.js';
import { ComponentsStore } from '../../storage/components-store.js';
import { getRegistryEntry, loadRegistry } from '../../storage/registry.js';
import { detectDesignFiles, parseTailwindConfig, parseCSSVariables, parseTokensJson, mergeTokenSources, } from '../../storage/design-token-parser.js';
const MEMORY_REPO_NAME = process.env.SKILLBRAIN_MEMORY_REPO || 'skillbrain';
const SKILLBRAIN_ROOT = process.env.SKILLBRAIN_ROOT || '';
function resolveRepo() {
    const entry = getRegistryEntry(MEMORY_REPO_NAME);
    if (entry)
        return entry.path;
    const entries = loadRegistry();
    if (entries.length === 1)
        return entries[0].path;
    if (SKILLBRAIN_ROOT)
        return SKILLBRAIN_ROOT;
    return null;
}
function withStore(fn) {
    const repoPath = resolveRepo();
    if (!repoPath)
        throw new Error('Repository not found. Run codegraph_list_repos.');
    const db = openDb(repoPath);
    const store = new ComponentsStore(db);
    try {
        return fn(store);
    }
    finally {
        closeDb(db);
    }
}
const SECTION_TYPES = [
    'hero', 'navbar', 'footer', 'cta', 'pricing', 'features',
    'testimonials', 'faq', 'comparison', 'process', 'gallery',
    'demo', 'form', 'card', 'other',
];
export function registerComponentTools(server, _ctx) {
    // ── component_add ──────────────────────────────────
    server.tool('component_add', 'Add a UI component/section to the cross-project catalog. Call this after building any Hero, Footer, CTA, Pricing, or other reusable section.', {
        project: z.string().describe('Project name (e.g. "singleflo", "terrae-mare")'),
        name: z.string().describe('Component name (e.g. "HeroSection", "PricingCards")'),
        section_type: z.enum(SECTION_TYPES).describe('UI section category'),
        description: z.string().optional().describe('What this component does and when to reuse it'),
        file_path: z.string().optional().describe('Relative file path (e.g. "src/components/sections/Hero.tsx")'),
        tags: z.array(z.string()).optional().describe('Tags like ["dark-mode", "animated", "i18n", "shadcn"]'),
        props_schema: z.record(z.string(), z.unknown()).optional().describe('Props as JSON object (e.g. {title: "string", subtitle?: "string"})'),
        code_snippet: z.string().optional().describe('First ~50 lines of the component for quick preview'),
        design_tokens: z.record(z.string(), z.unknown()).optional().describe('Design tokens used (e.g. {primary: "#71B8AF", font: "Yeseva"})'),
    }, async ({ project, name, section_type, description, file_path, tags, props_schema, code_snippet, design_tokens }) => {
        try {
            const component = withStore((store) => store.addComponent({
                project, name,
                sectionType: section_type,
                description, filePath: file_path,
                tags, propsSchema: props_schema,
                codeSnippet: code_snippet,
                designTokens: design_tokens,
            }));
            return {
                content: [{
                        type: 'text',
                        text: `✅ Component added: ${component.id}\n  ${component.sectionType.toUpperCase()} › ${component.project}/${component.name}\n  File: ${component.filePath ?? 'n/a'}\n  Tags: ${component.tags.join(', ') || 'none'}`,
                    }],
            };
        }
        catch (err) {
            return { content: [{ type: 'text', text: `❌ Error: ${err.message}` }] };
        }
    });
    // ── component_list ────────────────────────────────
    server.tool('component_list', 'List UI components from the catalog, optionally filtered by project, section type, or tag.', {
        project: z.string().optional().describe('Filter by project name'),
        section_type: z.enum(SECTION_TYPES).optional().describe('Filter by section type'),
        tag: z.string().optional().describe('Filter by tag (e.g. "animated", "i18n")'),
        limit: z.number().optional().default(50),
    }, async ({ project, section_type, tag, limit }) => {
        try {
            const components = withStore((store) => store.listComponents({
                project, sectionType: section_type, tag, limit,
            }));
            if (components.length === 0) {
                return { content: [{ type: 'text', text: 'No components found. Use component_add to start cataloging.' }] };
            }
            const lines = components.map((c) => `[${c.id}] ${c.sectionType.padEnd(14)} ${c.project.padEnd(20)} ${c.name}${c.filePath ? ` → ${c.filePath}` : ''}${c.tags.length ? ` [${c.tags.join(', ')}]` : ''}`);
            return {
                content: [{
                        type: 'text',
                        text: `📦 ${components.length} component(s):\n\n${lines.join('\n')}`,
                    }],
            };
        }
        catch (err) {
            return { content: [{ type: 'text', text: `❌ Error: ${err.message}` }] };
        }
    });
    // ── component_search ──────────────────────────────
    server.tool('component_search', 'Search UI components by name, description, or tags using full-text search. Use BEFORE building any new UI section to find reusable components.', {
        query: z.string().describe('Search query (e.g. "hero dark animated", "pricing saas", "footer multilingual")'),
        limit: z.number().optional().default(10),
    }, async ({ query, limit }) => {
        try {
            const results = withStore((store) => store.searchComponents(query, limit));
            if (results.length === 0) {
                return { content: [{ type: 'text', text: `No components found for "${query}". Build one and use component_add to catalog it.` }] };
            }
            const lines = results.map(({ component: c }) => `[${c.id}] ${c.sectionType.padEnd(14)} ${c.project.padEnd(20)} ${c.name}\n` +
                `  ${c.description ? c.description.slice(0, 100) : 'No description'}\n` +
                `  ${c.filePath ? `File: ${c.filePath}` : ''} ${c.tags.length ? `Tags: ${c.tags.join(', ')}` : ''}`);
            return {
                content: [{
                        type: 'text',
                        text: `🔍 Found ${results.length} component(s) for "${query}":\n\n${lines.join('\n\n')}`,
                    }],
            };
        }
        catch (err) {
            return { content: [{ type: 'text', text: `❌ Error: ${err.message}` }] };
        }
    });
    // ── component_get ─────────────────────────────────
    server.tool('component_get', 'Get full details of a specific UI component including code snippet and design tokens.', {
        id: z.string().describe('Component ID (e.g. "UC-abc123def456")'),
    }, async ({ id }) => {
        try {
            const component = withStore((store) => store.getComponent(id));
            if (!component) {
                return { content: [{ type: 'text', text: `Component ${id} not found.` }] };
            }
            const parts = [
                `📦 ${component.name} (${component.sectionType})`,
                `Project: ${component.project}`,
                component.filePath ? `File: ${component.filePath}` : '',
                component.description ? `Description: ${component.description}` : '',
                component.tags.length ? `Tags: ${component.tags.join(', ')}` : '',
                Object.keys(component.propsSchema).length ? `Props: ${JSON.stringify(component.propsSchema, null, 2)}` : '',
                Object.keys(component.designTokens).length ? `Design Tokens: ${JSON.stringify(component.designTokens, null, 2)}` : '',
                component.codeSnippet ? `\nCode Preview:\n\`\`\`tsx\n${component.codeSnippet}\n\`\`\`` : '',
            ].filter(Boolean);
            return { content: [{ type: 'text', text: parts.join('\n') }] };
        }
        catch (err) {
            return { content: [{ type: 'text', text: `❌ Error: ${err.message}` }] };
        }
    });
    // ── design_system_set ─────────────────────────────
    server.tool('design_system_set', 'Create or update the design system (colors, fonts, spacing, radius, animations) for a client project. Call this when starting a new project or after finalizing brand tokens.', {
        project: z.string().describe('Project name (e.g. "singleflo")'),
        client_name: z.string().optional().describe('Client display name (e.g. "Singleflo s.r.l.")'),
        colors: z.record(z.string(), z.string()).optional().describe('Color tokens (e.g. {primary: "#71B8AF", secondary: "#08262A"})'),
        fonts: z.record(z.string(), z.unknown()).optional().describe('Font tokens (e.g. {display: "Yeseva One", body: "Poppins"})'),
        spacing: z.record(z.string(), z.unknown()).optional().describe('Spacing scale (e.g. {base: "4px", container_max: "1200px"})'),
        radius: z.record(z.string(), z.string()).optional().describe('Border radius tokens (e.g. {sm: "4px", md: "8px", lg: "12px"})'),
        animations: z.array(z.unknown()).optional().describe('Animation definitions [{name, usage}]'),
        dark_mode: z.boolean().optional().describe('Whether the project supports dark mode'),
        color_format: z.enum(['hex', 'oklch', 'hsl']).optional().describe('Color format used in the project'),
        tailwind_config: z.string().optional().describe('Relevant excerpt from tailwind.config.ts'),
        notes: z.string().optional().describe('Brand notes or constraints'),
    }, async ({ project, client_name, colors, fonts, spacing, radius, animations, dark_mode, color_format, tailwind_config, notes }) => {
        try {
            const ds = withStore((store) => store.upsertDesignSystem({
                project, clientName: client_name,
                colors, fonts, spacing, radius, animations,
                darkMode: dark_mode, colorFormat: color_format,
                tailwindConfig: tailwind_config, notes,
            }));
            const colorCount = Object.keys(ds.colors).length;
            const fontCount = Object.keys(ds.fonts).length;
            return {
                content: [{
                        type: 'text',
                        text: `✅ Design system saved for "${ds.project}" (${ds.id})\n  Colors: ${colorCount} tokens | Fonts: ${fontCount} | Dark mode: ${ds.darkMode ? 'yes' : 'no'} | Format: ${ds.colorFormat}`,
                    }],
            };
        }
        catch (err) {
            return { content: [{ type: 'text', text: `❌ Error: ${err.message}` }] };
        }
    });
    // ── design_system_get ─────────────────────────────
    server.tool('design_system_get', 'Get the design system (colors, fonts, spacing) for a client project. Call this BEFORE starting UI work on an existing project.', {
        project: z.string().describe('Project name (e.g. "singleflo", "terrae-mare")'),
    }, async ({ project }) => {
        try {
            const ds = withStore((store) => store.getDesignSystem(project));
            if (!ds) {
                return {
                    content: [{
                            type: 'text',
                            text: `No design system found for "${project}". Use design_system_set to define one.`,
                        }],
                };
            }
            const parts = [
                `🎨 Design System: ${ds.project}${ds.clientName ? ` (${ds.clientName})` : ''}`,
                `Format: ${ds.colorFormat} | Dark mode: ${ds.darkMode ? 'yes' : 'no'}`,
                Object.keys(ds.colors).length ? `\nColors:\n${Object.entries(ds.colors).map(([k, v]) => `  ${k}: ${v}`).join('\n')}` : '',
                Object.keys(ds.fonts).length ? `\nFonts:\n${JSON.stringify(ds.fonts, null, 2).replace(/^/gm, '  ')}` : '',
                Object.keys(ds.spacing).length ? `\nSpacing:\n${JSON.stringify(ds.spacing, null, 2).replace(/^/gm, '  ')}` : '',
                Object.keys(ds.radius).length ? `\nRadius:\n${Object.entries(ds.radius).map(([k, v]) => `  ${k}: ${v}`).join('\n')}` : '',
                ds.animations.length ? `\nAnimations: ${ds.animations.map((a) => a.name || a).join(', ')}` : '',
                ds.notes ? `\nNotes: ${ds.notes}` : '',
                `\nLast updated: ${ds.updatedAt.split('T')[0]}`,
            ].filter(Boolean);
            return { content: [{ type: 'text', text: parts.join('\n') }] };
        }
        catch (err) {
            return { content: [{ type: 'text', text: `❌ Error: ${err.message}` }] };
        }
    });
    // ── design_system_scan ──────────────────────────────
    server.tool('design_system_scan', 'Scan project files for design tokens (Tailwind config, CSS variables, tokens.json) and auto-populate the design system. If no conflicts are found, saves immediately. If conflicts exist, saves as pending for dashboard review at memory.fl1.it/#/design-systems.', {
        project: z.string().describe('Project name (e.g., "quickfy", "terrae-mare")'),
        workspacePath: z.string().describe('Absolute path to the project root directory'),
        autoSave: z.boolean().optional().default(true).describe('Auto-save if no conflicts (default: true)'),
    }, async ({ project, workspacePath, autoSave = true }) => {
        try {
            const files = detectDesignFiles(workspacePath);
            const fileList = Object.entries(files).filter(([, v]) => v).map(([k]) => k);
            if (fileList.length === 0) {
                return { content: [{ type: 'text', text: `No design files found in ${workspacePath}. Expected: tailwind.config.ts, globals.css, or tokens.json.` }] };
            }
            const sources = [];
            if (files.tailwind)
                sources.push({ source: 'tailwind', path: files.tailwind, tokens: parseTailwindConfig(files.tailwind) });
            if (files.css)
                sources.push({ source: 'css', path: files.css, tokens: parseCSSVariables(files.css) });
            if (files.tokensJson)
                sources.push({ source: 'tokens_json', path: files.tokensJson, tokens: parseTokensJson(files.tokensJson) });
            const { merged, conflicts } = mergeTokenSources(sources);
            const colorCount = Object.keys(merged.colors ?? {}).length;
            const fontCount = Object.keys(merged.fonts ?? {}).length;
            if (conflicts.length === 0 && autoSave) {
                withStore(store => store.upsertDesignSystem({ project, ...merged }));
                return { content: [{ type: 'text', text: `✅ Design system auto-populated for "${project}" from ${sources.length} source(s) (${fileList.join(', ')}).\n  Colors: ${colorCount} | Fonts: ${fontCount} | Dark mode: ${merged.darkMode ? 'yes' : 'no'}` }] };
            }
            const scan = withStore(store => store.addDesignSystemScan({ project, sources, merged, conflicts }));
            return { content: [{ type: 'text', text: `⚠️ Design system scan for "${project}" saved as pending (${conflicts.length} conflict${conflicts.length !== 1 ? 's' : ''}).\n  Colors: ${colorCount} | Fonts: ${fontCount}\n  Review and apply at memory.fl1.it/#/design-systems\n  Scan ID: ${scan.id}` }] };
        }
        catch (err) {
            return { content: [{ type: 'text', text: `❌ Scan error: ${err.message}` }] };
        }
    });
}
//# sourceMappingURL=components.js.map