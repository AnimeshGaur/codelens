/**
 * All Mermaid diagram generators — ported from server/core/generators/
 * These are pure string functions with no dependencies on Node.js or vscode.
 */

// ─── Shared helpers ─────────────────────────────────────────────────────────

function sanitize(str: any): string {
    return (str || '')
        .replace(/[\u{1F300}-\u{1FFFF}]/gu, '')
        .replace(/"/g, "'")
        .replace(/[[\]\\]/g, '')
        .substring(0, 60)
        .trim();
}

function safeName(name: any): string {
    return (name || 'Unknown').replace(/[^a-zA-Z0-9_]/g, '_');
}

// ─── Component Diagram ──────────────────────────────────────────────────────

export function generateComponentDiagram(components: any[]): string {
    if (!Array.isArray(components) || components.length === 0) {
        return 'graph TD\n    NoComponents["No components detected"]';
    }
    const lines = ['graph TD'];
    const nodeIds = new Map<string, string>();
    const dirGroups = new Map<string, any[]>();
    for (const comp of components) {
        const dir = comp.directory || 'root';
        if (!dirGroups.has(dir)) { dirGroups.set(dir, []); }
        dirGroups.get(dir)!.push(comp);
    }
    let idx = 0;
    for (const [dir, comps] of dirGroups) {
        const dirId = `dir_${safeName(dir)}`;
        if (dirGroups.size > 1) { lines.push(`    subgraph ${dirId}["${sanitize(dir)}"]`); lines.push('        direction TB'); }
        for (const comp of comps) {
            const id = `c${idx++}`;
            nodeIds.set(comp.name, id);
            const fileCount = Array.isArray(comp.files) ? comp.files.length : 0;
            const badge = fileCount > 0 ? ` [${fileCount} files]` : '';
            const label = `${sanitize(comp.name)}${badge}`;
            const indent = dirGroups.size > 1 ? '        ' : '    ';
            lines.push(`${indent}${id}["${label}"]`);
        }
        if (dirGroups.size > 1) { lines.push('    end'); }
    }
    const edgeSet = new Set<string>();
    for (const comp of components) {
        const fromId = nodeIds.get(comp.name);
        if (!fromId) { continue; }
        for (const dep of comp.dependencies || []) {
            const toId = nodeIds.get(dep);
            if (!toId || fromId === toId) { continue; }
            const key = `${fromId}:${toId}`;
            if (edgeSet.has(key)) { continue; }
            edgeSet.add(key);
            lines.push(`    ${fromId} -->|uses| ${toId}`);
        }
    }
    return lines.join('\n');
}

// ─── Class Diagram ──────────────────────────────────────────────────────────

export function generateClassDiagram(classes: any[]): string {
    if (!classes || classes.length === 0) {
        return 'classDiagram\n    class NoClasses {\n        No classes detected\n    }';
    }
    const lines = ['classDiagram'];
    const validNames = new Set(classes.map(c => safeName(c.name)));
    const fileGroups = new Map<string, any[]>();
    for (const cls of classes) {
        const file = cls.file || 'unknown';
        if (!fileGroups.has(file)) { fileGroups.set(file, []); }
        fileGroups.get(file)!.push(cls);
    }
    const useNamespaces = fileGroups.size > 1;
    for (const [file, fileClasses] of fileGroups) {
        if (useNamespaces) { lines.push(`    namespace ${file.replace(/[^a-zA-Z0-9_]/g, '_')} {`); }
        for (const cls of fileClasses) {
            const name = safeName(cls.name);
            const indent = useNamespaces ? '        ' : '    ';
            lines.push(`${indent}class ${name} {`);
            if (cls.type === 'interface') { lines.push(`${indent}    <<interface>>`); }
            else if (cls.type === 'abstract') { lines.push(`${indent}    <<abstract>>`); }
            else if (cls.type === 'enum') { lines.push(`${indent}    <<enumeration>>`); }
            if (Array.isArray(cls.fields)) {
                for (const f of cls.fields) {
                    const vis = f.visibility === 'private' ? '-' : f.visibility === 'protected' ? '#' : '+';
                    lines.push(`${indent}    ${vis}${f.type || 'any'} ${safeName(f.name)}`);
                }
            }
            if (Array.isArray(cls.methods)) {
                for (const m of cls.methods) {
                    const vis = m.visibility === 'private' ? '-' : m.visibility === 'protected' ? '#' : '+';
                    lines.push(`${indent}    ${vis}${safeName(m.name)}() ${m.returnType || 'void'}`);
                }
            }
            lines.push(`${indent}}`);
        }
        if (useNamespaces) { lines.push('    }'); }
    }
    const relSeen = new Set<string>();
    for (const cls of classes) {
        const from = safeName(cls.name);
        if (cls.extends && validNames.has(safeName(cls.extends))) {
            const key = `${safeName(cls.extends)}<|--${from}`;
            if (!relSeen.has(key)) { relSeen.add(key); lines.push(`    ${safeName(cls.extends)} <|-- ${from} : extends`); }
        }
        for (const iface of cls.implements || []) {
            if (!validNames.has(safeName(iface))) { continue; }
            const key = `${safeName(iface)}<|..${from}`;
            if (!relSeen.has(key)) { relSeen.add(key); lines.push(`    ${safeName(iface)} <|.. ${from} : implements`); }
        }
    }
    return lines.join('\n');
}

// ─── Database (ER) Diagram ──────────────────────────────────────────────────

export function generateDbDiagram(database: any): string {
    const models = database?.models;
    if (!models || models.length === 0) {
        return 'erDiagram\n    NO_TABLES {\n        string message "No database models detected"\n    }';
    }
    const lines = ['erDiagram'];
    const tableNames = new Set(models.map((m: any) => safeName(m.tableName || m.name)));
    for (const model of models) {
        const tableName = safeName(model.tableName || model.name);
        lines.push(`    ${tableName} {`);
        for (const col of model.columns || []) {
            const type = (col.type || 'varchar').replace(/[^a-zA-Z0-9_()]/g, '_').toLowerCase();
            const pk = col.isPrimary ? ' PK' : '';
            lines.push(`        ${type} ${safeName(col.name)}${pk}`);
        }
        lines.push('    }');
    }
    const relSeen = new Set<string>();
    for (const model of models) {
        const from = safeName(model.tableName || model.name);
        for (const rel of model.relationships || []) {
            const to = safeName(rel.target);
            if (!tableNames.has(to) || from === to) { continue; }
            const key = [from, to].sort().join(':');
            if (relSeen.has(key)) { continue; }
            relSeen.add(key);
            const card = rel.type === 'one-to-one' ? '||--||' : rel.type === 'many-to-many' ? '}o--o{' : '||--o{';
            lines.push(`    ${from} ${card} ${to} : "${rel.type || 'relates'}"`);
        }
    }
    return lines.join('\n');
}

// ─── Endpoint Diagram ────────────────────────────────────────────────────────

export function generateEndpointDiagram(endpoints: any[]): string {
    if (!endpoints || endpoints.length === 0) {
        return 'graph LR\n    NoEndpoints["No endpoints detected"]';
    }
    const lines = ['graph LR'];
    const groups = new Map<string, any[]>();
    for (const ep of endpoints) {
        const resource = (ep.path || '/root').replace(/^\//, '').split('/').filter((s: string) => !/^(v\d+|api)$/i.test(s) && !s.startsWith(':'))[0] || 'root';
        if (!groups.has(resource)) { groups.set(resource, []); }
        groups.get(resource)!.push(ep);
    }
    const methodColor: Record<string, string> = { GET: '#61affe', POST: '#49cc90', PUT: '#fca130', PATCH: '#50e3c2', DELETE: '#f93e3e' };
    lines.push('    Client(("Client"))');
    lines.push('    style Client fill:#1ABC9C,stroke:#16A085,color:#fff');
    let nodeIdx = 0;
    for (const [resource, eps] of groups) {
        const groupId = `grp_${safeName(resource)}`;
        lines.push(`    subgraph ${groupId}["/${resource}"]`);
        lines.push('        direction TB');
        for (const ep of eps) {
            const id = `ep${nodeIdx++}`;
            const color = methodColor[(ep.method || '').toUpperCase()] || '#95A5A6';
            lines.push(`        ${id}["${sanitize(`${ep.method} ${ep.path}`)}"]`);
            lines.push(`        style ${id} fill:${color},stroke:#333,color:#fff`);
        }
        lines.push('    end');
        lines.push(`    Client --> ${groupId}`);
    }
    return lines.join('\n');
}

// ─── Architecture Diagram (simplified) ──────────────────────────────────────

export function generateArchitectureDiagram(architecture: any, fullModel: any = {}): string {
    const lines = ['graph TD'];
    const controllers = (fullModel.components || []).filter((c: any) => ['controller', 'middleware'].includes(c.type));
    const services = (fullModel.components || []).filter((c: any) => ['service', 'module', 'package'].includes(c.type));
    const models = (fullModel.components || []).filter((c: any) => ['model', 'config'].includes(c.type));

    lines.push('    Client(("Client"))');
    lines.push('    style Client fill:#1ABC9C,stroke:#16A085,color:#fff');

    if (controllers.length > 0 || (fullModel.endpoints || []).length > 0) {
        lines.push('    subgraph API_Layer["API Layer"]');
        lines.push('        direction LR');
        controllers.slice(0, 6).forEach((c: any, i: number) => {
            lines.push(`        ctrl${i}["${sanitize(c.name)}"]`);
            lines.push(`        style ctrl${i} fill:#4A90D9,stroke:#2c6db5,color:#fff`);
        });
        lines.push('    end');
        lines.push('    Client --> API_Layer');
    }

    if (services.length > 0) {
        lines.push('    subgraph Business_Layer["Business Logic"]');
        lines.push('        direction LR');
        services.slice(0, 6).forEach((s: any, i: number) => {
            lines.push(`        svc${i}(["${sanitize(s.name)}"])`);
            lines.push(`        style svc${i} fill:#7B68EE,stroke:#5548cc,color:#fff`);
        });
        lines.push('    end');
        lines.push('    API_Layer --> Business_Layer');
    }

    if (models.length > 0 || (fullModel.database?.models || []).length > 0) {
        lines.push('    subgraph Data_Layer["Data Layer"]');
        lines.push('        direction LR');
        (fullModel.database?.models || models).slice(0, 6).forEach((m: any, i: number) => {
            lines.push(`        db${i}[("${sanitize(m.name)}")]`);
            lines.push(`        style db${i} fill:#E67E22,stroke:#D35400,color:#fff`);
        });
        lines.push('    end');
        lines.push('    Business_Layer --> Data_Layer');
    }

    const subgraphs = ['API_Layer', 'Business_Layer', 'Data_Layer'];
    const sgColors = ['#1a3a5c', '#251a4a', '#3a2200'];
    subgraphs.forEach((sg, i) => lines.push(`    style ${sg} fill:${sgColors[i]},stroke:#3d4f7c,color:#a0aec0`));

    return lines.join('\n');
}

// ─── External API Diagram ────────────────────────────────────────────────────

export function generateExternalApiDiagram(externalAPIs: any[]): string {
    if (!externalAPIs || externalAPIs.length === 0) {
        return 'graph LR\n    NoAPIs["No external APIs detected"]';
    }
    const lines = ['graph LR'];
    lines.push('    App(("Application"))');
    lines.push('    style App fill:#7B68EE,stroke:#5548cc,color:#fff');
    const seen = new Set<string>();
    let idx = 0;
    for (const api of externalAPIs) {
        const name = api.service || api.url || 'Unknown';
        if (seen.has(name)) { continue; }
        seen.add(name);
        lines.push(`    ext${idx}>"${sanitize(name)}"]`);
        lines.push(`    style ext${idx} fill:#3498DB,stroke:#2980B9,color:#fff`);
        lines.push(`    App --> ext${idx}`);
        idx++;
    }
    return lines.join('\n');
}

// ─── Flow Diagram ────────────────────────────────────────────────────────────

export function generateFlowDiagram(flows: any[]): string {
    if (!flows || flows.length === 0) {
        return 'graph TD\n    NoFlows["No dependency flows detected"]';
    }
    const lines = ['graph TD'];
    const nodeMap = new Map<string, string>();
    let nodeIdx = 0;
    const getId = (name: string) => {
        if (!nodeMap.has(name)) { nodeMap.set(name, `n${nodeIdx++}`); }
        return nodeMap.get(name)!;
    };
    for (const flow of flows.slice(0, 5)) {
        lines.push(`    %% Flow: ${sanitize(flow.name)}`);
        for (const step of flow.steps || []) {
            const fromId = getId(step.from);
            const toId = getId(step.to);
            lines.push(`    ${fromId}["${sanitize(step.from)}"] -->|${sanitize(step.action || 'calls')}| ${toId}["${sanitize(step.to)}"]`);
        }
    }
    return lines.join('\n');
}
