import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Determine if the input is a local path, git URL, or GitHub URL.
 * @returns {{ type: 'local' | 'git', path?: string, cloneUrl?: string, name: string }}
 */
export function parseRepoInput(input) {
    const trimmed = input.trim();

    // 1. Local path — check if it exists on disk
    const resolved = path.resolve(trimmed);
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
        return {
            type: 'local',
            path: resolved,
            name: path.basename(resolved),
        };
    }

    // 2. GitHub URL
    const ghMatch = trimmed.replace(/\.git$/, '').match(/github\.com\/([^/]+)\/([^/]+)/);
    if (ghMatch) {
        return {
            type: 'git',
            cloneUrl: `https://github.com/${ghMatch[1]}/${ghMatch[2]}.git`,
            name: `${ghMatch[1]}/${ghMatch[2]}`,
        };
    }

    // 3. Any git URL (gitlab, bitbucket, self-hosted, ssh, etc.)
    if (
        trimmed.startsWith('https://') ||
        trimmed.startsWith('http://') ||
        trimmed.startsWith('git@') ||
        trimmed.startsWith('git://') ||
        trimmed.startsWith('ssh://')
    ) {
        const basename = path.basename(trimmed.replace(/\.git$/, ''));
        return {
            type: 'git',
            cloneUrl: trimmed,
            name: basename || trimmed,
        };
    }

    throw new Error(`Invalid input: "${trimmed}" — provide a GitHub/Git URL or a local folder path`);
}

/**
 * Resolve a repo input to a local path.
 * For git URLs, clones to a temp dir. For local paths, uses directly.
 * @returns {{ repoPath: string, repoName: string, cleanup: () => void }}
 */
export function resolveRepo(input, onProgress) {
    const parsed = parseRepoInput(input);

    if (parsed.type === 'local') {
        onProgress?.(`Using local folder: ${parsed.name}`);
        return {
            repoPath: parsed.path,
            repoName: parsed.name,
            cleanup() { }, // no cleanup for local paths
        };
    }

    // Git clone
    const tmpDir = path.join(os.tmpdir(), `codelens-${Date.now()}-${parsed.name.replace(/\//g, '-')}`);
    onProgress?.(`Cloning ${parsed.name}...`);

    try {
        execSync(`git clone --depth 1 "${parsed.cloneUrl}" "${tmpDir}"`, {
            stdio: 'pipe',
            timeout: 120000,
        });
    } catch (err) {
        throw new Error(`Failed to clone ${parsed.name}: ${err.message}`);
    }

    onProgress?.(`Cloned ${parsed.name} ✓`);

    return {
        repoPath: tmpDir,
        repoName: parsed.name,
        cleanup() {
            try {
                fs.rmSync(tmpDir, { recursive: true, force: true });
            } catch {
                // ignore cleanup errors
            }
        },
    };
}
