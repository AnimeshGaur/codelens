import React, { useMemo, useEffect, useState, useCallback } from 'react';
import {
    ReactFlow,
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    Handle,
    Position,
    MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';

// ── Custom Nodes ────────────────────────────────────────────────────────────

const LayerNode = ({ data }) => {
    return (
        <div style={{
            padding: '10px',
            borderRadius: '8px',
            background: 'rgba(30, 41, 59, 0.4)',
            border: '1px dashed #475569',
            width: '100%',
            height: '100%',
            minWidth: '800px',
            minHeight: '200px',
            color: '#94a3b8',
            fontSize: '14px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '1px',
        }}>
            <div style={{ marginBottom: '10px' }}>{data.label}</div>
            <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
            <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
        </div>
    );
};

const ComponentNode = ({ data }) => {
    let bg = '#1e293b';
    let border = '#334155';
    let color = '#e2e8f0';

    if (data.type === 'endpoint') { bg = '#0f172a'; border = '#3b82f6'; color = '#60a5fa'; }
    if (data.type === 'controller') { bg = '#1e3a8a'; border = '#2563eb'; color = '#bfdbfe'; }
    if (data.type === 'service') { bg = '#312e81'; border = '#4f46e5'; color = '#c7d2fe'; }
    if (data.type === 'database') { bg = '#7c2d12'; border = '#ea580c'; color = '#fed7aa'; }
    if (data.type === 'model') { bg = '#451a03'; border = '#b45309'; color = '#fcd34d'; }
    if (data.type === 'external') { bg = '#064e3b'; border = '#059669'; color = '#a7f3d0'; }
    if (data.type === 'client') { bg = '#042f2e'; border = '#0d9488'; color = '#99f6e4'; }

    return (
        <div style={{
            padding: '12px 20px',
            borderRadius: '6px',
            background: bg,
            border: `1px solid ${border}`,
            color: color,
            minWidth: '150px',
            textAlign: 'center',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            fontFamily: 'monospace',
            fontSize: '13px',
        }}>
            <Handle type="target" position={Position.Top} style={{ background: border }} />
            <div style={{ fontWeight: 'bold', wordBreak: 'break-word' }}>{data.label}</div>
            {data.details && (
                <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '4px' }}>{data.details}</div>
            )}
            <Handle type="source" position={Position.Bottom} style={{ background: border }} />
        </div>
    );
};

const nodeTypes = {
    layer: LayerNode,
    component: ComponentNode,
};

// ── Layout Algorithm ────────────────────────────────────────────────────────

const getLayoutedElements = (nodes, edges, direction = 'TB') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: direction, nodesep: 50, ranksep: 100 });

    // Add layer nodes to dagre
    const layerNodes = nodes.filter(n => n.type === 'layer');
    layerNodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: 800, height: 250 });
    });

    // Add edges to dagre
    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    // Position layers
    const layoutedNodes = nodes.map((node) => {
        if (node.type === 'layer') {
            const nodeWithPosition = dagreGraph.node(node.id);
            return {
                ...node,
                position: {
                    x: nodeWithPosition.x - 400, // half of 800 width
                    y: nodeWithPosition.y - 125, // half of 250 height
                },
                style: { width: 800, height: 250 },
            };
        }
        return node;
    });

    // Position children inside layers manually (flex-like row wrapping)
    const childrenMap = {};
    layoutedNodes.filter(n => n.parentNode).forEach(child => {
        if (!childrenMap[child.parentNode]) childrenMap[child.parentNode] = [];
        childrenMap[child.parentNode].push(child);
    });

    const finalNodes = layoutedNodes.map(node => {
        if (node.parentNode) {
            const siblings = childrenMap[node.parentNode];
            const index = siblings.findIndex(n => n.id === node.id);

            const cols = 4;
            const row = Math.floor(index / cols);
            const col = index % cols;

            const width = 160;
            const height = 60;
            const paddingX = 20;
            const paddingY = 40;

            return {
                ...node,
                position: {
                    x: paddingX + col * (width + paddingX),
                    y: paddingY + row * (height + paddingY),
                },
            };
        }
        return node;
    });

    return { nodes: finalNodes, edges };
};

// ── Main Component ──────────────────────────────────────────────────────────

export default function ArchitectureFlow({ rawModel }) {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [hoveredNode, setHoveredNode] = useState(null);

    useEffect(() => {
        if (rawModel?.architectureFlow) {
            const { nodes: initialNodes, edges: initialEdges } = rawModel.architectureFlow;

            // Style edges for "Ghost Edge" effect
            const styledEdges = initialEdges.map(e => ({
                ...e,
                markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: '#475569' },
                style: { stroke: '#475569', strokeWidth: 2, ...e.style },
            }));

            const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
                initialNodes,
                styledEdges
            );

            setNodes(layoutedNodes);
            setEdges(layoutedEdges);
        }
    }, [rawModel, setNodes, setEdges]);

    // Ghost Edge effect
    const onNodeMouseEnter = useCallback((_, node) => setHoveredNode(node.id), []);
    const onNodeMouseLeave = useCallback(() => setHoveredNode(null), []);

    const ghostEdges = useMemo(() => {
        if (!hoveredNode) return edges;
        return edges.map(e => {
            // Find if this edge connects to the hovered layer
            const isConnected = e.source === hoveredNode || e.target === hoveredNode;
            return {
                ...e,
                style: {
                    ...e.style,
                    stroke: isConnected ? '#38bdf8' : '#334155',
                    opacity: isConnected ? 1 : 0.2,
                    strokeWidth: isConnected ? 3 : 1
                },
                animated: isConnected ? true : e.animated
            };
        });
    }, [edges, hoveredNode]);

    if (!rawModel?.architectureFlow) {
        return (
            <div style={{ padding: 20, color: '#94a3b8' }}>
                No architecture flow data available for this codebase.
            </div>
        );
    }

    return (
        <div style={{ width: '100%', height: '100%', minHeight: '800px', background: '#0b1120' }}>
            <ReactFlow
                nodes={nodes}
                edges={ghostEdges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeMouseEnter={onNodeMouseEnter}
                onNodeMouseLeave={onNodeMouseLeave}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.1}
            >
                <Background color="#1e293b" gap={16} size={1} />
                <Controls style={{ fill: '#e2e8f0', background: '#1e293b', border: '1px solid #334155' }} />
                <MiniMap
                    nodeColor={n => {
                        if (n.type === 'layer') return '#1e293b';
                        return '#38bdf8';
                    }}
                    maskColor="rgba(11, 17, 32, 0.7)"
                    style={{ background: '#0f172a' }}
                />
            </ReactFlow>
        </div>
    );
}
