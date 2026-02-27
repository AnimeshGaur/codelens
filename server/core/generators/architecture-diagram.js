/**
 * Generates a Mermaid graph TD showing a layered architecture view.
 * Uses actual component/endpoint/database data to populate layers.
 *
 * @param {object} architecture  From the aggregated codebase model
 * @param {object} fullModel     The complete aggregated model (optional, for layer population)
 * @returns {string} Mermaid diagram string (no markdown fences)
 */
export function generateArchitectureDiagram(architecture, fullModel = {}) {
  if (!architecture && !fullModel) {
    return 'graph TD\n    NoArch["No architecture info detected"]';
  }

  const lines = ['graph TD'];

  // ── Derive layers from actual data ────────────────────────────────────────
  const controllers = (fullModel.components || []).filter(c => ['controller', 'middleware'].includes(c.type));
  const services = (fullModel.components || []).filter(c => ['service', 'module', 'package'].includes(c.type));
  const models = (fullModel.components || []).filter(c => ['model', 'config'].includes(c.type));
  const utilities = (fullModel.components || []).filter(c => ['utility', 'library'].includes(c.type));
  const endpoints = fullModel.endpoints || [];
  const dbModels = fullModel.database?.models || [];
  const externalApis = fullModel.externalAPIs || [];

  // ── Client layer ──────────────────────────────────────────────────────────
  lines.push('    Client(("Client"))');
  lines.push('    style Client fill:#1ABC9C,stroke:#16A085,color:#fff');

  // ── API / Controller layer ────────────────────────────────────────────────
  if (controllers.length > 0 || endpoints.length > 0) {
    lines.push('    subgraph API_Layer["API Layer"]');
    lines.push('        direction LR');

    if (endpoints.length > 0) {
      const grouped = new Map();
      for (const ep of endpoints.slice(0, 12)) {
        const fw = ep.framework || 'HTTP';
        if (!grouped.has(fw)) grouped.set(fw, []);
        grouped.get(fw).push(ep);
      }
      let epIdx = 0;
      for (const [fw, eps] of grouped) {
        for (const ep of eps) {
          const label = `${ep.method} ${sanitize(ep.path)}`;
          const mw = Array.isArray(ep.middleware) && ep.middleware.length > 0
            ? ` [${ep.middleware.join(', ')}]`
            : '';
          lines.push(`        ep${epIdx}["${label}${mw}"]`);
          lines.push(`        style ep${epIdx} fill:${methodColor(ep.method)},stroke:#333,color:#fff`);
          epIdx++;
        }
      }
    } else {
      for (let i = 0; i < controllers.length; i++) {
        lines.push(`        ctrl${i}["${sanitize(controllers[i].name)}"]`);
        lines.push(`        style ctrl${i} fill:#4A90D9,stroke:#2c6db5,color:#fff`);
      }
    }
    lines.push('    end');
    lines.push('    Client --> API_Layer');
  }

  // ── Business Logic / Services layer ───────────────────────────────────────
  if (services.length > 0) {
    lines.push('    subgraph Business_Layer["Business Logic"]');
    lines.push('        direction LR');
    for (let i = 0; i < services.length; i++) {
      lines.push(`        svc${i}(["${sanitize(services[i].name)}"])`)
      lines.push(`        style svc${i} fill:#7B68EE,stroke:#5548cc,color:#fff`);
    }
    lines.push('    end');
    if (controllers.length > 0 || endpoints.length > 0) {
      lines.push('    API_Layer --> Business_Layer');
    } else {
      lines.push('    Client --> Business_Layer');
    }
  }

  // ── Data Access / Models layer ────────────────────────────────────────────
  if (models.length > 0 || dbModels.length > 0) {
    lines.push('    subgraph Data_Layer["Data Layer"]');
    lines.push('        direction LR');

    if (dbModels.length > 0) {
      for (let i = 0; i < Math.min(dbModels.length, 8); i++) {
        const orm = dbModels[i].orm ? ` (${sanitize(dbModels[i].orm)})` : '';
        lines.push(`        db${i}[("${sanitize(dbModels[i].name)}${orm}")]`);
        lines.push(`        style db${i} fill:#E67E22,stroke:#D35400,color:#fff`);
      }
    } else {
      for (let i = 0; i < models.length; i++) {
        lines.push(`        mdl${i}["${sanitize(models[i].name)}"]`);
        lines.push(`        style mdl${i} fill:#E67E22,stroke:#c0651a,color:#fff`);
      }
    }
    lines.push('    end');
    if (services.length > 0) {
      lines.push('    Business_Layer --> Data_Layer');
    } else if (controllers.length > 0 || endpoints.length > 0) {
      lines.push('    API_Layer --> Data_Layer');
    }
  }

  // ── External Services layer ───────────────────────────────────────────────
  if (externalApis.length > 0) {
    lines.push('    subgraph External_Services["External Services"]');
    lines.push('        direction LR');
    const seen = new Set();
    let extIdx = 0;
    for (const api of externalApis) {
      const name = api.service || api.url || 'Unknown';
      if (seen.has(name)) continue;
      seen.add(name);
      const sdkLabel = api.sdk ? ` (${sanitize(api.sdk)})` : '';
      lines.push(`        ext${extIdx}>"${sanitize(name)}${sdkLabel}"]`);
      lines.push(`        style ext${extIdx} fill:#3498DB,stroke:#2980B9,color:#fff`);
      extIdx++;
    }
    lines.push('    end');
    if (services.length > 0) {
      lines.push('    Business_Layer --> External_Services');
    } else if (controllers.length > 0 || endpoints.length > 0) {
      lines.push('    API_Layer --> External_Services');
    }
  }

  // ── Shared Utilities sidebar ──────────────────────────────────────────────
  if (utilities.length > 0) {
    lines.push('    subgraph Shared["Shared / Utilities"]');
    lines.push('        direction TB');
    for (let i = 0; i < utilities.length; i++) {
      lines.push(`        util${i}[["${sanitize(utilities[i].name)}"]]`);
      lines.push(`        style util${i} fill:#27AE60,stroke:#1e8449,color:#fff`);
    }
    lines.push('    end');
    // Utilities connect sideways to business layer
    if (services.length > 0) {
      lines.push('    Shared -.-> Business_Layer');
    }
  }

  // ── Architecture meta: patterns & tech stack as notes ─────────────────────
  if (architecture) {
    const ts = architecture.techStack;
    const meta = [];

    if (architecture.patterns?.length > 0) {
      meta.push(`Patterns: ${architecture.patterns.join(', ')}`);
    }
    if (ts?.frameworks?.length > 0) {
      meta.push(`Frameworks: ${ts.frameworks.join(', ')}`);
    }
    if (ts?.databases?.length > 0) {
      meta.push(`Databases: ${ts.databases.join(', ')}`);
    }
    if (ts?.languages?.length > 0) {
      meta.push(`Languages: ${ts.languages.join(', ')}`);
    }

    if (meta.length > 0) {
      // Security indicator
      const sec = architecture.securitySurface;
      if (sec) {
        const auth = sec.authMechanism || 'None';
        const prot = sec.protectedEndpoints?.length || 0;
        const unprot = sec.unprotectedEndpoints?.length || 0;
        meta.push(`Auth: ${auth} | Protected: ${prot} | Unprotected: ${unprot}`);
      }

      lines.push(`    Meta["${sanitize(meta.join(' | '))}"]`);
      lines.push('    style Meta fill:#1e2440,stroke:#3d4f7c,color:#8892b0,stroke-dasharray:5');
    }
  }

  // ── Subgraph styles ───────────────────────────────────────────────────────
  const subgraphs = ['API_Layer', 'Business_Layer', 'Data_Layer', 'External_Services', 'Shared'];
  const sgColors = ['#1a3a5c', '#251a4a', '#3a2200', '#0a2540', '#0a3020'];
  subgraphs.forEach((sg, i) => {
    lines.push(`    style ${sg} fill:${sgColors[i]},stroke:#3d4f7c,color:#a0aec0`);
  });

  return lines.join('\n');
}

function methodColor(method) {
  const colors = {
    GET: '#61affe', POST: '#49cc90', PUT: '#fca130',
    PATCH: '#50e3c2', DELETE: '#f93e3e',
  };
  return colors[(method || '').toUpperCase()] || '#95A5A6';
}

function sanitize(str) {
  return (str || '')
    .replace(/[\u{1F300}-\u{1FFFF}]/gu, '')
    .replace(/"/g, "'")
    .replace(/[[\]\\]/g, '')
    .substring(0, 60)
    .trim();
}
