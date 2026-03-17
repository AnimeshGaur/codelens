import * as vscode from 'vscode';
import * as path from 'path';
import { isSourceFile, detectLanguage } from './langDetect';

const DEFAULT_IGNORES = new Set([
    'node_modules', '.git', '.codelens-cache', 'codelens-output',
    'dist', 'build', 'out', '__pycache__', '.next', 'coverage',
    'vendor', 'target', '.gradle',
]);

export interface DiscoveredFile {
    uri: vscode.Uri;
    relativePath: string;
    language: string;
    size: number;
    directory: string;
}

/**
 * Discover all source files in the given folder using vscode.workspace.fs.
 */
export async function discoverFiles(
    rootUri: vscode.Uri,
    options: { maxFileSize?: number } = {}
): Promise<DiscoveredFile[]> {
    const { maxFileSize = 50000 } = options;
    const results: DiscoveredFile[] = [];

    // Parse .gitignore if available
    const additionalIgnores = new Set<string>();
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
    } catch {
        // no .gitignore — fine
    }

    const ignoreList = new Set([...DEFAULT_IGNORES, ...additionalIgnores]);

    async function walk(dirUri: vscode.Uri, relDir: string): Promise<void> {
        let entries: [string, vscode.FileType][];
        try {
            entries = await vscode.workspace.fs.readDirectory(dirUri);
        } catch {
            return;
        }

        for (const [name, type] of entries) {
            if (name.startsWith('.') && name !== '.env') { continue; }
            if (ignoreList.has(name)) { continue; }

            const childUri = vscode.Uri.joinPath(dirUri, name);
            const relPath = relDir ? `${relDir}/${name}` : name;

            if (type === vscode.FileType.Directory) {
                await walk(childUri, relPath);
            } else if (type === vscode.FileType.File) {
                if (!isSourceFile(name)) { continue; }

                const language = detectLanguage(name);
                if (!language) { continue; }

                try {
                    const stat = await vscode.workspace.fs.stat(childUri);
                    if (stat.size === 0 || stat.size > maxFileSize) { continue; }

                    results.push({
                        uri: childUri,
                        relativePath: relPath,
                        language,
                        size: stat.size,
                        directory: relDir || '.',
                    });
                } catch {
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
export function createBatches(files: DiscoveredFile[], maxBatchSize = 120000): DiscoveredFile[][] {
    const dirGroups = new Map<string, DiscoveredFile[]>();
    for (const f of files) {
        const dir = f.directory || '.';
        if (!dirGroups.has(dir)) { dirGroups.set(dir, []); }
        dirGroups.get(dir)!.push(f);
    }

    const batches: DiscoveredFile[][] = [];
    for (const groupFiles of dirGroups.values()) {
        let current: DiscoveredFile[] = [];
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
