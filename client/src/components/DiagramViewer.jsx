import { useEffect, useRef, useState, useCallback } from 'react';
import mermaid from 'mermaid';
import ReactFlowDiagram from './ReactFlowDiagram';
import DrawioViewer from './DrawioViewer';

const TABS = [
    { key: 'component', label: '📦 Components', isReactFlow: true },
    { key: 'class', label: '🏛️ Classes' },
    { key: 'database', label: '🗄️ Database' },
    { key: 'endpoints', label: '🌐 Endpoints' },
    { key: 'externalApis', label: '🔌 External APIs' },
    { key: 'flows', label: '🔄 Flows' },
    { key: 'architecture', label: '🏗️ Architecture' },
    { key: 'drawio', label: '✏️ draw.io', isDrawio: true },
];

mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    themeVariables: {
        darkMode: true,
        background: '#12162a',
        primaryColor: '#3d7bd9',
        primaryTextColor: '#e8ecf5',
        primaryBorderColor: '#4a90e2',
        lineColor: '#6270a0',
        secondaryColor: '#1e2440',
        tertiaryColor: '#252c4a',
        edgeLabelBackground: '#1a1f35',
        clusterBkg: '#1a1f35',
        clusterBorder: '#3d4f7c',
        titleColor: '#e8ecf5',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '14px',
    },
    flowchart: { curve: 'basis', padding: 20, useMaxWidth: true },
    sequence: { showSequenceNumbers: true, useMaxWidth: true },
    er: { useMaxWidth: true },
    class: { useMaxWidth: true },
});

function stripFences(code) {
    if (!code) return '';
    return code
        .replace(/^```mermaid\s*\n?/i, '')
        .replace(/\n?```\s*$/i, '')
        .trim();
}

function splitFlows(rawCode) {
    if (!rawCode) return [];
    const blocks = rawCode.split(/(?=sequenceDiagram)/gi).filter(Boolean);
    return blocks.map((block, i) => {
        const match = block.match(/Note over \w+:\s*(.+)/i);
        return { name: match ? match[1].trim() : `Flow ${i + 1}`, code: block.trim() };
    });
}

export default function DiagramViewer({ diagrams, rawModel, importGraph }) {
    const [activeTab, setActiveTab] = useState('component');
    const [showSource, setShowSource] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [copyToast, setCopyToast] = useState(false);
    const [renderError, setRenderError] = useState(null);
    const [isRendering, setIsRendering] = useState(false);
    const [activeFlow, setActiveFlow] = useState(0);
    const containerRef = useRef(null);
    const svgRef = useRef(null);

    const isReactFlowTab = TABS.find((t) => t.key === activeTab)?.isReactFlow;
    const isDrawioTab = TABS.find((t) => t.key === activeTab)?.isDrawio;

    const rawCode = diagrams?.[activeTab] ? stripFences(diagrams[activeTab]) : '';

    const isFlowTab = activeTab === 'flows';
    const flows = isFlowTab ? splitFlows(rawCode) : [];
    const activeCode = isFlowTab && flows.length > 0 ? flows[activeFlow]?.code : rawCode;

    const renderDiagram = useCallback(async () => {
        if (isReactFlowTab || isDrawioTab || showSource || !activeCode || !containerRef.current) return;
        setIsRendering(true);
        setRenderError(null);

        const container = containerRef.current;
        container.innerHTML = '';

        const id = `mermaid-${activeTab}-${activeFlow}-${Date.now()}`;
        try {
            const { svg } = await mermaid.render(id, activeCode);
            svgRef.current = svg;
            container.innerHTML = svg;
            const svgEl = container.querySelector('svg');
            if (svgEl) {
                svgEl.style.maxWidth = '100%';
                svgEl.style.height = 'auto';
                svgEl.removeAttribute('width');
            }
        } catch (err) {
            console.warn('Mermaid render failed:', err);
            setRenderError(err.message);
            svgRef.current = null;
        } finally {
            setIsRendering(false);
        }
    }, [activeTab, activeCode, showSource, activeFlow, isReactFlowTab]);

    useEffect(() => {
        renderDiagram();
    }, [renderDiagram]);

    useEffect(() => {
        setZoom(1);
        setActiveFlow(0);
        setShowSource(false);
        setRenderError(null);
    }, [activeTab]);

    const handleCopySource = async () => {
        const text = isReactFlowTab
            ? JSON.stringify(rawModel?.components || [], null, 2)
            : activeCode;
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        setCopyToast(true);
        setTimeout(() => setCopyToast(false), 2000);
    };

    const handleDownloadSVG = () => {
        const svg = svgRef.current || containerRef.current?.innerHTML;
        if (!svg || !svg.includes('<svg')) return;
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `codelens-${activeTab}.svg`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
    const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.25));
    const handleZoomReset = () => setZoom(1);

    const hasData = !!activeCode || (isReactFlowTab && rawModel?.components?.length > 0);
    const components = rawModel?.components || [];

    return (
        <div className={`diagram-viewer-root ${isFullscreen ? 'diagram-fullscreen' : ''}`}>
            {/* Diagram type tabs */}
            <div className="diagram-tabs">
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        className={`diagram-tab ${activeTab === tab.key ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="diagram-panel">
                {/* Toolbar */}
                <div className="diagram-toolbar">
                    <div className="toolbar-group">
                        {!isReactFlowTab && !isDrawioTab && (
                            <>
                                <button className={`diagram-toggle-btn ${!showSource ? 'active' : ''}`} onClick={() => setShowSource(false)}>
                                    🖼️ Diagram
                                </button>
                                <button className={`diagram-toggle-btn ${showSource ? 'active' : ''}`} onClick={() => setShowSource(true)}>
                                    &lt;/&gt; Source
                                </button>
                            </>
                        )}
                        {isReactFlowTab && (
                            <span className="rf-badge">⚡ Interactive · ReactFlow</span>
                        )}
                        {isDrawioTab && (
                            <span className="rf-badge" style={{ borderColor: 'rgba(247,165,27,0.4)', background: 'rgba(247,165,27,0.08)', color: '#f7a51b' }}>✏️ draw.io · Interactive Editor</span>
                        )}
                    </div>

                    {isFlowTab && flows.length > 1 && !showSource && (
                        <div className="toolbar-group">
                            <label className="toolbar-label">Flow:</label>
                            <select className="flow-selector" value={activeFlow} onChange={(e) => setActiveFlow(Number(e.target.value))}>
                                {flows.map((f, i) => <option key={i} value={i}>{f.name}</option>)}
                            </select>
                        </div>
                    )}

                    <div className="toolbar-spacer" />

                    {!showSource && !isReactFlowTab && !isDrawioTab && hasData && (
                        <div className="toolbar-group">
                            <button className="toolbar-icon-btn" onClick={handleZoomOut} disabled={zoom <= 0.25}>−</button>
                            <span className="zoom-label">{Math.round(zoom * 100)}%</span>
                            <button className="toolbar-icon-btn" onClick={handleZoomIn} disabled={zoom >= 3}>+</button>
                            <button className="toolbar-icon-btn" onClick={handleZoomReset} disabled={zoom === 1}>⊙</button>
                        </div>
                    )}

                    <div className="toolbar-group">
                        {hasData && !isDrawioTab && (
                            <button className={`toolbar-icon-btn ${copyToast ? 'copied' : ''}`} onClick={handleCopySource}>
                                {copyToast ? '✓ Copied' : '⎘ Copy'}
                            </button>
                        )}
                        {!showSource && !isReactFlowTab && !isDrawioTab && hasData && svgRef.current && (
                            <button className="toolbar-icon-btn" onClick={handleDownloadSVG}>↓ SVG</button>
                        )}
                        <button className={`toolbar-icon-btn ${isFullscreen ? 'active' : ''}`} onClick={() => setIsFullscreen((f) => !f)}>
                            {isFullscreen ? '⛶ Exit' : '⛶'}
                        </button>
                    </div>
                </div>

                {/* draw.io embedded editor */}
                {isDrawioTab && (
                    <DrawioViewer
                        components={components}
                        importGraph={importGraph}
                        mermaidCode={Object.values(diagrams || {}).filter(Boolean).join('\n\n')}
                        diagramTitle="CodeLens Architecture"
                    />
                )}

                {/* ReactFlow component diagram */}
                {isReactFlowTab && (
                    <ReactFlowDiagram components={components} importGraph={importGraph} />
                )}

                {/* Mermaid source view */}
                {!isReactFlowTab && showSource && (
                    <pre className="diagram-source-code">{activeCode || 'No data available.'}</pre>
                )}

                {/* Mermaid rendered view */}
                {!isReactFlowTab && !showSource && (
                    <div className="diagram-canvas-wrap">
                        {isRendering && (
                            <div className="diagram-loading">
                                <span className="diagram-spinner" />
                                <span>Rendering…</span>
                            </div>
                        )}
                        {renderError && !isRendering && (
                            <div className="diagram-error-notice">
                                <div className="diagram-error-title">⚠ Render failed</div>
                                <div className="diagram-error-msg">{renderError}</div>
                                <div className="diagram-error-hint">Switch to Source view to inspect the raw Mermaid code.</div>
                            </div>
                        )}
                        {!hasData && !isRendering && (
                            <div className="diagram-empty">No data detected for this diagram type.</div>
                        )}
                        <div
                            className="mermaid-container"
                            ref={containerRef}
                            style={{
                                transform: `scale(${zoom})`,
                                transformOrigin: 'top left',
                                visibility: isRendering || renderError ? 'hidden' : 'visible',
                            }}
                        />
                    </div>
                )}
            </div>

            {copyToast && <div className="copy-toast">✓ Copied to clipboard</div>}
        </div>
    );
}
