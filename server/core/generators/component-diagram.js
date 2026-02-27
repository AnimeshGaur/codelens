/**
 * Generates a Mermaid graph TD diagram showing components grouped by directory,
 * with type-specific node shapes, file count badges, and dependency edges.
 *
 * @param {Array} components  From the aggregated codebase model
 * @returns {string} Mermaid diagram string (no markdown fences)
 */
export function generateComponentDiagram(components) {
  if (!Array.isArray(components) || components.length === 0) {
    return 'graph TD\n    NoComponents["No components detected"]';
  }

  const lines = ['graph TD'];
  const nodeIds = new Map();

  // ── Group components by directory ──────────────────────────────────────────
  const dirGroups = new Map();
  for (const comp of components) {
    const dir = comp.directory || 'root';
    if (!dirGroups.has(dir)) dirGroups.set(dir, []);
    dirGroups.get(dir).push(comp);
  }

  let globalIndex = 0;

  for (const [dir, comps] of dirGroups) {
    const dirId = `dir_${sanitize(dir).replace(/[^a-zA-Z0-9]/g, '_')}`;

    // Only use subgraphs when there are multiple directories
    if (dirGroups.size > 1) {
      lines.push(`    subgraph ${dirId}["${sanitize(dir)}"]`);
      lines.push(`        direction TB`);
    }

    for (const comp of comps) {
      const id = `c${globalIndex++}`;
      nodeIds.set(comp.name, id);

      const fileCount = Array.isArray(comp.files) ? comp.files.length : 0;
      const badge = fileCount > 0 ? ` [${fileCount} files]` : '';
      const label = `${sanitize(comp.name)}${badge}`;
      const indent = dirGroups.size > 1 ? '        ' : '    ';

      // Type-specific node shapes
      lines.push(`${indent}${id}${getNodeShape(comp.type, label)}`);
    }

    if (dirGroups.size > 1) {
      lines.push('    end');
    }
  }

  // ── Dependency edges (prefer static imports over LLM-inferred) ────────────
  const edgeSet = new Set();
  for (const comp of components) {
    const fromId = nodeIds.get(comp.name);
    if (!fromId) continue;

    // Use static deps first, fall back to LLM deps
    const deps = comp.staticDependencies?.length
      ? comp.staticDependencies
      : comp.dependencies || [];

    for (const dep of deps) {
      const toId = nodeIds.get(dep);
      if (!toId || fromId === toId) continue;
      const edgeKey = `${fromId}:${toId}`;
      if (edgeSet.has(edgeKey)) continue;
      edgeSet.add(edgeKey);
      lines.push(`    ${fromId} -->|uses| ${toId}`);
    }
  }

  // ── Style each node by type ───────────────────────────────────────────────
  for (const comp of components) {
    const id = nodeIds.get(comp.name);
    if (!id) continue;
    const { fill, stroke } = getTypeColors(comp.type);
    lines.push(`    style ${id} fill:${fill},stroke:${stroke},color:#fff,rx:6`);
  }

  // ── Style subgraphs ──────────────────────────────────────────────────────
  if (dirGroups.size > 1) {
    for (const dir of dirGroups.keys()) {
      const dirId = `dir_${sanitize(dir).replace(/[^a-zA-Z0-9]/g, '_')}`;
      lines.push(`    style ${dirId} fill:transparent,stroke:#3d4f7c,stroke-dasharray:5,color:#8892b0`);
    }
  }

  return lines.join('\n');
}

// ── Node shapes by type ─────────────────────────────────────────────────────

function getNodeShape(type, label) {
  switch (type) {
    case 'service':
      return `(["${label}"])`;         // stadium / pill shape
    case 'controller':
      return `["${label}"]`;           // rectangle
    case 'model':
      return `[/"${label}"/]`;         // parallelogram
    case 'middleware':
      return `{"${label}"}`;           // diamond
    case 'utility':
      return `>"${label}"]`;           // flag / asymmetric
    case 'config':
      return `[["${label}"]]`;         // subroutine
    case 'library':
      return `(("${label}"))`;         // circle
    default:
      return `["${label}"]`;           // rectangle fallback
  }
}

// ── Color palette ───────────────────────────────────────────────────────────

function getTypeColors(type) {
  const palette = {
    controller: { fill: '#4A90D9', stroke: '#2c6db5' },
    service: { fill: '#7B68EE', stroke: '#5548cc' },
    model: { fill: '#E67E22', stroke: '#c0651a' },
    utility: { fill: '#27AE60', stroke: '#1e8449' },
    middleware: { fill: '#8E44AD', stroke: '#6c3483' },
    config: { fill: '#5D6D7E', stroke: '#424f5e' },
    library: { fill: '#2C3E50', stroke: '#1a252f' },
    module: { fill: '#3498DB', stroke: '#2471a3' },
    package: { fill: '#1ABC9C', stroke: '#148f77' },
  };
  return palette[type] || { fill: '#3d7bd9', stroke: '#2c5fa3' };
}

function sanitize(str) {
  return (str || '')
    .replace(/[\u{1F300}-\u{1FFFF}]/gu, '')
    .replace(/"/g, "'")
    .replace(/[[\]\\]/g, '')
    .trim();
}
