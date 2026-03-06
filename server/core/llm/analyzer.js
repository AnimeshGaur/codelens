import fs from 'fs';
import { buildAnalysisPrompt, buildOverviewPrompt } from './prompts.js';
import { minifyAST } from '../ast-parser.js';
import { logger } from '../logger.js';

/**
 * LLM-powered code analyzer.
 * Sends file batches to the LLM and collects structured JSON results.
 */
export class Analyzer {
  /**
   * @param {object} provider  LLM provider from createProvider()
   * @param {object} cache     AnalysisCache instance
   */
  constructor(provider, cache) {
    this.provider = provider;
    this.cache = cache;
    this.maxRetries = 3;
    this.retryDelayMs = 2000;
  }

  /**
   * Analyze a batch of files via the LLM.
   * @param {Array<{path: string, relativePath: string, language: string}>} files
   * @returns {Promise<object>} Parsed JSON analysis result
   */
  async analyzeBatch(files) {
    // Read and minify file contents
    const filesWithContent = await Promise.all(files.map(async f => {
      const rawContent = await fs.promises.readFile(f.path, 'utf-8');
      const minifiedContent = await minifyAST(rawContent, f.language);
      return {
        relativePath: f.relativePath,
        language: f.language,
        content: minifiedContent,
      };
    }));

    const { userPrompt, systemPrompt } = buildAnalysisPrompt(filesWithContent);

    const rawResponse = await this._sendWithRetry(userPrompt, systemPrompt);
    return this._parseJSON(rawResponse);
  }

  /**
   * Get a high-level project overview from file structure alone.
   * @param {Array<string>} filePaths  List of all relative file paths
   * @returns {Promise<object>}
   */
  async getOverview(filePaths) {
    const { userPrompt, systemPrompt } = buildOverviewPrompt(filePaths);
    const rawResponse = await this._sendWithRetry(userPrompt, systemPrompt);
    return this._parseJSON(rawResponse);
  }

  /**
   * Analyze all files with batching, caching, and progress reporting.
   * @param {Array<Array>} batches  Array of file batches from createBatches()
   * @param {Array} allFiles        All discovered files (for caching)
   * @param {Function} onProgress   Optional callback for SSE updates
   * @returns {Promise<Array<object>>} Array of analysis results per batch
   */
  async analyzeAll(batches, allFiles, onProgress = null) {
    // Check cache for individual files
    const { uncached, cachedResults } = await this.cache.filterUncached(allFiles);

    // Re-batch only uncached files
    const uncachedSet = new Set(uncached.map(f => f.path));
    const filteredBatches = batches
      .map(batch => batch.filter(f => uncachedSet.has(f.path)))
      .filter(batch => batch.length > 0);

    const totalBatches = filteredBatches.length;
    const cachedCount = allFiles.length - uncached.length;

    if (cachedCount > 0) {
      logger.info(`Loaded files from cache`, { count: cachedCount });
    }

    if (totalBatches === 0) {
      logger.info('All files cached, no LLM calls needed');
      return [...cachedResults.values()];
    }

    logger.info(`Starting LLM analysis`, { uncached: uncached.length, batches: totalBatches });

    const results = [...cachedResults.values()];

    for (let i = 0; i < filteredBatches.length; i++) {
      const batch = filteredBatches[i];
      const fileNames = batch.map(f => f.relativePath).join(', ');
      logger.info(`Analyzing batch`, { batch: i + 1, total: totalBatches, files: fileNames });

      try {
        const result = await this.analyzeBatch(batch);
        results.push(result);

        // Cache results per file in batch
        for (const file of batch) {
          await this.cache.set(file.path, result);
        }

        logger.info(`Batch complete`, { batch: i + 1 });
        if (onProgress) onProgress(i + 1, totalBatches, null);

        // Rate limit: small delay between batches
        if (i < filteredBatches.length - 1) {
          await this._delay(1000);
        }
      } catch (err) {
        logger.error(`Batch failed`, { batch: i + 1, error: err.message });
        if (onProgress) onProgress(i + 1, totalBatches, err.message);
        // Continue with remaining batches
      }
    }

    return results;
  }

  /**
   * Send prompt with exponential backoff retries.
   */
  async _sendWithRetry(prompt, systemPrompt) {
    let lastError;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.provider.send(prompt, systemPrompt);
      } catch (err) {
        lastError = err;
        const isRateLimit = err.status === 429 || err.message?.includes('rate');
        const delay = isRateLimit
          ? this.retryDelayMs * Math.pow(2, attempt)
          : this.retryDelayMs * attempt;

        if (attempt < this.maxRetries) {
          logger.warn(`LLM API Retry scheduled`, { attempt, maxRetries: this.maxRetries, delayMs: delay, error: err.message });
          await this._delay(delay);
        }
      }
    }

    throw new Error(`LLM request failed after ${this.maxRetries} retries: ${lastError.message}`);
  }

  /**
   * Parse JSON from LLM response, stripping markdown fences if present.
   */
  _parseJSON(raw) {
    let cleaned = raw.trim();

    // Strip markdown code fences (```json ... ```)
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    try {
      return JSON.parse(cleaned);
    } catch (err) {
      // Try to extract JSON from the response
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch {
          // fall through
        }
      }
      throw new Error(
        `Failed to parse LLM JSON response: ${err.message}\nRaw response (first 500 chars): ${raw.substring(0, 500)}`,
      );
    }
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
