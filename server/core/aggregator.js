/**
 * Aggregates per-batch LLM analysis results into a unified codebase model.
 *
 * All deduplication uses Map/Set lookups — O(n) total, not O(n²).
 */

/**
 * Merge multiple batch results into a single codebase model.
 * @param {Array<object>} batchResults  Array of JSON results from the analyzer
 * @returns {object} Unified codebase model
 */
export function aggregateResults(batchResults) {
  const model = {
    components: [],
    classes: [],
    database: { models: [] },
    endpoints: [],
    externalAPIs: [],
    dependencyFlows: [],
    architecture: {
      patterns: new Set(),
      techStack: { languages: new Set(), frameworks: new Set(), databases: new Set(), messageBrokers: new Set(), other: new Set() },
      securitySurface: {
        authMechanism: 'None identified',
        protectedEndpoints: new Set(),
        unprotectedEndpoints: new Set(),
        dbWritePaths: new Set(),
      },
      summary: '',
    },
  };

  // O(1) lookup maps for deduplication
  const componentMap = new Map();     // name → component
  const classKeys = new Set();        // "name|file"
  const dbModelKeys = new Set();      // "name|tableName"
  const endpointKeys = new Set();     // "method|path"
  const externalApiKeys = new Set();  // "service|url"
  const flowKeys = new Set();         // name

  for (const result of batchResults) {
    if (!result || typeof result !== 'object') continue;

    // Merge components — O(n)
    if (Array.isArray(result.components)) {
      for (const comp of result.components) {
        const existing = componentMap.get(comp.name);
        if (existing) {
          // Merge dependencies using Set for O(1) dedup
          const depSet = new Set(existing.dependencies);
          for (const d of comp.dependencies || []) depSet.add(d);
          existing.dependencies = [...depSet];

          const fileSet = new Set(existing.files);
          for (const f of comp.files || []) fileSet.add(f);
          existing.files = [...fileSet];
        } else {
          const entry = { ...comp };
          componentMap.set(comp.name, entry);
          model.components.push(entry);
        }
      }
    }

    // Merge classes — O(n) using composite key
    if (Array.isArray(result.classes)) {
      for (const cls of result.classes) {
        const key = `${cls.name}|${cls.file}`;
        if (!classKeys.has(key)) {
          classKeys.add(key);
          model.classes.push({ ...cls });
        }
      }
    }

    // Merge database models — O(n)
    if (result.database?.models && Array.isArray(result.database.models)) {
      for (const dbModel of result.database.models) {
        const key = `${dbModel.name}|${dbModel.tableName}`;
        if (!dbModelKeys.has(key)) {
          dbModelKeys.add(key);
          model.database.models.push({ ...dbModel });
        }
      }
    }

    // Merge endpoints — O(n)
    if (Array.isArray(result.endpoints)) {
      for (const ep of result.endpoints) {
        const key = `${ep.method}|${ep.path}`;
        if (!endpointKeys.has(key)) {
          endpointKeys.add(key);
          model.endpoints.push({ ...ep });
        }
      }
    }

    // Merge external APIs — O(n)
    if (Array.isArray(result.externalAPIs)) {
      for (const api of result.externalAPIs) {
        const key = `${api.service}|${api.url}`;
        if (!externalApiKeys.has(key)) {
          externalApiKeys.add(key);
          model.externalAPIs.push({ ...api });
        }
      }
    }

    // Merge dependency flows — O(n)
    if (Array.isArray(result.dependencyFlows)) {
      for (const flow of result.dependencyFlows) {
        if (!flowKeys.has(flow.name)) {
          flowKeys.add(flow.name);
          model.dependencyFlows.push({ ...flow });
        }
      }
    }

    // Merge architecture info — O(n) via Set
    if (result.architecture) {
      const arch = result.architecture;

      if (Array.isArray(arch.patterns)) {
        for (const p of arch.patterns) if (p) model.architecture.patterns.add(p);
      }

      if (arch.techStack) {
        for (const key of ['languages', 'frameworks', 'databases', 'messageBrokers', 'other']) {
          if (Array.isArray(arch.techStack[key])) {
            for (const item of arch.techStack[key]) if (item) model.architecture.techStack[key].add(item);
          }
        }
      }

      if (arch.securitySurface) {
        const sec = arch.securitySurface;
        if (sec.authMechanism && sec.authMechanism !== 'None identified') {
          model.architecture.securitySurface.authMechanism = sec.authMechanism;
        }
        if (Array.isArray(sec.protectedEndpoints)) {
          for (const e of sec.protectedEndpoints) if (e) model.architecture.securitySurface.protectedEndpoints.add(e);
        }
        if (Array.isArray(sec.unprotectedEndpoints)) {
          for (const e of sec.unprotectedEndpoints) if (e) model.architecture.securitySurface.unprotectedEndpoints.add(e);
        }
        if (Array.isArray(sec.dbWritePaths)) {
          for (const p of sec.dbWritePaths) if (p) model.architecture.securitySurface.dbWritePaths.add(p);
        }
      }

      if (arch.summary) {
        model.architecture.summary = arch.summary;
      }
    }
  }

  // Convert Sets back to Arrays for the final model
  model.architecture.patterns = [...model.architecture.patterns];
  for (const key of ['languages', 'frameworks', 'databases', 'messageBrokers', 'other']) {
    model.architecture.techStack[key] = [...model.architecture.techStack[key]];
  }
  model.architecture.securitySurface.protectedEndpoints = [...model.architecture.securitySurface.protectedEndpoints];
  model.architecture.securitySurface.unprotectedEndpoints = [...model.architecture.securitySurface.unprotectedEndpoints];
  model.architecture.securitySurface.dbWritePaths = [...model.architecture.securitySurface.dbWritePaths];

  return model;
}
