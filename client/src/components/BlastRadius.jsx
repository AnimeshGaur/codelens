import { useState } from 'react';

export default function BlastRadius({ sessionId, provider, components }) {
    const [selected, setSelected] = useState('');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    const analyze = async () => {
        if (!selected) return;
        setLoading(true);
        setResult(null);
        try {
            const res = await fetch('/api/blast-radius', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, component: selected, provider }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setResult(data);
        } catch (err) {
            setResult({ error: err.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="feature-panel">
            <h3>💥 Impact Blast Radius</h3>
            <p className="feature-desc">Select a component to see what would be affected if it changes.</p>

            <div className="blast-controls">
                <select value={selected} onChange={(e) => setSelected(e.target.value)} className="repo-input" style={{ maxWidth: 400 }}>
                    <option value="">Select a component...</option>
                    {(components || []).map((c, i) => (
                        <option key={i} value={c}>{c}</option>
                    ))}
                </select>
                <button className="btn-analyze" onClick={analyze} disabled={!selected || loading} style={{ padding: '10px 24px' }}>
                    {loading ? <><span className="progress-spinner" /> Analyzing...</> : '💥 Analyze Impact'}
                </button>
            </div>

            {result && !result.error && (
                <div className="blast-result">
                    <div className="stats-grid" style={{ marginTop: 20 }}>
                        <div className="stat-card">
                            <div className="stat-value" style={{ color: '#f87171' }}>{result.riskScore}/10</div>
                            <div className="stat-label">Risk Score</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{result.directImpact?.length || 0}</div>
                            <div className="stat-label">Direct Impact</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{result.indirectImpact?.length || 0}</div>
                            <div className="stat-label">Indirect Impact</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value" style={{ color: '#34d399' }}>{result.safeComponents?.length || 0}</div>
                            <div className="stat-label">Safe</div>
                        </div>
                    </div>

                    <p style={{ color: 'var(--text-secondary)', margin: '16px 0' }}>{result.summary}</p>

                    {result.directImpact?.length > 0 && (
                        <div className="impact-section">
                            <h4 style={{ color: '#f87171' }}>🔴 Direct Impact</h4>
                            {result.directImpact.map((item, i) => (
                                <div key={i} className="impact-item" style={{ borderLeft: '3px solid #f87171' }}>
                                    <strong>{item.name}</strong> <span className="impact-badge">{item.type}</span>
                                    <p>{item.reason}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {result.indirectImpact?.length > 0 && (
                        <div className="impact-section">
                            <h4 style={{ color: '#fbbf24' }}>🟡 Indirect Impact</h4>
                            {result.indirectImpact.map((item, i) => (
                                <div key={i} className="impact-item" style={{ borderLeft: '3px solid #fbbf24' }}>
                                    <strong>{item.name}</strong> <span className="impact-badge">{item.type}</span>
                                    <p>{item.reason}</p>
                                    {item.chain && <code>{item.chain}</code>}
                                </div>
                            ))}
                        </div>
                    )}

                    {result.recommendations?.length > 0 && (
                        <div className="impact-section">
                            <h4>💡 Recommendations</h4>
                            <ul>{result.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul>
                        </div>
                    )}
                </div>
            )}

            {result?.error && <div className="error-box">✗ {result.error}</div>}
        </div>
    );
}
