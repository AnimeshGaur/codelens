/**
 * Aggregates per-batch LLM analysis results into a unified codebase model.
 * Deduplicates and resolves cross-file relationships.
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
      patterns: [],
      techStack: { languages: [], frameworks: [], databases: [], messageBrokers: [], other: [] },
      securitySurface: {
        authMechanism: 'None identified',
        protectedEndpoints: [],
        unprotectedEndpoints: [],
        dbWritePaths: [],
      },
      summary: '',
    },
  };

  for (const result of batchResults) {
    if (!result || typeof result !== 'object') continue;

    // Merge components
    if (Array.isArray(result.components)) {
      for (const comp of result.components) {
        const existing = model.components.find(c => c.name === comp.name);
        if (existing) {
          // Merge dependencies and files into existing
          existing.dependencies = uniqueArray([
            ...existing.dependencies,
            ...(comp.dependencies || []),
          ]);
          existing.files = uniqueArray([...existing.files, ...(comp.files || [])]);
        } else {
          model.components.push({ ...comp });
        }
      }
    }

    // Merge classes (dedupe by name + file)
    if (Array.isArray(result.classes)) {
      for (const cls of result.classes) {
        const exists = model.classes.some(c => c.name === cls.name && c.file === cls.file);
        if (!exists) {
          model.classes.push({ ...cls });
        }
      }
    }

    // Merge database models
    if (result.database?.models && Array.isArray(result.database.models)) {
      for (const dbModel of result.database.models) {
        const exists = model.database.models.some(
          m => m.name === dbModel.name || m.tableName === dbModel.tableName,
        );
        if (!exists) {
          model.database.models.push({ ...dbModel });
        }
      }
    }

    // Merge endpoints (dedupe by method + path)
    if (Array.isArray(result.endpoints)) {
      for (const ep of result.endpoints) {
        const exists = model.endpoints.some(e => e.method === ep.method && e.path === ep.path);
        if (!exists) {
          model.endpoints.push({ ...ep });
        }
      }
    }

    // Merge external APIs (dedupe by service + url)
    if (Array.isArray(result.externalAPIs)) {
      for (const api of result.externalAPIs) {
        const exists = model.externalAPIs.some(a => a.service === api.service && a.url === api.url);
        if (!exists) {
          model.externalAPIs.push({ ...api });
        }
      }
    }

    // Merge dependency flows
    if (Array.isArray(result.dependencyFlows)) {
      for (const flow of result.dependencyFlows) {
        const exists = model.dependencyFlows.some(f => f.name === flow.name);
        if (!exists) {
          model.dependencyFlows.push({ ...flow });
        }
      }
    }

    // Merge architecture info
    if (result.architecture) {
      const arch = result.architecture;

      if (Array.isArray(arch.patterns)) {
        model.architecture.patterns = uniqueArray([
          ...model.architecture.patterns,
          ...arch.patterns,
        ]);
      }

      if (arch.techStack) {
        for (const key of ['languages', 'frameworks', 'databases', 'messageBrokers', 'other']) {
          if (Array.isArray(arch.techStack[key])) {
            model.architecture.techStack[key] = uniqueArray([
              ...model.architecture.techStack[key],
              ...arch.techStack[key],
            ]);
          }
        }
      }

      if (arch.securitySurface) {
        const sec = arch.securitySurface;
        if (sec.authMechanism && sec.authMechanism !== 'None identified') {
          model.architecture.securitySurface.authMechanism = sec.authMechanism;
        }
        if (Array.isArray(sec.protectedEndpoints)) {
          model.architecture.securitySurface.protectedEndpoints = uniqueArray([
            ...model.architecture.securitySurface.protectedEndpoints,
            ...sec.protectedEndpoints,
          ]);
        }
        if (Array.isArray(sec.unprotectedEndpoints)) {
          model.architecture.securitySurface.unprotectedEndpoints = uniqueArray([
            ...model.architecture.securitySurface.unprotectedEndpoints,
            ...sec.unprotectedEndpoints,
          ]);
        }
        if (Array.isArray(sec.dbWritePaths)) {
          model.architecture.securitySurface.dbWritePaths = uniqueArray([
            ...model.architecture.securitySurface.dbWritePaths,
            ...sec.dbWritePaths,
          ]);
        }
      }

      if (arch.summary) {
        model.architecture.summary = arch.summary; // Last one wins
      }
    }
  }

  return model;
}

function uniqueArray(arr) {
  return [...new Set(arr.filter(Boolean))];
}
