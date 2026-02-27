/**
 * Generates a Mermaid graph LR diagram showing REST/HTTP endpoints
 * grouped by resource, with handler, middleware, and framework info.
 *
 * @param {Array} endpoints  From the aggregated codebase model
 * @returns {string} Mermaid diagram string (no markdown fences)
 */
export function generateEndpointDiagram(endpoints) {
  if (!endpoints || endpoints.length === 0) {
    return 'graph LR\n    NoEndpoints["No endpoints detected"]';
  }

  const lines = ['graph LR'];

  // Group endpoints by resource (first meaningful path segment)
  const groups = new Map();
  for (const ep of endpoints) {
    const resource = extractResource(ep.path);
    if (!groups.has(resource)) groups.set(resource, []);
    groups.get(resource).push(ep);
  }

  // Detect framework
  const frameworks = [...new Set(endpoints.map(e => e.framework).filter(Boolean))];
  if (frameworks.length > 0) {
    lines.push(`    FW["${sanitize(frameworks.join(' + '))}"]`);
    lines.push('    style FW fill:#1e2440,stroke:#3d4f7c,color:#8892b0,stroke-dasharray:5');
  }

  // Client node
  lines.push('    Client(("Client"))');
  lines.push('    style Client fill:#1ABC9C,stroke:#16A085,color:#fff');

  let nodeIndex = 0;

  for (const [resource, eps] of groups) {
    const groupId = `grp_${safeName(resource)}`;
    lines.push(`    subgraph ${groupId}["/${resource}"]`);
    lines.push('        direction TB');

    for (const ep of eps) {
      const id = `ep${nodeIndex++}`;
      const color = methodColor(ep.method);

      // Build rich label: METHOD /path
      const label = `${ep.method} ${ep.path}`;
      lines.push(`        ${id}["${sanitize(label)}"]`);
      lines.push(`        style ${id} fill:${color},stroke:#333,color:#fff`);

      // Handler node (shows which function handles this endpoint)
      if (ep.handler) {
        const handlerId = `h${nodeIndex}`;
        lines.push(`        ${handlerId}[/"${sanitize(ep.handler)}"/]`);
        lines.push(`        style ${handlerId} fill:#2C3E50,stroke:#1a252f,color:#ecf0f1`);
        lines.push(`        ${id} --> ${handlerId}`);
      }

      // Middleware badges
      if (Array.isArray(ep.middleware) && ep.middleware.length > 0) {
        const mwId = `mw${nodeIndex}`;
        const mwLabel = ep.middleware.map(m => sanitize(m)).join(', ');
        lines.push(`        ${mwId}{{"${mwLabel}"}}`);
        lines.push(`        style ${mwId} fill:#8E44AD,stroke:#6c3483,color:#fff`);
        lines.push(`        ${mwId} -.-> ${id}`);
      }
    }

    lines.push('    end');
    lines.push(`    Client --> ${groupId}`);
  }

  return lines.join('\n');
}

function extractResource(path) {
  if (!path) return 'root';
  const segments = path.replace(/^\//, '').split('/');
  for (const seg of segments) {
    if (!/^(v\d+|api)$/i.test(seg) && !seg.startsWith(':') && !seg.startsWith('{')) {
      return seg || 'root';
    }
  }
  return segments[0] || 'root';
}

function methodColor(method) {
  const colors = {
    GET: '#61affe', POST: '#49cc90', PUT: '#fca130',
    PATCH: '#50e3c2', DELETE: '#f93e3e',
  };
  return colors[(method || '').toUpperCase()] || '#95A5A6';
}

function safeName(name) {
  return (name || 'unknown').replace(/[^a-zA-Z0-9_]/g, '_');
}

function sanitize(str) {
  return (str || '')
    .replace(/[\u{1F300}-\u{1FFFF}]/gu, '')
    .replace(/"/g, "'")
    .replace(/[[\]\\]/g, '')
    .substring(0, 60)
    .trim();
}
