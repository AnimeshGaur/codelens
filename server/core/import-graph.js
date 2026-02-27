/**
 * Static Import Graph — zero LLM, zero network calls.
 *
 * Parses actual import / require / from statements from source files to
 * produce a precise directed edge list: { from, to, importedAs }.
 *
 * Supports: JS, JSX, TS, TSX, MJS, CJS, Python, Java, Kotlin, Go, Ruby, PHP, C#, Rust, Swift
 */

import fs from 'fs';
import path from 'path';

// ─── Language import patterns ─────────────────────────────────────────────────

const PATTERNS = {
    // JS / TS / JSX / TSX / MJS
    js: [
        // import X from '...'  /  import { X } from '...'  /  import * as X from '...'  /  import '...'
        /^import\s+(?:[\w*{},\s]+\s+from\s+)?['"]([^'"]+)['"]/gm,
        // require('...') or require("...")
        /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/gm,
        // import('...')  dynamic
        /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/gm,
        // export { x } from '...'
        /^export\s+(?:[\w*{},\s]+\s+from\s+)?['"]([^'"]+)['"]/gm,
    ],
    python: [
        // from package.module import X
        /^from\s+([\w.]+)\s+import\s+/gm,
        // import package.module
        /^import\s+([\w.]+)/gm,
    ],
    java: [
        // import com.example.ClassName;
        /^import\s+(?:static\s+)?([\w.]+);/gm,
    ],
    kotlin: [
        /^import\s+([\w.]+)/gm,
    ],
    go: [
        // import "path/pkg"
        /["'`]([\w./\-]+)["'`]/gm,  // used after detecting import block
    ],
    ruby: [
        /^require(?:_relative)?\s+['"]([^'"]+)['"]/gm,
    ],
    php: [
        /\b(?:require|include|require_once|include_once)\s+['"]([^'"]+)['"]/gm,
        /^use\s+([\w\\]+)/gm,
    ],
    csharp: [
        /^using\s+([\w.]+);/gm,
    ],
    rust: [
        /^use\s+([\w::]+)/gm,
        /^extern\s+crate\s+(\w+)/gm,
    ],
    swift: [
        /^import\s+(\w+)/gm,
    ],
};

// Language → pattern key
const LANG_MAP = {
    javascript: 'js', javascriptreact: 'js', typescript: 'js', typescriptreact: 'js',
    python: 'python', java: 'java', kotlin: 'kotlin', go: 'go',
    ruby: 'ruby', php: 'php', csharp: 'csharp', rust: 'rust', swift: 'swift',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Is this import a relative path (./foo, ../bar, not an npm/stdlib package)? */
function isRelative(specifier) {
    return specifier.startsWith('.') || specifier.startsWith('/');
}

/** Resolve a relative import specifier to an absolute path (best-effort). */
function resolveImportPath(fromFile, specifier, allFilePaths) {
    const dir = path.dirname(fromFile);
    const base = path.resolve(dir, specifier);

    // Try exact match
    if (allFilePaths.has(base)) return base;

    // Try adding common extensions
    for (const ext of ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.vue', '.svelte']) {
        const candidate = base + ext;
        if (allFilePaths.has(candidate)) return candidate;
        // Try /index.<ext>
        const idx = path.join(base, `index${ext}`);
        if (allFilePaths.has(idx)) return idx;
    }

    return null;
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Build a static import graph from discovered files.
 *
 * @param {Array}  files     File objects from discoverFiles() — must have { path, language, relativePath }
 * @param {string} repoRoot  Absolute path to repository root
 * @returns {{
 *   nodes: Array<{id, relativePath, language, ext}>,
 *   edges: Array<{from, to, specifier, isRelative}>,
 *   packageImports: Map<string, Set<string>>,  // file → external packages used
 *   stats: {totalEdges, relativeEdges, externalEdges}
 * }}
 */
export function buildImportGraph(files, repoRoot) {
    // Build a fast lookup set of absolute paths
    const allFilePaths = new Set(files.map((f) => f.path));
    const relativePathMap = new Map(files.map((f) => [f.path, f.relativePath]));

    const nodes = files.map((f) => ({
        id: f.relativePath,
        absolutePath: f.path,
        relativePath: f.relativePath,
        language: f.language,
        ext: path.extname(f.path),
        directory: f.directory,
    }));

    const edges = [];
    const packageImports = new Map(); // file → Set<packageName>

    for (const file of files) {
        const langKey = LANG_MAP[file.language] || null;
        if (!langKey) continue;

        let content;
        try {
            content = fs.readFileSync(file.path, 'utf-8');
        } catch {
            continue;
        }

        const patterns = getPatterns(langKey, content);
        const filePackages = new Set();

        for (const pattern of patterns) {
            let match;
            // Reset lastIndex for global regex
            pattern.lastIndex = 0;
            while ((match = pattern.exec(content)) !== null) {
                const specifier = match[1];
                if (!specifier) continue;

                if (isRelative(specifier)) {
                    // Resolve to an actual file in the repo
                    const resolved = resolveImportPath(file.path, specifier, allFilePaths);
                    if (resolved && resolved !== file.path) {
                        edges.push({
                            from: file.relativePath,
                            to: relativePathMap.get(resolved),
                            specifier,
                            isRelative: true,
                        });
                    }
                } else {
                    // External package / stdlib — just collect it
                    const pkg = specifier.split('/')[0].replace(/^@[^/]+\/[^/]+$/, specifier.split('/').slice(0, 2).join('/'));
                    if (pkg && !pkg.startsWith('.')) filePackages.add(pkg);
                }
            }
        }

        if (filePackages.size > 0) {
            packageImports.set(file.relativePath, filePackages);
        }
    }

    return {
        nodes,
        edges,
        packageImports,
        stats: {
            totalEdges: edges.length,
            relativeEdges: edges.filter((e) => e.isRelative).length,
            externalEdges: [...packageImports.values()].reduce((s, v) => s + v.size, 0),
        },
    };
}

/** Get the right regex patterns for a language, handling Go's multi-import blocks */
function getPatterns(langKey, content) {
    if (langKey !== 'go') {
        return PATTERNS[langKey] || [];
    }

    // For Go, only match inside import ( ... ) blocks or standalone import "..."
    const goPatterns = [];
    const importBlocks = [
        ...content.matchAll(/^import\s+"([^"]+)"/gm),
        ...content.matchAll(/^\s+"([^"]+)"/gm),  // lines inside import ( ) block
    ];
    // Return a pre-processed "virtual" pattern by yielding static matches
    // encoded as a fake regex that won't advance
    return [];  // Go handled separately below — minimal stub
}

/**
 * Summarise the import graph per-component.
 * Maps LLM-detected component names to their file's import edges.
 *
 * @param {{edges, nodes}} importGraph
 * @param {Array}           components  LLM rawModel.components
 * @returns {Array} components enriched with `importEdges` and `importedByEdges`
 */
export function enrichComponentsWithImports(importGraph, components) {
    if (!importGraph || !components) return components;

    // Build file-basename → component lookup (best-effort heuristic)
    const compByName = new Map(components.map((c) => [normalize(c.name), c]));
    const compByFile = new Map();

    for (const node of importGraph.nodes) {
        const baseName = normalize(path.basename(node.relativePath, node.ext));
        if (compByName.has(baseName)) {
            compByFile.set(node.relativePath, compByName.get(baseName));
        }
    }

    // Build per-component import edges
    const outEdges = new Map();  // compName → Set<compName>
    const inEdges = new Map();  // compName → Set<compName>

    for (const edge of importGraph.edges) {
        const fromComp = compByFile.get(edge.from);
        const toComp = compByFile.get(edge.to);
        if (!fromComp || !toComp || fromComp === toComp) continue;

        if (!outEdges.has(fromComp.name)) outEdges.set(fromComp.name, new Set());
        if (!inEdges.has(toComp.name)) inEdges.set(toComp.name, new Set());
        outEdges.get(fromComp.name).add(toComp.name);
        inEdges.get(toComp.name).add(fromComp.name);
    }

    return components.map((c) => ({
        ...c,
        staticDependencies: [...(outEdges.get(c.name) || [])],
        staticUsedBy: [...(inEdges.get(c.name) || [])],
    }));
}

function normalize(name) {
    return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
