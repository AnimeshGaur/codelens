/**
 * ReactFlowDiagram — interactive, draggable, zoomable component dependency graph.
 *
 * Data sources (in priority order):
 *   1. importGraph.edges  — static, 100% accurate file-level imports
 *   2. component.staticDependencies — enriched by import-graph at analysis time
 *   3. component.dependencies — LLM-inferred (fallback)
 */

import { useCallback, useMemo, useState } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    MarkerType,
    useNodesState,
    useEdgesState,
    Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// ─── Type → visual style ───────────────────────────────────────────────────────

const TYPE_STYLE = {
    controller: { bg: '#1d4673', border: '#4A90D9', label: '#93c5fd' },
    service: { bg: '#2d1f6a', border: '#7C3AED', label: '#c4b5fd' },
    model: { bg: '#5a2a00', border: '#E67E22', label: '#fdba74' },
    utility: { bg: '#14401f', border: '#27AE60', label: '#86efac' },
    middleware: { bg: '#3b1364', border: '#9B59B6', label: '#d8b4fe' },
    config: { bg: '#1f2937', border: '#6B7280', label: '#d1d5db' },
    library: { bg: '#111827', border: '#374151', label: '#9ca3af' },
    module: { bg: '#0c2a4a', border: '#3B82F6', label: '#93c5fd' },
    package: { bg: '#064e3b', border: '#10B981', label: '#6ee7b7' },
    default: { bg: '#1e2440', border: '#4a5568', label: '#a0aec0' },
};

// ─── Custom Node ──────────────────────────────────────────────────────────────

function ComponentNode({ data, selected }) {
    const style = TYPE_STYLE[data.type] || TYPE_STYLE.default;
    return (
        <div
            className="rf-node"
            style={{
                background: style.bg,
                border: `2px solid ${selected ? '#fff' : style.border}`,
                borderRadius: 10,
                padding: '10px 16px',
                minWidth: 140,
                maxWidth: 220,
                cursor: 'pointer',
                boxShadow: selected ? `0 0 0 3px ${style.border}55, 0 4px 20px rgba(0,0,0,0.5)` : '0 2px 8px rgba(0,0,0,0.4)',
                transition: 'box-shadow 0.15s',
            }}
        >
            <div style={{ fontSize: 11, color: style.border, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                {data.type || 'component'}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: style.label, wordBreak: 'break-word' }}>
                {data.label}
            </div>
            {data.file && (
                <div style={{ fontSize: 10, color: '#6b7280', marginTop: 6, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {data.file}
                </div>
            )}
            {data.importsCount > 0 && (
                <div style={{ fontSize: 10, color: '#4b5563', marginTop: 2 }}>
                    imports: {data.importsCount}
                </div>
            )}
        </div>
    );
}

const NODE_TYPES = { component: ComponentNode };

// ─── Layout helper ────────────────────────────────────────────────────────────

/**
 * Simple layered layout: compute x,y by grouping into columns based on in-degree.
 */
function computeLayout(components, edgeList) {
    const inDegree = new Map(components.map((c) => [c.name, 0]));
    for (const e of edgeList) {
        inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
    }

    // Sort by in-degree ascending (roots first)
    const sorted = [...components].sort((a, b) => (inDegree.get(a.name) || 0) - (inDegree.get(b.name) || 0));

    const cols = Math.ceil(Math.sqrt(sorted.length));
    const CELL_W = 260, CELL_H = 140;

    return new Map(
        sorted.map((c, i) => [
            c.name,
            {
                x: (i % cols) * CELL_W + (Math.floor(i / cols) % 2 === 0 ? 0 : 20),
                y: Math.floor(i / cols) * CELL_H,
            },
        ])
    );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({ node, onClose }) {
    if (!node) return null;
    const { label, type, file, dependencies, staticDependencies, usedBy, importsCount } = node.data;
    const deps = staticDependencies?.length ? staticDependencies : dependencies || [];
    return (
        <div className="rf-detail-panel">
            <div className="rf-detail-header">
                <span className="rf-detail-title">{label}</span>
                <button className="rf-detail-close" onClick={onClose}>✕</button>
            </div>
            {type && <div className="rf-detail-badge">{type}</div>}
            {file && <div className="rf-detail-file">{file}</div>}
            {deps.length > 0 && (
                <div className="rf-detail-section">
                    <div className="rf-detail-section-title">Depends on ({deps.length})</div>
                    {deps.map((d) => <div key={d} className="rf-detail-item">→ {d}</div>)}
                </div>
            )}
            {usedBy?.length > 0 && (
                <div className="rf-detail-section">
                    <div className="rf-detail-section-title">Used by ({usedBy.length})</div>
                    {usedBy.map((d) => <div key={d} className="rf-detail-item">← {d}</div>)}
                </div>
            )}
            {importsCount > 0 && (
                <div className="rf-detail-section">
                    <div className="rf-detail-section-title">Static imports: {importsCount}</div>
                </div>
            )}
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReactFlowDiagram({ components = [], importGraph }) {
    const [selectedNode, setSelectedNode] = useState(null);

    // Build edge source: prefer staticDependencies (from import graph) over LLM deps
    const rawEdges = useMemo(() => {
        const compNames = new Set(components.map((c) => c.name));
        const edges = [];
        const seen = new Set();

        for (const comp of components) {
            const deps = comp.staticDependencies?.length ? comp.staticDependencies : comp.dependencies || [];
            for (const dep of deps) {
                if (!compNames.has(dep)) continue;
                const key = `${comp.name}→${dep}`;
                if (seen.has(key)) continue;
                seen.add(key);
                edges.push({ source: comp.name, target: dep });
            }
        }
        return edges;
    }, [components]);

    const layout = useMemo(() => computeLayout(components, rawEdges), [components, rawEdges]);

    const initialNodes = useMemo(() =>
        components.map((comp) => {
            const pos = layout.get(comp.name) || { x: 0, y: 0 };
            const importsCount = importGraph?.edges?.filter((e) =>
                e.from.toLowerCase().includes(comp.name.toLowerCase()) ||
                comp.name.toLowerCase().includes(e.from.split('/').pop().split('.')[0]?.toLowerCase())
            ).length || 0;

            return {
                id: comp.name,
                type: 'component',
                position: pos,
                data: {
                    label: comp.name,
                    type: comp.type,
                    file: comp.file || comp.path,
                    dependencies: comp.dependencies,
                    staticDependencies: comp.staticDependencies,
                    usedBy: comp.staticUsedBy,
                    importsCount,
                },
            };
        }),
        [components, layout, importGraph]
    );

    const initialEdges = useMemo(() =>
        rawEdges.map(({ source, target }, i) => ({
            id: `e-${i}-${source}-${target}`,
            source,
            target,
            animated: false,
            markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: '#4a5568' },
            style: { stroke: '#4a5568', strokeWidth: 1.5 },
            label: 'uses',
            labelStyle: { fill: '#6b7280', fontSize: 10 },
            labelBgStyle: { fill: '#1e2440', fillOpacity: 0.9 },
        })),
        [rawEdges]
    );

    const [nodes, , onNodesChange] = useNodesState(initialNodes);
    const [edges, , onEdgesChange] = useEdgesState(initialEdges);

    const onNodeClick = useCallback((_, node) => setSelectedNode(node), []);
    const onPaneClick = useCallback(() => setSelectedNode(null), []);

    if (components.length === 0) {
        return (
            <div className="rf-empty">
                <div className="rf-empty-text">No components detected in this repository.</div>
            </div>
        );
    }

    const edgeSource = components.some((c) => c.staticDependencies?.length > 0) ? 'static (100% accurate)' : 'LLM-inferred';

    return (
        <div className="rf-wrapper">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={NODE_TYPES}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                fitView
                fitViewOptions={{ padding: 0.3 }}
                minZoom={0.1}
                maxZoom={3}
                colorMode="dark"
            >
                <Background color="#2a2f4a" gap={20} size={1} />
                <Controls style={{ bottom: 60 }} />
                <MiniMap
                    nodeColor={(n) => (TYPE_STYLE[n.data?.type] || TYPE_STYLE.default).border}
                    maskColor="rgba(10,12,24,0.85)"
                    style={{ background: '#0d1117', border: '1px solid #2a2f4a' }}
                />
                <Panel position="top-right" style={{ fontSize: 11, color: '#4b5563' }}>
                    {components.length} components · {edges.length} edges · {edgeSource}
                </Panel>
            </ReactFlow>

            <DetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
        </div>
    );
}
