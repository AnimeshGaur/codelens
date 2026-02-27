import { useState } from 'react';

const COLORS = { low: '#34d399', medium: '#60a5fa', high: '#fbbf24', critical: '#f87171' };

export default function DebtHeatmap({ sessionId, provider }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/debt-heatmap', {
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
            <h3>🌡️ Technical Debt Heatmap</h3>
            <p className="feature-desc">Visualize code quality and technical debt across your codebase.</p>

            {!data && (
                <button className="btn-analyze" onClick={load} disabled={loading} style={{ margin: '20px 0' }}>
                    {loading ? <><span className="progress-spinner" /> Generating...</> : '🌡️ Generate Heatmap'}
                </button>
            )}

            {data && !data.error && (
                <>
                    <div className="stats-grid" style={{ marginBottom: 24 }}>
                        <div className="stat-card">
                            <div className="stat-value">{data.overallScore}/10</div>
                            <div className="stat-label">Overall Debt</div>
                        </div>
                    </div>

                    <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>{data.summary}</p>

                    <div className="heatmap-grid">
                        {(data.items || []).map((item, i) => (
                            <div key={i} className="heatmap-cell" style={{ borderColor: COLORS[item.category] || COLORS.medium }}>
                                <div className="heatmap-header">
                                    <span className="heatmap-name">{item.name}</span>
                                    <span className="heatmap-score" style={{ color: COLORS[item.category] }}>
                                        {item.debtScore}/10
                                    </span>
                                </div>
                                <div className="heatmap-metrics">
                                    {item.metrics && Object.entries(item.metrics).map(([key, val]) => (
                                        <div key={key} className="metric-bar">
                                            <span className="metric-label">{key}</span>
                                            <div className="metric-track">
                                                <div className="metric-fill" style={{ width: `${val * 10}%`, background: val > 7 ? '#f87171' : val > 4 ? '#fbbf24' : '#34d399' }} />
                                            </div>
                                            <span className="metric-val">{val}</span>
                                        </div>
                                    ))}
                                </div>
                                {item.issues?.length > 0 && (
                                    <div className="heatmap-issues">
                                        {item.issues.map((issue, j) => <span key={j} className="issue-tag">⚠ {issue}</span>)}
                                    </div>
                                )}
                                {item.suggestions?.length > 0 && (
                                    <div className="heatmap-suggestions">
                                        {item.suggestions.map((s, j) => <span key={j} className="suggestion-tag">💡 {s}</span>)}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {data.topPriorities?.length > 0 && (
                        <div style={{ marginTop: 24 }}>
                            <h4>🎯 Top Priorities</h4>
                            <ol style={{ color: 'var(--text-secondary)', paddingLeft: 20 }}>
                                {data.topPriorities.map((p, i) => <li key={i}>{p}</li>)}
                            </ol>
                        </div>
                    )}
                </>
            )}

            {data?.error && <div className="error-box">✗ {data.error}</div>}
        </div>
    );
}
