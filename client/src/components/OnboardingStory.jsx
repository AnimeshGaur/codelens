import { useState } from 'react';

export default function OnboardingStory({ sessionId, provider }) {
    const [data, setData] = useState(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/onboarding', {
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

    const steps = data?.steps || [];
    const step = steps[currentStep];

    return (
        <div className="feature-panel">
            <h3>🧭 Developer Onboarding Story</h3>
            <p className="feature-desc">An interactive narrated walkthrough of the codebase for new developers.</p>

            {!data && (
                <button className="btn-analyze" onClick={load} disabled={loading} style={{ margin: '20px 0' }}>
                    {loading ? <><span className="progress-spinner" /> Generating...</> : '🧭 Generate Walkthrough'}
                </button>
            )}

            {data && !data.error && (
                <div className="story-container">
                    <div className="story-header">
                        <h4>{data.title}</h4>
                        <span className="story-meta">⏱ {data.estimatedTime} · {steps.length} steps</span>
                    </div>

                    {data.prerequisites?.length > 0 && (
                        <div className="story-prereqs">
                            <strong>Prerequisites:</strong> {data.prerequisites.join(' · ')}
                        </div>
                    )}

                    <div className="story-progress-bar">
                        {steps.map((_, i) => (
                            <button
                                key={i}
                                className={`story-dot ${i === currentStep ? 'active' : i < currentStep ? 'done' : ''}`}
                                onClick={() => setCurrentStep(i)}
                            />
                        ))}
                    </div>

                    {step && (
                        <div className="story-step">
                            <div className="story-step-num">Step {step.step} of {steps.length}</div>
                            <h4 className="story-step-title">{step.title}</h4>
                            <p className="story-step-desc">{step.description}</p>

                            {step.highlightComponents?.length > 0 && (
                                <div className="story-highlights">
                                    {step.highlightComponents.map((c, i) => (
                                        <span key={i} className="highlight-chip">{c}</span>
                                    ))}
                                </div>
                            )}

                            {step.codeContext && (
                                <pre className="story-code">{step.codeContext}</pre>
                            )}

                            {step.tip && (
                                <div className="story-tip">💡 <strong>Pro Tip:</strong> {step.tip}</div>
                            )}
                        </div>
                    )}

                    <div className="story-nav">
                        <button className="btn-new" onClick={() => setCurrentStep(Math.max(0, currentStep - 1))} disabled={currentStep === 0}>
                            ← Previous
                        </button>
                        <button className="btn-analyze" onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))} disabled={currentStep === steps.length - 1} style={{ padding: '8px 24px' }}>
                            Next →
                        </button>
                    </div>

                    {data.keyTakeaways?.length > 0 && currentStep === steps.length - 1 && (
                        <div className="story-takeaways">
                            <h4>🎯 Key Takeaways</h4>
                            <ul>{data.keyTakeaways.map((t, i) => <li key={i}>{t}</li>)}</ul>
                        </div>
                    )}
                </div>
            )}

            {data?.error && <div className="error-box">✗ {data.error}</div>}
        </div>
    );
}
