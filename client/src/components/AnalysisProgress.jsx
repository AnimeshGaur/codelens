export default function AnalysisProgress({ steps }) {
    return (
        <section className="progress-section">
            <div className="progress-header">
                <h2>
                    <span className="progress-spinner" />
                    Analyzing Codebase
                </h2>
                <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
                    This may take a minute depending on the repo size...
                </p>
            </div>

            <div className="progress-steps">
                {steps.map((step, i) => (
                    <div
                        key={i}
                        className={`progress-step ${step.done ? 'done' : ''} ${step.error ? 'error' : ''}`}
                    >
                        <span className="icon">
                            {step.error ? '✗' : step.done ? '✓' : step.warning ? '⚠' : '⟳'}
                        </span>
                        <span>{step.message}</span>
                    </div>
                ))}
            </div>
        </section>
    );
}
