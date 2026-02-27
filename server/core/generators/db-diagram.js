/**
 * Generates a Mermaid erDiagram showing database tables, columns, ORM, and relationships.
 *
 * @param {object} database  From the aggregated codebase model (has .models array)
 * @returns {string} Mermaid diagram string (no markdown fences)
 */
export function generateDbDiagram(database) {
  const models = database?.models;
  if (!models || models.length === 0) {
    return 'erDiagram\n    NO_TABLES {\n        string message "No database models detected"\n    }';
  }

  const lines = ['erDiagram'];
  const tableNames = new Set(models.map(m => safeName(m.tableName || m.name)));

  for (const model of models) {
    const tableName = safeName(model.tableName || model.name);

    // Table header comment with ORM info
    if (model.orm) {
      lines.push(`    %% ORM: ${model.orm}${model.file ? ` | File: ${model.file}` : ''}`);
    }

    lines.push(`    ${tableName} {`);

    if (Array.isArray(model.columns)) {
      for (const col of model.columns) {
        const type = safeType(col.type || 'varchar');
        const name = safeName(col.name);
        const constraints = [];
        if (col.isPrimary) constraints.push('PK');
        if (col.isForeignKey || col.foreignKey) constraints.push('FK');
        if (col.isUnique) constraints.push('UK');
        if (col.isNullable === false) constraints.push('NOT NULL');
        if (col.defaultValue !== null && col.defaultValue !== undefined) {
          constraints.push(`DEFAULT ${String(col.defaultValue).substring(0, 20)}`);
        }
        const comment = constraints.length > 0 ? ` "${constraints.join(', ')}"` : '';
        lines.push(`        ${type} ${name}${comment}`);
      }
    }

    lines.push('    }');
  }

  // Relationships with labels
  const relSeen = new Set();
  for (const model of models) {
    const from = safeName(model.tableName || model.name);
    if (!Array.isArray(model.relationships)) continue;

    for (const rel of model.relationships) {
      const to = safeName(rel.target);
      if (!tableNames.has(to) || from === to) continue;

      const key = [from, to].sort().join(':');
      if (relSeen.has(key)) continue;
      relSeen.add(key);

      const cardinality = getCardinality(rel.type);
      const label = rel.foreignKey
        ? `"${safeName(rel.foreignKey)}"`
        : `"${rel.type || 'relates'}"`;
      lines.push(`    ${from} ${cardinality} ${to} : ${label}`);
    }
  }

  return lines.join('\n');
}

function getCardinality(relType) {
  switch (relType) {
    case 'one-to-one': return '||--||';
    case 'one-to-many':
    case 'has-many': return '||--o{';
    case 'many-to-one':
    case 'belongs-to': return '}o--||';
    case 'many-to-many': return '}o--o{';
    default: return '||--o{';
  }
}

function safeName(name) {
  return (name || 'unknown').replace(/[^a-zA-Z0-9_]/g, '_');
}

function safeType(type) {
  return (type || 'varchar').replace(/[^a-zA-Z0-9_()]/g, '_').toLowerCase();
}
