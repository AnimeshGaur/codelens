import { useState } from 'react';

const SEV_COLORS = { low: '#34d399', medium: '#60a5fa', high: '#fbbf24', critical: '#f87171' };

export default function DriftReport({ sessionId, provider }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/drift', {
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
            <h3>🏗️ Architecture Drift Detection</h3>
            <p className="feature-desc">Compare intended architecture (from docs) vs actual code structure.</p>

            {!data && (
                <button className="btn-analyze" onClick={load} disabled={loading} style={{ margin: '20px 0' }}>
                    {loading ? <><span className="progress-spinner" /> Analyzing...</> : '🏗️ Detect Drift'}
                </button>
            )}

            {data && !data.error && (
                <>
                    <div className="stats-grid" style={{ marginBottom: 24 }}>
                        <div className="stat-card">
                            <div className="stat-value" style={{ color: data.driftScore > 5 ? '#f87171' : '#34d399' }}>
                                {data.driftScore}/10
                            </div>
                            <div className="stat-label">Drift Score</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{data.drifts?.length || 0}</div>
                            <div className="stat-label">Drifts Found</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value" style={{ color: '#34d399' }}>{data.alignments?.length || 0}</div>
                            <div className="stat-label">Alignments</div>
                        </div>
                    </div>

                    <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>{data.summary}</p>

                    {data.drifts?.length > 0 && (
                        <div className="drift-section">
                            <h4>⚠️ Architecture Drifts</h4>
                            {data.drifts.map((d, i) => (
                                <div key={i} className="drift-card" style={{ borderLeft: `3px solid ${SEV_COLORS[d.severity] || SEV_COLORS.medium}` }}>
                                    <div className="drift-header">
                                        <strong>{d.area}</strong>
                                        <span className="drift-sev" style={{ color: SEV_COLORS[d.severity] }}>{d.severity?.toUpperCase()}</span>
                                    </div>
                                    <div className="drift-compare">
                                        <div className="drift-side"><span className="drift-label">📋 Intended:</span> {d.intended}</div>
                                        <div className="drift-side"><span className="drift-label">💻 Actual:</span> {d.actual}</div>
                                    </div>
                                    <div className="drift-rec">💡 {d.recommendation}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {data.alignments?.length > 0 && (
                        <div className="drift-section" style={{ marginTop: 24 }}>
                            <h4 style={{ color: '#34d399' }}>✅ Aligned Areas</h4>
                            {data.alignments.map((a, i) => (
                                <div key={i} className="drift-card" style={{ borderLeft: '3px solid #34d399' }}>
                                    <strong>{a.area}</strong>
                                    <p>{a.description}</p>
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
