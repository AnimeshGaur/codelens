/**
 * DrawioViewer — Embeds the official diagrams.net editor/viewer.
 *
 * Uses the diagrams.net embed API (postMessage protocol):
 * https://www.diagrams.net/doc/faq/embed-mode
 *
 * Flow:
 *   1. Render hidden iframe → embed.diagrams.net
 *   2. iframe sends "init" message → we send "load" with our XML
 *   3. User edits freely
 *   4. "export" message → "getLocalData" → receive PNG/SVG/XML
 */

import { useEffect, useRef, useState, useCallback } from 'react';

/** Convert CodeLens component + import-graph data into mxGraph XML */
function buildMxGraphXml(components = [], edges = []) {
    const cells = [];
    const compIndex = new Map(); // name → id

    // Create node cells
    components.forEach((comp, i) => {
        const id = `comp_${i}`;
        compIndex.set(comp.name, id);

        const x = (i % 4) * 200 + 40;
        const y = Math.floor(i / 4) * 140 + 40;

        const style = getDrawioStyle(comp.type);
        cells.push(
            `<mxCell id="${id}" value="${xmlEscape(comp.name)}\n[${comp.type || 'component'}]" ` +
            `style="${style}" vertex="1" parent="1">` +
            `<mxGeometry x="${x}" y="${y}" width="160" height="60" as="geometry"/>` +
            `</mxCell>`
        );
    });

    // Create edge cells from import graph or LLM deps
    const seen = new Set();
    const allEdges = [...edges];

    // Add LLM-inferred deps as fallback
    for (const comp of components) {
        const deps = comp.staticDependencies?.length ? comp.staticDependencies : comp.dependencies || [];
        for (const dep of deps) {
            if (compIndex.has(dep)) {
                allEdges.push({ from: comp.name, to: dep, isRelative: false });
            }
        }
    }

    allEdges.forEach((edge, i) => {
        const src = compIndex.get(edge.from);
        const tgt = compIndex.get(edge.to);
        if (!src || !tgt || src === tgt) return;
        const key = `${src}→${tgt}`;
        if (seen.has(key)) return;
        seen.add(key);

        cells.push(
            `<mxCell id="e${i}" value="uses" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;endArrow=block;endFill=1;strokeColor=#6d8ebf;fontColor=#aab4cc;fontSize=10;" edge="1" source="${src}" target="${tgt}" parent="1">` +
            `<mxGeometry relative="1" as="geometry"/></mxCell>`
        );
    });

    return `<mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" pageScale="1" pageWidth="1169" pageHeight="827" math="0" shadow="0">` +
        `<root><mxCell id="0"/><mxCell id="1" parent="0"/>` +
        cells.join('') +
        `</root></mxGraphModel>`;
}

/** Generate a Mermaid-containing draw.io XML (for import via text box) */
function buildMxGraphFromMermaid(mermaidCode) {
    const escaped = xmlEscape(mermaidCode);
    return `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>` +
        `<mxCell id="2" value="${escaped}" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=4;spacingRight=4;overflow=hidden;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;rotatable=0;fontFamily=Courier New;fontSize=12;" vertex="1" parent="1">` +
        `<mxGeometry x="20" y="20" width="800" height="400" as="geometry"/></mxCell>` +
        `</root></mxGraphModel>`;
}

function getDrawioStyle(type) {
    const styles = {
        controller: 'rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontStyle=1;fontSize=12;',
        service: 'rounded=1;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;fontStyle=1;fontSize=12;',
        model: 'rounded=1;whiteSpace=wrap;html=1;fillColor=#ffe6cc;strokeColor=#d6b656;fontStyle=1;fontSize=12;',
        utility: 'rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;fontStyle=1;fontSize=12;',
        middleware: 'rounded=1;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;fontStyle=1;fontSize=12;',
        config: 'rounded=1;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#666666;fontColor=#333333;fontStyle=1;fontSize=12;',
        library: 'rounded=1;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#999999;fontColor=#555555;fontStyle=1;fontSize=12;',
        module: 'rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontStyle=1;fontSize=12;',
    };
    return styles[type] || 'rounded=1;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#666666;fontStyle=1;fontSize=12;';
}

function xmlEscape(str) {
    return (str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ─── Component ────────────────────────────────────────────────────────────────

const DRAWIO_EMBED_URL = 'https://embed.diagrams.net/?embed=1&ui=dark&spin=1&modified=unsavedChanges&proto=json&libraries=1&noSaveBtn=0&noExitBtn=0';

export default function DrawioViewer({ components = [], importGraph, mermaidCode, diagramTitle = 'CodeLens Diagram' }) {
    const iframeRef = useRef(null);
    const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
    const [exportData, setExportData] = useState(null);
    const xmlDataRef = useRef(null);

    // Build the XML once
    const graphXml = useCallback(() => {
        if (components.length > 0) {
            const edges = importGraph?.edges?.filter(
                (e) => components.some((c) => c.name.toLowerCase().includes((e.from.split('/').pop().split('.')[0] || '').toLowerCase()))
            ) || [];
            return buildMxGraphXml(components, edges);
        }
        if (mermaidCode) {
            return buildMxGraphFromMermaid(mermaidCode);
        }
        return buildMxGraphXml([], []);
    }, [components, importGraph, mermaidCode]);

    // Handle postMessages from draw.io iframe
    const handleMessage = useCallback((event) => {
        if (!event.data || typeof event.data !== 'string') return;

        let msg;
        try {
            msg = JSON.parse(event.data);
        } catch {
            return;
        }

        const iframe = iframeRef.current;
        if (!iframe) return;

        const send = (data) => {
            iframe.contentWindow?.postMessage(JSON.stringify(data), '*');
        };

        switch (msg.event) {
            case 'init': {
                // draw.io is ready — send our XML
                const xml = graphXml();
                xmlDataRef.current = xml;
                send({ action: 'load', xml, title: diagramTitle });
                setStatus('ready');
                break;
            }
            case 'load': {
                setStatus('ready');
                break;
            }
            case 'export': {
                // Receive exported data (XML, PNG, SVG)
                setExportData({ format: msg.format, data: msg.data });
                break;
            }
            case 'save': {
                // User clicked Save — receive updated XML
                xmlDataRef.current = msg.xml;
                send({ action: 'status', modified: false });
                break;
            }
            case 'exit': {
                // No-op — we never close the iframe
                break;
            }
            default:
                break;
        }
    }, [graphXml, diagramTitle]);

    useEffect(() => {
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [handleMessage]);

    const handleExportXml = () => {
        if (!iframeRef.current) return;
        iframeRef.current.contentWindow?.postMessage(
            JSON.stringify({ action: 'export', format: 'xml', xml: '' }),
            '*'
        );
    };

    const handleExportPng = () => {
        if (!iframeRef.current) return;
        iframeRef.current.contentWindow?.postMessage(
            JSON.stringify({ action: 'export', format: 'png', xml: '' }),
            '*'
        );
    };

    const handleDownloadExport = () => {
        if (!exportData) return;
        if (exportData.format === 'xml') {
            const blob = new Blob([exportData.data], { type: 'text/xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${diagramTitle.replace(/\s+/g, '-').toLowerCase()}.drawio`;
            a.click();
            URL.revokeObjectURL(url);
        } else if (exportData.format === 'png') {
            const a = document.createElement('a');
            a.href = exportData.data; // base64 data URL
            a.download = `${diagramTitle.replace(/\s+/g, '-').toLowerCase()}.png`;
            a.click();
        }
        setExportData(null);
    };

    const handleOpenDrawio = () => {
        // Open in a new tab with the XML pre-loaded
        const xml = xmlDataRef.current || graphXml();
        const encoded = encodeURIComponent(xml);
        window.open(`https://app.diagrams.net/?title=${encodeURIComponent(diagramTitle)}&xml=${encoded}`, '_blank');
    };

    return (
        <div className="drawio-wrapper">
            {/* Toolbar above iframe */}
            <div className="drawio-toolbar">
                <div className="drawio-status">
                    {status === 'loading' && <><span className="diagram-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Loading draw.io editor…</>}
                    {status === 'ready' && <><span className="drawio-dot" />draw.io editor ready</>}
                    {status === 'error' && <span style={{ color: 'var(--error)' }}>⚠ Failed to load draw.io</span>}
                </div>
                <div className="toolbar-spacer" />
                <div className="toolbar-group">
                    <button className="toolbar-icon-btn" onClick={handleExportXml} title="Export .drawio XML">⬇ .drawio</button>
                    <button className="toolbar-icon-btn" onClick={handleExportPng} title="Export PNG">⬇ PNG</button>
                    <button className="toolbar-icon-btn" onClick={handleOpenDrawio} title="Open full screen in diagrams.net tab">↗ Open in diagrams.net</button>
                </div>
            </div>

            {/* Export download button (appears after export is ready) */}
            {exportData && (
                <div className="drawio-export-ready" onClick={handleDownloadExport}>
                    ✓ Export ready — click to download {exportData.format.toUpperCase()}
                </div>
            )}

            {/* The draw.io iframe */}
            <iframe
                ref={iframeRef}
                src={DRAWIO_EMBED_URL}
                className="drawio-iframe"
                title="draw.io diagram editor"
                frameBorder="0"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-downloads allow-storage-access-by-user-activation"
            />
        </div>
    );
}
