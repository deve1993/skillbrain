// ── Section type detection ─────────────────────────────
const SECTION_MAP = [
    [/hero/i, 'hero'],
    [/nav(bar)?|header/i, 'navbar'],
    [/footer/i, 'footer'],
    [/cta|call.to.action/i, 'cta'],
    [/pric(e|ing)/i, 'pricing'],
    [/feature/i, 'features'],
    [/testimon/i, 'testimonials'],
    [/faq|accordion/i, 'faq'],
    [/compar/i, 'comparison'],
    [/process|step|timeline/i, 'process'],
    [/gallery|grid|masonry/i, 'gallery'],
    [/demo|preview/i, 'demo'],
    [/form|contact|input/i, 'form'],
    [/card/i, 'card'],
];
function detectSectionType(name, filePath) {
    const target = `${name} ${filePath}`;
    for (const [pattern, type] of SECTION_MAP) {
        if (pattern.test(target))
            return type;
    }
    return 'other';
}
// ── Category from path ─────────────────────────────────
export function categoryFromPath(filePath) {
    const parts = filePath.replace(/\\/g, '/').split('/');
    // Find 'components' segment, take the next folder as category
    let idx = -1;
    for (let i = parts.length - 1; i >= 0; i--) {
        if (parts[i] === 'components') {
            idx = i;
            break;
        }
    }
    if (idx !== -1 && idx + 2 < parts.length)
        return parts[idx + 1];
    // Fallback: second-to-last folder
    if (parts.length >= 2)
        return parts[parts.length - 2];
    return 'misc';
}
// ── Props extraction ────────────────────────────────────
function extractProps(content, componentName) {
    const props = {};
    // Look for interface/type Props or ComponentNameProps
    const propsPatterns = [
        new RegExp(`interface\\s+(?:${componentName})?Props[^{]*\\{([^}]+)\\}`, 's'),
        new RegExp(`type\\s+(?:${componentName})?Props\\s*=\\s*\\{([^}]+)\\}`, 's'),
        /interface\s+Props[^{]*\{([^}]+)\}/s,
        /type\s+Props\s*=\s*\{([^}]+)\}/s,
    ];
    for (const pattern of propsPatterns) {
        const match = content.match(pattern);
        if (match) {
            const block = match[1];
            const propRegex = /(\w+)\??\s*:\s*([^\n;]+)/g;
            let m;
            while ((m = propRegex.exec(block)) !== null) {
                props[m[1].trim()] = m[2].trim().replace(/,$/, '');
            }
            break;
        }
    }
    return props;
}
// ── JSDoc description ──────────────────────────────────
function extractDescription(content, componentName) {
    // Look for JSDoc comment just before the component export
    const pattern = new RegExp(`/\\*\\*([^*]|\\*(?!/))*\\*/\\s*(?:export\\s+)?(?:default\\s+)?(?:function\\s+${componentName}|const\\s+${componentName})`, 's');
    const match = content.match(pattern);
    if (!match)
        return undefined;
    return match[0]
        .replace(/\/\*\*|\*\/|\*/g, '')
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200) || undefined;
}
// ── Main parser ────────────────────────────────────────
export function parseComponentFile(filePath, content) {
    const results = [];
    // Find all exported components: function, const arrow, default
    const exportPatterns = [
        /export\s+default\s+function\s+([A-Z][a-zA-Z0-9]*)/g,
        /export\s+function\s+([A-Z][a-zA-Z0-9]*)/g,
        /export\s+const\s+([A-Z][a-zA-Z0-9]*)\s*(?::\s*\w+)?\s*=/g,
        /export\s+default\s+([A-Z][a-zA-Z0-9]*)/g,
    ];
    const found = new Set();
    for (const pattern of exportPatterns) {
        let m;
        while ((m = pattern.exec(content)) !== null) {
            found.add(m[1]);
        }
    }
    for (const name of found) {
        // Only include components that look like React components (PascalCase)
        if (!/^[A-Z]/.test(name))
            continue;
        // Skip HOCs/configs (usually short or all caps)
        if (name.length < 3 || name === name.toUpperCase())
            continue;
        const sectionType = detectSectionType(name, filePath);
        const category = categoryFromPath(filePath);
        const props = extractProps(content, name);
        const description = extractDescription(content, name);
        const codeSnippet = content.slice(0, 800);
        results.push({ name, sectionType, category, description, filePath, props, codeSnippet });
    }
    return results;
}
//# sourceMappingURL=component-parser.js.map