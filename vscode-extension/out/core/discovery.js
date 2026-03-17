"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.discoverFiles = discoverFiles;
exports.createBatches = createBatches;
const vscode = __importStar(require("vscode"));
const langDetect_1 = require("./langDetect");
const DEFAULT_IGNORES = new Set([
    'node_modules', '.git', '.codelens-cache', 'codelens-output',
    'dist', 'build', 'out', '__pycache__', '.next', 'coverage',
    'vendor', 'target', '.gradle',
]);
/**
 * Discover all source files in the given folder using vscode.workspace.fs.
 */
async function discoverFiles(rootUri, options = {}) {
    const { maxFileSize = 50000 } = options;
    const results = [];
    // Parse .gitignore if available
    const additionalIgnores = new Set();
    try {
        const gitignoreUri = vscode.Uri.joinPath(rootUri, '.gitignore');
        const raw = await vscode.workspace.fs.readFile(gitignoreUri);
        const text = new TextDecoder().decode(raw);
        for (const line of text.split('\n')) {
            const trimmed = line.trim().replace(/\/$/, '').replace(/^\//, '');
            if (trimmed && !trimmed.startsWith('#')) {
                additionalIgnores.add(trimmed);
            }
        }
    }
    catch {
        // no .gitignore — fine
    }
    const ignoreList = new Set([...DEFAULT_IGNORES, ...additionalIgnores]);
    async function walk(dirUri, relDir) {
        let entries;
        try {
            entries = await vscode.workspace.fs.readDirectory(dirUri);
        }
        catch {
            return;
        }
        for (const [name, type] of entries) {
            if (name.startsWith('.') && name !== '.env') {
                continue;
            }
            if (ignoreList.has(name)) {
                continue;
            }
            const childUri = vscode.Uri.joinPath(dirUri, name);
            const relPath = relDir ? `${relDir}/${name}` : name;
            if (type === vscode.FileType.Directory) {
                await walk(childUri, relPath);
            }
            else if (type === vscode.FileType.File) {
                if (!(0, langDetect_1.isSourceFile)(name)) {
                    continue;
                }
                const language = (0, langDetect_1.detectLanguage)(name);
                if (!language) {
                    continue;
                }
                try {
                    const stat = await vscode.workspace.fs.stat(childUri);
                    if (stat.size === 0 || stat.size > maxFileSize) {
                        continue;
                    }
                    results.push({
                        uri: childUri,
                        relativePath: relPath,
                        language,
                        size: stat.size,
                        directory: relDir || '.',
                    });
                }
                catch {
                    continue;
                }
            }
        }
    }
    await walk(rootUri, '');
    return results;
}
/**
 * Group files by directory and create token-budget batches.
 */
function createBatches(files, maxBatchSize = 120000) {
    const dirGroups = new Map();
    for (const f of files) {
        const dir = f.directory || '.';
        if (!dirGroups.has(dir)) {
            dirGroups.set(dir, []);
        }
        dirGroups.get(dir).push(f);
    }
    const batches = [];
    for (const groupFiles of dirGroups.values()) {
        let current = [];
        let currentSize = 0;
        for (const f of groupFiles) {
            if (currentSize + f.size > maxBatchSize && current.length > 0) {
                batches.push(current);
                current = [];
                currentSize = 0;
            }
            current.push(f);
            currentSize += f.size;
        }
        if (current.length > 0) {
            batches.push(current);
        }
    }
    return batches;
}
//# sourceMappingURL=discovery.js.map