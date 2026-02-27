/**
 * Generates an interactive JSON representation of the architecture layers
 * for rendering in React Flow / Dagre.
 *
 * @param {object} architecture  From the aggregated codebase model
 * @param {object} fullModel     The complete aggregated model
 * @returns {object} JSON structure with nodes and edges
 */
export function generateArchitectureJSON(architecture, fullModel = {}) {
    const nodes = [];
    const edges = [];

    // ── 1. Create Layout Layers (Groups) ──────────────────────────────────────
    const layers = [
        { id: 'layer_client', label: 'Client / Frontend' },
        { id: 'layer_api', label: 'API / Controllers' },
        { id: 'layer_business', label: 'Business Logic / Services' },
        { id: 'layer_data', label: 'Data Access / Models' },
        { id: 'layer_external', label: 'External Services' },
        { id: 'layer_shared', label: 'Shared / Utilities' },
    ];

    for (let i = 0; i < layers.length; i++) {
        nodes.push({
            id: layers[i].id,
            type: 'layer',
            data: { label: layers[i].label, layerIndex: i },
            position: { x: 0, y: 0 }, // Dagre will set this
        });
    }

    // ── 2. Populate Layers with Nodes ─────────────────────────────────────────

    const controllers = (fullModel.components || []).filter(c => ['controller', 'middleware'].includes(c.type));
    const services = (fullModel.components || []).filter(c => ['service', 'module', 'package'].includes(c.type));
    const models = (fullModel.components || []).filter(c => ['model', 'config'].includes(c.type));
    const utilities = (fullModel.components || []).filter(c => ['utility', 'library'].includes(c.type));
    const endpoints = fullModel.endpoints || [];
    const dbModels = fullModel.database?.models || [];
    const externalApis = fullModel.externalAPIs || [];

    // Add Client Node
    nodes.push({
        id: 'n_client',
        type: 'component',
        data: { label: 'Client', type: 'client' },
        parentNode: 'layer_client',
        extent: 'parent',
    });

    // Add API Nodes
    if (endpoints.length > 0) {
        const grouped = new Map();
        for (const ep of endpoints.slice(0, 12)) {
            const fw = ep.framework || 'HTTP';
            if (!grouped.has(fw)) grouped.set(fw, []);
            grouped.get(fw).push(ep);
        }
        let idx = 0;
        for (const [fw, eps] of grouped) {
            for (const ep of eps) {
                nodes.push({
                    id: `n_api_${idx++}`,
                    type: 'component',
                    data: { label: `${ep.method} ${ep.path}`, type: 'endpoint', details: ep.framework },
                    parentNode: 'layer_api',
                    extent: 'parent',
                });
            }
        }
    } else {
        for (let i = 0; i < controllers.length; i++) {
            nodes.push({
                id: `n_ctrl_${i}`,
                type: 'component',
                data: { label: controllers[i].name, type: 'controller' },
                parentNode: 'layer_api',
                extent: 'parent',
            });
        }
    }

    // Add Business Nodes
    for (let i = 0; i < services.length; i++) {
        nodes.push({
            id: `n_svc_${i}`,
            type: 'component',
            data: { label: services[i].name, type: 'service' },
            parentNode: 'layer_business',
            extent: 'parent',
        });
    }

    // Add Data Nodes
    let dbCount = 0;
    for (const db of dbModels.slice(0, 8)) {
        nodes.push({
            id: `n_db_${dbCount++}`,
            type: 'component',
            data: { label: db.name, type: 'database', details: db.orm },
            parentNode: 'layer_data',
            extent: 'parent',
        });
    }
    let mdlCount = 0;
    for (const mdl of models) {
        nodes.push({
            id: `n_mdl_${mdlCount++}`,
            type: 'component',
            data: { label: mdl.name, type: 'model' },
            parentNode: 'layer_data',
            extent: 'parent',
        });
    }

    // Add External Nodes
    const seenExt = new Set();
    let extCount = 0;
    for (const ext of externalApis) {
        const name = ext.service || ext.url || 'Unknown';
        if (seenExt.has(name)) continue;
        seenExt.add(name);
        nodes.push({
            id: `n_ext_${extCount++}`,
            type: 'component',
            data: { label: name, type: 'external', details: ext.sdk },
            parentNode: 'layer_external',
            extent: 'parent',
        });
    }

    // Add Utilities
    for (let i = 0; i < utilities.length; i++) {
        nodes.push({
            id: `n_util_${i}`,
            type: 'component',
            data: { label: utilities[i].name, type: 'utility' },
            parentNode: 'layer_shared',
            extent: 'parent',
        });
    }

    // ── 3. High-level Cross-Layer Edges ─────────────────────────────────────
    // If there are API nodes and business nodes, link them.
    // We represent "Layer-to-Layer" flows by linking the groups, but React Flow
    // visually works better if we link a representative node, or the groups.
    // We'll link the groups for the layout engine, and front-end can draw them.

    if (nodes.some(n => n.parentNode === 'layer_api')) {
        edges.push({ id: 'e_client_api', source: 'layer_client', target: 'layer_api', type: 'smoothstep', animated: true });
    }

    if (nodes.some(n => n.parentNode === 'layer_business')) {
        if (nodes.some(n => n.parentNode === 'layer_api')) edges.push({ id: 'e_api_biz', source: 'layer_api', target: 'layer_business', type: 'smoothstep' });
        else edges.push({ id: 'e_client_biz', source: 'layer_client', target: 'layer_business', type: 'smoothstep' });
    }

    if (nodes.some(n => n.parentNode === 'layer_data')) {
        if (nodes.some(n => n.parentNode === 'layer_business')) edges.push({ id: 'e_biz_data', source: 'layer_business', target: 'layer_data', type: 'smoothstep' });
        else if (nodes.some(n => n.parentNode === 'layer_api')) edges.push({ id: 'e_api_data', source: 'layer_api', target: 'layer_data', type: 'smoothstep' });
    }

    if (nodes.some(n => n.parentNode === 'layer_external')) {
        if (nodes.some(n => n.parentNode === 'layer_business')) edges.push({ id: 'e_biz_ext', source: 'layer_business', target: 'layer_external', type: 'smoothstep', data: { dashed: true } });
        else if (nodes.some(n => n.parentNode === 'layer_api')) edges.push({ id: 'e_api_ext', source: 'layer_api', target: 'layer_external', type: 'smoothstep', data: { dashed: true } });
    }

    if (nodes.some(n => n.parentNode === 'layer_shared')) {
        if (nodes.some(n => n.parentNode === 'layer_business')) edges.push({ id: 'e_shared_biz', source: 'layer_shared', target: 'layer_business', type: 'smoothstep', data: { dashed: true } });
    }

    return { nodes, edges };
}
