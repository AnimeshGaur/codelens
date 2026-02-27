import { useState, useRef, useEffect } from 'react';
import mermaid from 'mermaid';

export default function CrossRepoMap({ sessionId }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const diagramRef = useRef(null);

    const load = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/cross-repo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId }),
            });
            const result = await res.json();
            if (result.error) throw new Error(result.error);
            setData(result);
        } catch (err) {
            setData({ error: err.message });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!data?.diagram || !diagramRef.current) return;
        const id = `cross-repo-${Date.now()}`;
        mermaid.render(id, data.diagram).then(({ svg }) => {
            diagramRef.current.innerHTML = svg;
        }).catch(() => {
            diagramRef.current.innerHTML = `<pre style="color: var(--text-secondary)">${data.diagram}</pre>`;
        });
    }, [data]);

    return (
        <div className="feature-panel">
            <h3>🔗 Cross-Repo Microservices Map</h3>
            <p className="feature-desc">Discover connections between multiple repositories: shared APIs, DB models, and dependencies.</p>

            {!data && (
                <button className="btn-analyze" onClick={load} disabled={loading} style={{ margin: '20px 0' }}>
                    {loading ? <><span className="progress-spinner" /> Analyzing...</> : '🔗 Generate Map'}
                </button>
            )}

            {data && !data.error && (
                <>
                    <p style={{ color: 'var(--text-secondary)', margin: '16px 0' }}>{data.summary}</p>

                    {data.diagram && (
                        <div className="diagram-panel" style={{ marginBottom: 24 }}>
                            <div className="mermaid-container" ref={diagramRef} />
                        </div>
                    )}

                    {data.connections?.length > 0 && (
                        <div style={{ marginBottom: 20 }}>
                            <h4>Connections</h4>
                            <table className="cross-repo-table">
                                <thead><tr><th>From</th><th>To</th><th>Type</th><th>Detail</th></tr></thead>
                                <tbody>
                                    {data.connections.map((c, i) => (
                                        <tr key={i}><td>{c.from}</td><td>{c.to}</td><td>{c.type}</td><td>{c.detail}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {data.sharedDependencies?.length > 0 && (
                        <div>
                            <h4>Shared Dependencies</h4>
                            {data.sharedDependencies.map((sd, i) => (
                                <div key={i} className="impact-item" style={{ borderLeft: '3px solid #9B59B6' }}>
                                    <strong>{sd.dependency}</strong>
                                    <p>Used by: {sd.usedBy?.join(', ')}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {data?.error && <div className="error-box">✗ {data.error}</div>}
        </div>
    );
}
