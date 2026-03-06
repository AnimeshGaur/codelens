import fs from 'fs';
import path from 'path';
import { promises as fsp } from 'fs';
import { isSourceFile, detectLanguage } from './lang-detect.js';

// Convert simple glob-like ignores to array
const DEFAULT_IGNORES = ['node_modules', '.git', '.codelens-cache', 'codelens-output', 'dist', 'build'];

/**
 * Discover all source files in the given directory.
 * Respects .gitignore and config-level excludes.
 *
 * @param {string} rootDir   Absolute path to the codebase root
 * @param {object} config    Config object (exclude, include, maxFileSize)
 * @returns {Promise<Array<{path: string, relativePath: string, language: string, size: number, directory: string}>>}
 */
export async function discoverFiles(rootDir, config = {}) {
  const { exclude = [], include = [], maxFileSize = 50000 } = config;

  // Build ignore list
  const ignoreList = new Set([...DEFAULT_IGNORES, ...exclude]);
  const gitignorePath = path.join(rootDir, '.gitignore');
  try {
    const gitignoreContent = await fsp.readFile(gitignorePath, 'utf-8');
    for (const line of gitignoreContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        // Very basic .gitignore parsing for directories/files
        ignoreList.add(trimmed.replace(/\/$/, '').replace(/^\//, ''));
      }
    }
  } catch {
    // Ignore, no .gitignore config found
  }

  const sourceFiles = [];

  // Recursive directory walk
  async function walk(dir, relativeDir = '.') {
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.env') continue; // Skip hidden dirs (except .env for safety)
      if (ignoreList.has(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);
      const relativePath = path.join(relativeDir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath, relativePath);
      } else if (entry.isFile()) {
        // Check if it's a source file by extension
        if (!isSourceFile(relativePath)) continue;

        // If include list is provided, check against it
        if (include.length > 0) {
          const matches = include.some(pattern => relativePath.includes(pattern));
          if (!matches) continue;
        }

        // Check file size
        let size;
        try {
          const stat = await fsp.stat(fullPath);
          size = stat.size;
          if (size > maxFileSize || size === 0) continue;
        } catch {
          continue;
        }

        const language = detectLanguage(relativePath);
        if (!language) continue;

        sourceFiles.push({
          path: fullPath,
          relativePath,
          language,
          size,
          directory: relativeDir,
        });
      }
    }
  }

  await walk(rootDir);
  return sourceFiles;
}

/**
 * Group files by their parent directory for contextual batching.
 * @param {Array} files  Array of file objects from discoverFiles
 * @returns {Map<string, Array>}  Map of directory → files
 */
export function groupByDirectory(files) {
  const groups = new Map();
  for (const file of files) {
    const dir = file.directory || '.';
    if (!groups.has(dir)) groups.set(dir, []);
    groups.get(dir).push(file);
  }
  return groups;
}

/**
 * Create batches of files for LLM analysis.
 * Groups by directory, then splits large groups to stay within token budgets.
 *
 * @param {Array} files         All discovered files
 * @param {number} maxBatchSize Max total characters per batch (~tokens × 4)
 * @returns {Array<Array>}      Array of file batches
 */
export function createBatches(files, maxBatchSize = 120000) {
  const dirGroups = groupByDirectory(files);
  const batches = [];

  for (const [, groupFiles] of dirGroups) {
    let currentBatch = [];
    let currentSize = 0;

    for (const file of groupFiles) {
      if (currentSize + file.size > maxBatchSize && currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [];
        currentSize = 0;
      }
      currentBatch.push(file);
      currentSize += file.size;
    }

    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }
  }

  return batches;
}
