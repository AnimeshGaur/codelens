import { useState } from 'react';

export default function RepoInput({ onAnalyze, isLoading }) {
    const [repos, setRepos] = useState(['']);
    const [provider, setProvider] = useState('ollama');

    const [apiKey, setApiKey] = useState('');

    const updateRepo = (index, value) => {
        const updated = [...repos];
        updated[index] = value;
        setRepos(updated);
    };

    const addRepo = () => setRepos([...repos, '']);

    const removeRepo = (index) => {
        if (repos.length <= 1) return;
        setRepos(repos.filter((_, i) => i !== index));
    };

    const handleSubmit = () => {
        const validRepos = repos.filter((r) => r.trim().length > 0);
        if (validRepos.length === 0) return;
        onAnalyze(validRepos, provider);
    };

    const hasValidUrl = repos.some((r) => r.trim().length > 0);

    return (
        <section className="input-section">
            <h1 className="input-title">Analyze Any Codebase</h1>
            <p className="input-subtitle">
                Paste GitHub/Git URLs or local folder paths below. CodeLens will
                analyze and generate professional technical documentation with
                architecture diagrams.
            </p>

            <div className="provider-select">
                <label>LLM Provider:</label>
                <select value={provider} onChange={(e) => setProvider(e.target.value)}>
                    <option value="ollama">Ollama Local (No API Key)</option>
                    <option value="groq">Groq (Llama 3.3 70B)</option>
                    <option value="gemini">Google Gemini</option>
                    <option value="openai">OpenAI GPT-4o</option>
                    <option value="anthropic">Anthropic Claude</option>
                </select>
            </div>

            <div className="repo-list">
                {repos.map((url, i) => (
                    <div key={i} className="repo-row">
                        <input
                            className="repo-input"
                            type="text"
                            value={url}
                            onChange={(e) => updateRepo(i, e.target.value)}
                            placeholder="https://github.com/owner/repo  or  /path/to/local/project"
                            disabled={isLoading}
                        />
                        {repos.length > 1 && (
                            <button
                                className="btn-remove"
                                onClick={() => removeRepo(i)}
                                disabled={isLoading}
                                title="Remove"
                            >
                                ×
                            </button>
                        )}
                    </div>
                ))}
            </div>

            <div className="input-actions">
                <button className="btn-add" onClick={addRepo} disabled={isLoading}>
                    + Add Another Repo
                </button>
                <button
                    className={`btn-analyze ${isLoading ? 'loading' : ''}`}
                    onClick={handleSubmit}
                    disabled={!hasValidUrl || isLoading}
                >
                    {isLoading ? (
                        <>
                            <span className="progress-spinner" /> Analyzing...
                        </>
                    ) : (
                        '🔍 Analyze'
                    )}
                </button>
            </div>
        </section>
    );
}
