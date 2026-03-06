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

    // Leverage LLM semantic types to build architectural layers
    const layers = {
        api: [],
        business: [],
        data: [],
        shared: []
    };

    components.forEach(comp => {
        const type = (comp.type || '').toLowerCase();
        if (['controller', 'middleware', 'route', 'endpoint', 'handler'].includes(type)) {
            layers.api.push(comp);
        } else if (['service', 'module', 'package', 'manager', 'core'].includes(type)) {
            layers.business.push(comp);
        } else if (['model', 'repository', 'entity', 'db', 'database', 'schema'].includes(type)) {
            layers.data.push(comp);
        } else {
            layers.shared.push(comp);
        }
    });

    const layerOrder = ['api', 'business', 'data', 'shared'];
    let currentY = 40;

    // Create node cells layer by layer
    layerOrder.forEach((layerKey) => {
        const compsInLayer = layers[layerKey];
        if (!compsInLayer.length) return;

        let currentX = 40;
        let maxHeightInRow = 120; // default card height

        compsInLayer.forEach((comp, i) => {
            const id = `comp_${cells.length}`;
            compIndex.set(comp.name, id);

            // Wrap to next line if row gets too wide (e.g., > 5 items)
            if (i > 0 && i % 5 === 0) {
                currentX = 40;
                currentY += maxHeightInRow + 40;
            }

            const { fill, stroke, titleBg, text } = getDrawioStyle(comp.type);

            // Rich HTML content for the node
            const desc = comp.description ? `<div style="font-size: 11px; color: ${text}; opacity: 0.85; line-height: 1.3; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;">${xmlEscape(comp.description)}</div>` : '';

            const htmlLabel = `
                <div style="box-sizing: border-box; width: 100%; height: 100%; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                    <div style="background-color: ${titleBg}; border-bottom: 1px solid ${stroke}; padding: 8px 12px; font-weight: 600; font-size: 13px; color: ${text}; display: flex; justify-content: space-between; align-items: center; border-radius: 6px 6px 0 0;">
                        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px;" title="${xmlEscape(comp.name)}">${xmlEscape(comp.name)}</span>
                        <span style="font-size: 9px; text-transform: uppercase; background: rgba(0,0,0,0.1); padding: 2px 6px; border-radius: 10px; letter-spacing: 0.5px;">${xmlEscape(comp.type || 'component')}</span>
                    </div>
                    <div style="padding: 12px;">
                        ${desc}
                    </div>
                </div>
            `.replace(/\n/g, '').replace(/\s{2,}/g, ' ');

            const style = `rounded=1;whiteSpace=wrap;html=1;fillColor=${fill};strokeColor=${stroke};shadow=1;arcSize=6;align=left;verticalAlign=top;spacing=0;`;

            cells.push(
                `<mxCell id="${id}" value="${xmlEscape(htmlLabel)}" ` +
                `style="${style}" vertex="1" parent="1">` +
                `<mxGeometry x="${currentX}" y="${currentY}" width="240" height="120" as="geometry"/>` +
                `</mxCell>`
            );

            currentX += 280; // 240 width + 40 gap
        });

        // Add visual gap between semantic layers
        currentY += maxHeightInRow + 100;
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
            `<mxCell id="e${i}" value="uses" style="edgeStyle=orthogonalEdgeStyle;curved=1;rounded=1;jettySize=auto;orthogonalLoop=1;exitX=0.5;exitY=1;exitDx=0;exitDy=0;entryX=0.5;entryY=0;entryDx=0;entryDy=0;endArrow=block;endFill=1;strokeColor=#888888;fontColor=#888888;fontSize=11;labelBackgroundColor=none;" edge="1" source="${src}" target="${tgt}" parent="1">` +
            `<mxGeometry relative="1" as="geometry"/></mxCell>`
        );
    });

    return `<mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" pageScale="1" pageWidth="1169" pageHeight="827" background="#1e1e1e" math="0" shadow="0">` +
        `<root><mxCell id="0"/><mxCell id="1" parent="0"/>` +
        cells.join('') +
        `</root></mxGraphModel>`;
}

/** Generate a Mermaid-containing draw.io XML (for import via text box) */
function buildMxGraphFromMermaid(mermaidCode) {
    const escaped = xmlEscape(mermaidCode);
    return `<mxGraphModel background="#1e1e1e"><root><mxCell id="0"/><mxCell id="1" parent="0"/>` +
        `<mxCell id="2" value="${escaped}" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=4;spacingRight=4;overflow=hidden;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;rotatable=0;fontFamily=Courier New;fontSize=12;" vertex="1" parent="1">` +
        `<mxGeometry x="20" y="20" width="800" height="400" as="geometry"/></mxCell>` +
        `</root></mxGraphModel>`;
}

function getDrawioStyle(type) {
    const styles = {
        controller: { fill: '#1a2942', stroke: '#3b82f6', titleBg: '#1e3a8a', text: '#bfdbfe' },
        service: { fill: '#2e1f3b', stroke: '#a855f7', titleBg: '#4c1d95', text: '#e9d5ff' },
        model: { fill: '#3b2313', stroke: '#f59e0b', titleBg: '#78350f', text: '#fde68a' },
        utility: { fill: '#143022', stroke: '#22c55e', titleBg: '#14532d', text: '#bbf7d0' },
        middleware: { fill: '#3d1a1b', stroke: '#ef4444', titleBg: '#7f1d1d', text: '#fecaca' },
        config: { fill: '#262626', stroke: '#525252', titleBg: '#171717', text: '#d4d4d4' },
        library: { fill: '#262626', stroke: '#737373', titleBg: '#262626', text: '#e5e5e5' },
        module: { fill: '#1e293b', stroke: '#3b82f6', titleBg: '#0f172a', text: '#cbd5e1' },
    };
    return styles[type] || { fill: '#262626', stroke: '#525252', titleBg: '#171717', text: '#e5e5e5' };
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
