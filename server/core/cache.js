import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const CACHE_DIR_NAME = '.codelens-cache';

async function exists(fpath) {
  try {
    await fs.promises.access(fpath);
    return true;
  } catch {
    return false;
  }
}

/**
 * File-level cache using SHA-256 hashes.
 * Stores LLM analysis results so unchanged files are not re-analyzed.
 */
export class AnalysisCache {
  /**
   * @param {string} projectRoot Root directory of the project being analyzed
   * @param {boolean} enabled    Whether caching is enabled
   */
  constructor(projectRoot, enabled = true) {
    this.enabled = enabled;

    // Create a unique cache folder in /tmp based on the project path
    const projectHash = crypto.createHash('md5').update(projectRoot).digest('hex');
    this.cacheDir = path.join('/tmp', CACHE_DIR_NAME, projectHash);

    this.manifest = {};
    this.manifestPath = path.join(this.cacheDir, 'manifest.json');
  }

  async init() {
    if (this.enabled) {
      await this._ensureCacheDir();
      await this._loadManifest();
    }
  }

  /**
   * Compute SHA-256 hash of a file's contents.
   * @param {string} filePath
   * @returns {Promise<string>}
   */
  async hashFile(filePath) {
    const content = await fs.promises.readFile(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Check if a file has a valid cached result.
   * @param {string} filePath  Absolute path to source file
   * @returns {Promise<object|null>}    Cached analysis result or null
   */
  async get(filePath) {
    if (!this.enabled) return null;

    try {
      const currentHash = await this.hashFile(filePath);
      const entry = this.manifest[filePath];

      if (entry && entry.hash === currentHash) {
        // Load cached result from disk
        const resultPath = path.join(this.cacheDir, entry.resultFile);
        if (await exists(resultPath)) {
          const data = await fs.promises.readFile(resultPath, 'utf-8');
          return JSON.parse(data);
        }
      }
    } catch {
      return null;
    }

    return null;
  }

  /**
   * Store an analysis result for a file.
   * @param {string} filePath  Absolute path to source file
   * @param {object} result    Analysis result object
   */
  async set(filePath, result) {
    if (!this.enabled) return;

    try {
      const hash = await this.hashFile(filePath);
      const resultFile = crypto.createHash('md5').update(filePath).digest('hex') + '.json';
      const resultPath = path.join(this.cacheDir, resultFile);

      await fs.promises.writeFile(resultPath, JSON.stringify(result, null, 2));

      this.manifest[filePath] = { hash, resultFile, timestamp: Date.now() };
      await this._saveManifest();
    } catch {
      // ignore write errors
    }
  }

  /**
   * Filter out files that already have valid cached results.
   * Returns { uncached, cachedResults }.
   *
   * @param {Array} files  Array of file objects from discovery
   * @returns {Promise<{ uncached: Array, cachedResults: Map }>}
   */
  async filterUncached(files) {
    const uncached = [];
    const cachedResults = new Map();

    for (const file of files) {
      const cached = await this.get(file.path);
      if (cached) {
        cachedResults.set(file.path, cached);
      } else {
        uncached.push(file);
      }
    }

    return { uncached, cachedResults };
  }

  /**
   * Clear the entire cache.
   */
  async clear() {
    if (await exists(this.cacheDir)) {
      await fs.promises.rm(this.cacheDir, { recursive: true, force: true });
    }
    await this._ensureCacheDir();
    this.manifest = {};
    await this._saveManifest();
  }

  async _ensureCacheDir() {
    if (!(await exists(this.cacheDir))) {
      await fs.promises.mkdir(this.cacheDir, { recursive: true });
    }
  }

  async _loadManifest() {
    if (await exists(this.manifestPath)) {
      try {
        const data = await fs.promises.readFile(this.manifestPath, 'utf-8');
        this.manifest = JSON.parse(data);
      } catch {
        this.manifest = {};
      }
    }
  }

  async _saveManifest() {
    try {
      await fs.promises.writeFile(this.manifestPath, JSON.stringify(this.manifest, null, 2));
    } catch {
      // ignore write errors
    }
  }
}
