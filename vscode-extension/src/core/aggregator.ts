/**
 * Aggregates per-batch LLM results into a unified codebase model.
 * Ported from server/core/aggregator.js — logic unchanged.
 */

export interface CodebaseModel {
    components: any[];
    classes: any[];
    database: { models: any[] };
    endpoints: any[];
    externalAPIs: any[];
    dependencyFlows: any[];
    architecture: {
        patterns: string[];
        techStack: {
            languages: string[];
            frameworks: string[];
            databases: string[];
            messageBrokers: string[];
            other: string[];
        };
        securitySurface: {
            authMechanism: string;
            protectedEndpoints: string[];
            unprotectedEndpoints: string[];
            dbWritePaths: string[];
        };
        summary: string;
    };
}

export function aggregateResults(batchResults: object[]): CodebaseModel {
    const model: any = {
        components: [],
        classes: [],
        database: { models: [] },
        endpoints: [],
        externalAPIs: [],
        dependencyFlows: [],
        architecture: {
            patterns: new Set<string>(),
            techStack: { languages: new Set(), frameworks: new Set(), databases: new Set(), messageBrokers: new Set(), other: new Set() },
            securitySurface: {
                authMechanism: 'None identified',
                protectedEndpoints: new Set<string>(),
                unprotectedEndpoints: new Set<string>(),
                dbWritePaths: new Set<string>(),
            },
            summary: '',
        },
    };

    const componentMap = new Map<string, any>();
    const classKeys = new Set<string>();
    const dbModelKeys = new Set<string>();
    const endpointKeys = new Set<string>();
    const externalApiKeys = new Set<string>();
    const flowKeys = new Set<string>();

    for (const result of batchResults) {
        const r = result as any;
        if (!r || typeof r !== 'object') { continue; }

        if (Array.isArray(r.components)) {
            for (const comp of r.components) {
                const existing = componentMap.get(comp.name);
                if (existing) {
                    const depSet = new Set(existing.dependencies);
                    for (const d of comp.dependencies || []) { depSet.add(d); }
                    existing.dependencies = [...depSet];
                    const fileSet = new Set(existing.files);
                    for (const f of comp.files || []) { fileSet.add(f); }
                    existing.files = [...fileSet];
                } else {
                    const entry = { ...comp };
                    componentMap.set(comp.name, entry);
                    model.components.push(entry);
                }
            }
        }

        if (Array.isArray(r.classes)) {
            for (const cls of r.classes) {
                const key = `${cls.name}|${cls.file}`;
                if (!classKeys.has(key)) { classKeys.add(key); model.classes.push({ ...cls }); }
            }
        }

        if (r.database?.models && Array.isArray(r.database.models)) {
            for (const dbModel of r.database.models) {
                const key = `${dbModel.name}|${dbModel.tableName}`;
                if (!dbModelKeys.has(key)) { dbModelKeys.add(key); model.database.models.push({ ...dbModel }); }
            }
        }

        if (Array.isArray(r.endpoints)) {
            for (const ep of r.endpoints) {
                const key = `${ep.method}|${ep.path}`;
                if (!endpointKeys.has(key)) { endpointKeys.add(key); model.endpoints.push({ ...ep }); }
            }
        }

        if (Array.isArray(r.externalAPIs)) {
            for (const api of r.externalAPIs) {
                const key = `${api.service}|${api.url}`;
                if (!externalApiKeys.has(key)) { externalApiKeys.add(key); model.externalAPIs.push({ ...api }); }
            }
        }

        if (Array.isArray(r.dependencyFlows)) {
            for (const flow of r.dependencyFlows) {
                if (!flowKeys.has(flow.name)) { flowKeys.add(flow.name); model.dependencyFlows.push({ ...flow }); }
            }
        }

        if (r.architecture) {
            const arch = r.architecture;
            if (Array.isArray(arch.patterns)) { for (const p of arch.patterns) if (p) { model.architecture.patterns.add(p); } }
            if (arch.techStack) {
                for (const key of ['languages', 'frameworks', 'databases', 'messageBrokers', 'other'] as const) {
                    if (Array.isArray(arch.techStack[key])) {
                        for (const item of arch.techStack[key]) { if (item) { model.architecture.techStack[key].add(item); } }
                    }
                }
            }
            if (arch.securitySurface) {
                const sec = arch.securitySurface;
                if (sec.authMechanism && sec.authMechanism !== 'None identified') {
                    model.architecture.securitySurface.authMechanism = sec.authMechanism;
                }
                for (const ep of sec.protectedEndpoints || []) { if (ep) { model.architecture.securitySurface.protectedEndpoints.add(ep); } }
                for (const ep of sec.unprotectedEndpoints || []) { if (ep) { model.architecture.securitySurface.unprotectedEndpoints.add(ep); } }
                for (const p of sec.dbWritePaths || []) { if (p) { model.architecture.securitySurface.dbWritePaths.add(p); } }
            }
            if (arch.summary) { model.architecture.summary = arch.summary; }
        }
    }

    // Convert Sets to Arrays
    model.architecture.patterns = [...model.architecture.patterns];
    for (const key of ['languages', 'frameworks', 'databases', 'messageBrokers', 'other'] as const) {
        model.architecture.techStack[key] = [...model.architecture.techStack[key]];
    }
    model.architecture.securitySurface.protectedEndpoints = [...model.architecture.securitySurface.protectedEndpoints];
    model.architecture.securitySurface.unprotectedEndpoints = [...model.architecture.securitySurface.unprotectedEndpoints];
    model.architecture.securitySurface.dbWritePaths = [...model.architecture.securitySurface.dbWritePaths];

    return model;
}
