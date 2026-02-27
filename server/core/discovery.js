import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import ignore from 'ignore';
import { isSourceFile, detectLanguage } from './lang-detect.js';

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

  // Build ignore rules from .gitignore + config excludes
  const ig = ignore();

  const gitignorePath = path.join(rootDir, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
    ig.add(gitignoreContent);
  }

  // Always add standard ignores
  ig.add(['node_modules/', '.git/', '.codelens-cache/', 'codelens-output/']);
  ig.add(exclude);

  // Find all files
  const allFiles = await glob('**/*', {
    cwd: rootDir,
    nodir: true,
    dot: false,
    absolute: false,
  });

  // Filter and enrich
  const sourceFiles = [];

  for (const relativePath of allFiles) {
    // Check ignore rules
    if (ig.ignores(relativePath)) continue;

    // Check if it's a source file
    if (!isSourceFile(relativePath)) continue;

    // If include list is provided, check against it
    if (include.length > 0) {
      const matches = include.some(pattern => relativePath.includes(pattern));
      if (!matches) continue;
    }

    const absolutePath = path.join(rootDir, relativePath);

    // Check file size
    let size;
    try {
      const stat = fs.statSync(absolutePath);
      size = stat.size;
      if (size > maxFileSize) continue;
      if (size === 0) continue;
    } catch {
      continue;
    }

    const language = detectLanguage(relativePath);
    if (!language) continue;

    sourceFiles.push({
      path: absolutePath,
      relativePath,
      language,
      size,
      directory: path.dirname(relativePath),
    });
  }

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
