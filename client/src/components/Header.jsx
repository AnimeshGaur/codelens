export default function Header({ onSettingsClick }) {
    return (
        <header className="header">
            <div className="header-brand">
                <div className="header-logo">🔍</div>
                <div>
                    <div className="header-title">CodeLens</div>
                    <div className="header-subtitle">AI-Powered Codebase Analyzer</div>
                </div>
            </div>
            <div className="header-actions">
                <button className="btn-icon" onClick={onSettingsClick} title="Settings">
                    ⚙️
                </button>
                <span className="header-badge">v2.0</span>
            </div>
        </header>
    );
}
