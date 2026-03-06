import fs from 'fs';
import path from 'path';
import https from 'https';
import { createRequire } from 'module';
import { logger } from './logger.js';
const require = createRequire(import.meta.url);
const WASM_DIR = '/tmp'; // Use /tmp for lambda/container environments

// Mapping of lang-detect languages to tree-sitter WASM names
const LANG_TO_WASM = {
    'JavaScript': 'javascript',
    'JavaScript (JSX)': 'javascript',
    'TypeScript': 'typescript',
    'TypeScript (TSX)': 'tsx',
    'Python': 'python',
};

// Tree-sitter query strings for structural extraction
const QUERIES = {
    javascript: `
    (import_statement) @import
    (class_declaration) @class
    (function_declaration) @function
    (arrow_function) @function
    (method_definition) @method
    (export_statement) @export
  `,
    typescript: `
    (import_statement) @import
    (class_declaration) @class
    (function_declaration) @function
    (arrow_function) @function
    (method_definition) @method
    (export_statement) @export
    (interface_declaration) @interface
    (type_alias_declaration) @type
  `,
    tsx: `
    (import_statement) @import
    (class_declaration) @class
    (function_declaration) @function
    (arrow_function) @function
    (method_definition) @method
    (export_statement) @export
    (interface_declaration) @interface
    (type_alias_declaration) @type
  `,
    python: `
    (import_statement) @import
    (import_from_statement) @import
    (class_definition) @class
    (function_definition) @function
  `
};

let isInitialized = false;
const loadedLanguages = new Map(); // wasmName -> Language object
let Parser = null;

async function initParserModule() {
    if (Parser) return true;
    try {
        const mod = await import('web-tree-sitter');
        Parser = mod.default;
        return true;
    } catch {
        // web-tree-sitter not installed
        return false;
    }
}

/**
 * Downloads a WASM file from the tree-sitter-wasms CDN if it doesn't already exist.
 */
async function ensureWasmDownloaded(wasmName) {
    if (!wasmName) {
        return path.join(require.resolve('web-tree-sitter'), '../tree-sitter.wasm');
    }

    const fileName = `tree-sitter-${wasmName}.wasm`;
    const wasmPath = path.join(WASM_DIR, fileName);
    if (fs.existsSync(wasmPath) && fs.statSync(wasmPath).size > 10000) {
        return wasmPath;
    }

    logger.info(`Downloading ${fileName} (one-time setup)...`, { component: 'AST' });
    const url = wasmName
        ? `https://unpkg.com/tree-sitter-wasms@0.1.11/out/${fileName}`
        : `https://unpkg.com/web-tree-sitter@0.22.6/${fileName}`;

    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                // Handle redirect
                https.get(res.headers.location, (redirectRes) => {
                    const file = fs.createWriteStream(wasmPath);
                    redirectRes.pipe(file);
                    file.on('finish', () => { file.close(); resolve(wasmPath); });
                    file.on('error', reject);
                }).on('error', reject);
            } else {
                const file = fs.createWriteStream(wasmPath);
                res.pipe(file);
                file.on('finish', () => { file.close(); resolve(wasmPath); });
                file.on('error', reject);
            }
        }).on('error', reject);
    });
}

/**
 * Load the appropriate Language object for the file
 */
async function loadLanguage(languageName) {
    const wasmName = LANG_TO_WASM[languageName];
    if (!wasmName) return null; // Unsupported language for AST reduction

    if (loadedLanguages.has(wasmName)) {
        return loadedLanguages.get(wasmName);
    }

    try {
        const wasmPath = await ensureWasmDownloaded(wasmName);
        const Lang = await Parser.Language.load(wasmPath);
        loadedLanguages.set(wasmName, Lang);
        return Lang;
    } catch (err) {
        logger.error(`Failed to load WASM parser`, { component: 'AST', language: languageName, error: err.message });
        return null;
    }
}

/**
 * The core pre-processor function. Takes a full source file and returns a structural skeleton.
 * E.g. strips out function bodies, leaving only signatures and imports.
 * 
 * @param {string} sourceCode 
 * @param {string} detectedLanguage 
 * @returns {Promise<string>} Reduced source code, or original if unsupported/failed.
 */
export async function minifyAST(sourceCode, detectedLanguage) {
    // If we don't have a parser map for it, return full code
    const wasmName = LANG_TO_WASM[detectedLanguage];
    if (!wasmName || !QUERIES[wasmName]) {
        return sourceCode;
    }

    // If web-tree-sitter is not installed/loading fails, gracefully return full code
    if (!(await initParserModule())) {
        return sourceCode;
    }

    try {
        if (!isInitialized) {
            // Must download the core tree-sitter.wasm engine as well
            const enginePath = await ensureWasmDownloaded(''); // core engine
            await Parser.init({ locateFile: () => enginePath });
            isInitialized = true;
        }

        const Lang = await loadLanguage(detectedLanguage);
        if (!Lang) return sourceCode;

        const parser = new Parser();
        parser.setLanguage(Lang);

        const tree = parser.parse(sourceCode);
        const query = Lang.query(QUERIES[wasmName]);
        const captures = query.captures(tree.rootNode);

        if (captures.length === 0) return sourceCode;

        // Collect all block boundaries we want to truncate
        const rangesToTruncate = [];

        for (const capture of captures) {
            const { node, name } = capture;

            // Only truncate blocks for functions/methods/classes
            if (['function', 'method', 'class'].includes(name)) {
                // Find the structural body (BlockStatement in JS/TS, Block in Python, etc.)
                const bodyNode = node.children.find(c =>
                    c.type === 'statement_block' ||
                    c.type === 'block' ||
                    c.type === 'class_body'
                );

                if (bodyNode) {
                    rangesToTruncate.push({
                        start: bodyNode.startIndex + 1, // just after { or :
                        end: bodyNode.endIndex - (bodyNode.text.endsWith('}') ? 1 : 0), // just before }
                    });
                }
            }
        }

        // Sort ranges and construct minified string
        rangesToTruncate.sort((a, b) => a.start - b.start);

        let minified = '';
        let lastIdx = 0;

        for (const range of rangesToTruncate) {
            if (range.start > lastIdx) {
                minified += sourceCode.slice(lastIdx, range.start);
                minified += '\n    /* ... implementation ... */\n';
                lastIdx = range.end;
            }
        }
        minified += sourceCode.slice(lastIdx);

        return minified;
    } catch (err) {
        logger.warn('Structural minification failed, falling back to full text', { component: 'AST', error: err.message });
        return sourceCode;
    }
}
