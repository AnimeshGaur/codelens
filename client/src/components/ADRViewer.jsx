import { useState } from 'react';

export default function ADRViewer({ sessionId, provider }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [expandedId, setExpandedId] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/adrs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, provider }),
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

    return (
        <div className="feature-panel">
            <h3>📝 Architecture Decision Records</h3>
            <p className="feature-desc">Auto-generated ADRs reverse-engineered from code patterns and architecture.</p>

            {!data && (
                <button className="btn-analyze" onClick={load} disabled={loading} style={{ margin: '20px 0' }}>
                    {loading ? <><span className="progress-spinner" /> Generating...</> : '📝 Generate ADRs'}
                </button>
            )}

            {data && !data.error && (
                <div className="adr-list">
                    {(data.adrs || []).map((adr) => (
                        <div key={adr.id} className="adr-card">
                            <div className="adr-header" onClick={() => setExpandedId(expandedId === adr.id ? null : adr.id)}>
                                <div>
                                    <span className="adr-id">{adr.id}</span>
                                    <strong className="adr-title">{adr.title}</strong>
                                </div>
                                <span className="adr-status">{adr.status}</span>
                            </div>

                            {expandedId === adr.id && (
                                <div className="adr-body">
                                    <div className="adr-section">
                                        <h5>Context</h5>
                                        <p>{adr.context}</p>
                                    </div>
                                    <div className="adr-section">
                                        <h5>Decision</h5>
                                        <p>{adr.decision}</p>
                                    </div>
                                    {adr.consequences?.length > 0 && (
                                        <div className="adr-section">
                                            <h5>Consequences</h5>
                                            <ul>{adr.consequences.map((c, i) => <li key={i}>{c}</li>)}</ul>
                                        </div>
                                    )}
                                    {adr.evidence?.length > 0 && (
                                        <div className="adr-section">
                                            <h5>Code Evidence</h5>
                                            <ul>{adr.evidence.map((e, i) => <li key={i} className="evidence-item">{e}</li>)}</ul>
                                        </div>
                                    )}
                                    {adr.alternatives?.length > 0 && (
                                        <div className="adr-section">
                                            <h5>Rejected Alternatives</h5>
                                            <ul>{adr.alternatives.map((a, i) => <li key={i} style={{ color: 'var(--text-muted)' }}>{a}</li>)}</ul>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {data?.error && <div className="error-box">✗ {data.error}</div>}
        </div>
    );
}
