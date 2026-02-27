import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const CACHE_DIR_NAME = '.codelens-cache';

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
    this.cacheDir = path.join(projectRoot, CACHE_DIR_NAME);
    this.manifest = {};
    this.manifestPath = path.join(this.cacheDir, 'manifest.json');

    if (this.enabled) {
      this._ensureCacheDir();
      this._loadManifest();
    }
  }

  /**
   * Compute SHA-256 hash of a file's contents.
   * @param {string} filePath
   * @returns {string}
   */
  hashFile(filePath) {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Check if a file has a valid cached result.
   * @param {string} filePath  Absolute path to source file
   * @returns {object|null}    Cached analysis result or null
   */
  get(filePath) {
    if (!this.enabled) return null;

    const currentHash = this.hashFile(filePath);
    const entry = this.manifest[filePath];

    if (entry && entry.hash === currentHash) {
      // Load cached result from disk
      const resultPath = path.join(this.cacheDir, entry.resultFile);
      if (fs.existsSync(resultPath)) {
        try {
          return JSON.parse(fs.readFileSync(resultPath, 'utf-8'));
        } catch {
          return null;
        }
      }
    }

    return null;
  }

  /**
   * Store an analysis result for a file.
   * @param {string} filePath  Absolute path to source file
   * @param {object} result    Analysis result object
   */
  set(filePath, result) {
    if (!this.enabled) return;

    const hash = this.hashFile(filePath);
    const resultFile = crypto.createHash('md5').update(filePath).digest('hex') + '.json';
    const resultPath = path.join(this.cacheDir, resultFile);

    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));

    this.manifest[filePath] = { hash, resultFile, timestamp: Date.now() };
    this._saveManifest();
  }

  /**
   * Filter out files that already have valid cached results.
   * Returns { uncached, cachedResults }.
   *
   * @param {Array} files  Array of file objects from discovery
   * @returns {{ uncached: Array, cachedResults: Map }}
   */
  filterUncached(files) {
    const uncached = [];
    const cachedResults = new Map();

    for (const file of files) {
      const cached = this.get(file.path);
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
  clear() {
    if (fs.existsSync(this.cacheDir)) {
      fs.rmSync(this.cacheDir, { recursive: true, force: true });
    }
    this._ensureCacheDir();
    this.manifest = {};
    this._saveManifest();
  }

  _ensureCacheDir() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  _loadManifest() {
    if (fs.existsSync(this.manifestPath)) {
      try {
        this.manifest = JSON.parse(fs.readFileSync(this.manifestPath, 'utf-8'));
      } catch {
        this.manifest = {};
      }
    }
  }

  _saveManifest() {
    fs.writeFileSync(this.manifestPath, JSON.stringify(this.manifest, null, 2));
  }
}
