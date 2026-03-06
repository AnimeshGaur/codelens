/**
 * Generates a Mermaid classDiagram with namespace grouping,
 * stereotype annotations, full field/method signatures, and rich relationships.
 *
 * @param {Array} classes  From the aggregated codebase model
 * @returns {string} Mermaid diagram string (no markdown fences)
 */
export function generateClassDiagram(classes) {
  if (!classes || classes.length === 0) {
    return 'classDiagram\n    class NoClasses {\n        No classes detected\n    }';
  }

  const lines = ['classDiagram'];
  const validNames = new Set(classes.map(c => safeName(c.name)));

  // ── Group classes by file/package for namespace blocks ────────────────────
  const fileGroups = new Map();
  for (const cls of classes) {
    const file = cls.file || 'unknown';
    if (!fileGroups.has(file)) fileGroups.set(file, []);
    fileGroups.get(file).push(cls);
  }

  const useNamespaces = fileGroups.size > 1;

  for (const [file, fileClasses] of fileGroups) {
    // Use namespace blocks when classes span multiple files
    if (useNamespaces) {
      const nsName = file.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_');
      lines.push(`    namespace ${nsName} {`);
    }

    for (const cls of fileClasses) {
      const name = safeName(cls.name);
      const indent = useNamespaces ? '        ' : '    ';

      lines.push(`${indent}class ${name} {`);

      // Stereotype annotation
      if (cls.type === 'interface') lines.push(`${indent}    <<interface>>`);
      else if (cls.type === 'abstract') lines.push(`${indent}    <<abstract>>`);
      else if (cls.type === 'enum') lines.push(`${indent}    <<enumeration>>`);
      else if (cls.type === 'struct') lines.push(`${indent}    <<struct>>`);
      else if (cls.type === 'trait') lines.push(`${indent}    <<trait>>`);

      // Fields with full type annotation
      if (Array.isArray(cls.fields)) {
        for (const field of cls.fields) {
          const vis = visibilitySymbol(field.visibility);
          const type = field.type || 'any';
          lines.push(`${indent}    ${vis}${type} ${safeMember(field.name)}`);
        }
      }

      // Methods with return type and static marker
      if (Array.isArray(cls.methods)) {
        for (const method of cls.methods) {
          const vis = visibilitySymbol(method.visibility);
          const ret = method.returnType || 'void';
          const stat = method.isStatic ? '$ ' : '';
          const abs = method.isAbstract ? '* ' : '';
          lines.push(`${indent}    ${vis}${stat}${abs}${safeMember(method.name)}() ${ret}`);
        }
      }

      // Language annotation inside the class
      if (cls.language) {
        lines.push(`${indent}    +String __language = "${sanitize(cls.language)}"`);
      }

      lines.push(`${indent}}`);
    }

    if (useNamespaces) {
      lines.push('    }');
    }
  }

  // ── Relationships ─────────────────────────────────────────────────────────
  const relSeen = new Set();

  for (const cls of classes) {
    const from = safeName(cls.name);

    // Inheritance
    if (cls.extends && validNames.has(safeName(cls.extends))) {
      const key = `${safeName(cls.extends)}<|--${from}`;
      if (!relSeen.has(key)) {
        relSeen.add(key);
        lines.push(`    ${safeName(cls.extends)} <|-- ${from} : extends`);
      }
    }

    // Implements
    if (Array.isArray(cls.implements)) {
      for (const iface of cls.implements) {
        if (!validNames.has(safeName(iface))) continue;
        const key = `${safeName(iface)}<|..${from}`;
        if (!relSeen.has(key)) {
          relSeen.add(key);
          lines.push(`    ${safeName(iface)} <|.. ${from} : implements`);
        }
      }
    }

    // Other relationships (composes, aggregates, uses)
    if (Array.isArray(cls.relationships)) {
      for (const rel of cls.relationships) {
        const target = safeName(rel.target);
        if (!validNames.has(target) || target === from) continue;
        if (rel.type === 'extends' || rel.type === 'implements') continue;

        const key = `${from}:${rel.type}:${target}`;
        if (relSeen.has(key)) continue;
        relSeen.add(key);

        switch (rel.type) {
          case 'composes':
            lines.push(`    ${from} *-- ${target} : composes`);
            break;
          case 'aggregates':
            lines.push(`    ${from} o-- ${target} : aggregates`);
            break;
          case 'uses':
          case 'depends':
            lines.push(`    ${from} ..> ${target} : uses`);
            break;
          case 'creates':
            lines.push(`    ${from} ..> ${target} : creates`);
            break;
          default:
            lines.push(`    ${from} ..> ${target} : ${sanitize(rel.type)}`);
        }
      }
    }
  }

  return lines.join('\n');
}

function visibilitySymbol(vis) {
  switch (vis) {
    case 'private': return '-';
    case 'protected': return '#';
    case 'public': return '+';
    case 'internal': return '~';
    default: return '+';
  }
}

function safeName(name) {
  return (name || 'Unknown').replace(/[^a-zA-Z0-9_]/g, '_');
}

function safeMember(name) {
  return (name || 'unknown').replace(/[^a-zA-Z0-9_]/g, '_');
}

function sanitize(str) {
  return (str || '')
    .replace(/[\u{1F300}-\u{1FFFF}]/gu, '')
    .replace(/"/g, "'")
    .replace(/[[\]\\]/g, '')
    .trim();
}
