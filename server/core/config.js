import fs from 'fs';
import path from 'path';

const DEFAULT_CONFIG = {
  provider: 'gemini',
  model: null, // auto-selected per provider
  exclude: [
    'node_modules/',
    'vendor/',
    'dist/',
    'build/',
    '__pycache__/',
    '.git/',
    '.codelens-cache/',
  ],
  include: [],
  diagrams: ['component', 'class', 'db', 'endpoint', 'external', 'flow', 'architecture'],
  maxFileSize: 50000,
  cache: true,
  output: './codelens-output',
};

const MODEL_DEFAULTS = {
  gemini: 'gemini-2.0-flash',
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-20250514',
  groq: 'llama-3.3-70b-versatile',
};

/**
 * Load configuration from .codelensrc.json → env vars → CLI flags.
 * Later sources override earlier ones.
 *
 * @param {string} targetPath  The codebase path being analyzed
 * @param {object} cliFlags    Flags from commander
 * @returns {object} Merged configuration
 */
export function loadConfig(targetPath, cliFlags = {}) {
  let fileConfig = {};

  // 1. Try loading .codelensrc.json from the target project root
  const rcPath = path.join(targetPath, '.codelensrc.json');
  if (fs.existsSync(rcPath)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(rcPath, 'utf-8'));
    } catch {
      // Silently ignore malformed config
    }
  }

  // 2. Merge: defaults ← file config ← CLI flags (truthy only)
  const merged = { ...DEFAULT_CONFIG, ...fileConfig };

  if (cliFlags.provider) merged.provider = cliFlags.provider;
  if (cliFlags.model) merged.model = cliFlags.model;
  if (cliFlags.output) merged.output = cliFlags.output;
  if (cliFlags.diagrams) merged.diagrams = cliFlags.diagrams.split(',').map(d => d.trim());
  if (cliFlags.noCache) merged.cache = false;

  // 3. Auto-select model if not specified
  if (!merged.model) {
    merged.model = MODEL_DEFAULTS[merged.provider] || MODEL_DEFAULTS.gemini;
  }

  // 4. Resolve output path relative to CWD
  merged.output = path.resolve(merged.output);

  return merged;
}

export { DEFAULT_CONFIG, MODEL_DEFAULTS };
