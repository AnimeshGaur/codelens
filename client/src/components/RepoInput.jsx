import { useState, useEffect } from 'react';

const PROVIDERS = [
    { value: 'ollama', label: '🦙 Ollama (Local LLM)', isLocal: true },
    { value: 'groq', label: '⚡ Groq (Llama 3.3 70B)', placeholder: 'gsk_...' },
    { value: 'gemini', label: '🔷 Google Gemini', placeholder: 'AIza...' },
    { value: 'openai', label: '🟢 OpenAI GPT-4o', placeholder: 'sk-...' },
    { value: 'anthropic', label: '🟣 Anthropic Claude', placeholder: 'sk-ant-...' },
];

export default function RepoInput({ onAnalyze, isLoading }) {
    const [repos, setRepos] = useState(['']);
    const [provider, setProvider] = useState('ollama');
    const [apiKey, setApiKey] = useState('');
    const [ollamaBaseUrl, setOllamaBaseUrl] = useState('http://localhost:11434/v1');
    const [ollamaModel, setOllamaModel] = useState('qwen2.5-coder');

    // Load previously saved keys from localStorage per provider
    useEffect(() => {
        const savedKey = localStorage.getItem(`codelens_key_${provider}`);
        if (savedKey) setApiKey(savedKey);
        else setApiKey('');

        const savedUrl = localStorage.getItem('codelens_ollama_url');
        if (savedUrl) setOllamaBaseUrl(savedUrl);
        const savedModel = localStorage.getItem('codelens_ollama_model');
        if (savedModel) setOllamaModel(savedModel);
    }, [provider]);

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

        // Save key for next session
        if (provider !== 'ollama' && apiKey) {
            localStorage.setItem(`codelens_key_${provider}`, apiKey);
        }
        if (provider === 'ollama') {
            localStorage.setItem('codelens_ollama_url', ollamaBaseUrl);
            localStorage.setItem('codelens_ollama_model', ollamaModel);
        }

        onAnalyze(validRepos, provider, apiKey, {
            ollamaBaseUrl,
            ollamaModel,
        });
    };

    const selectedProvider = PROVIDERS.find((p) => p.value === provider);
    const isLocal = selectedProvider?.isLocal;
    const hasValidUrl = repos.some((r) => r.trim().length > 0);
    const needsKey = !isLocal && !apiKey.trim();

    return (
        <section className="input-section">
            <h1 className="input-title">Analyze Any Codebase</h1>
            <p className="input-subtitle">
                Paste GitHub/Git URLs or local folder paths below. CodeLens will
                analyze and generate professional technical documentation with
                architecture diagrams.
            </p>

            {/* Provider Selection */}
            <div className="provider-select">
                <label>LLM Provider:</label>
                <select value={provider} onChange={(e) => setProvider(e.target.value)}>
                    {PROVIDERS.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                </select>
            </div>

            {/* API Key Input (for cloud providers) */}
            {!isLocal && (
                <div className="provider-config-card">
                    <label>🔑 {selectedProvider?.label} API Key</label>
                    <input
                        type="password"
                        className="config-input"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={selectedProvider?.placeholder || 'Enter your API key'}
                        disabled={isLoading}
                    />
                    <p className="config-hint">Your key is stored locally in your browser and sent only to the CodeLens server.</p>
                </div>
            )}

            {/* Local LLM Config (for Ollama) */}
            {isLocal && (
                <div className="provider-config-card local-config">
                    <div className="local-config-header">🖥️ Local LLM Configuration</div>
                    <div className="local-config-row">
                        <label>Base URL</label>
                        <input
                            type="text"
                            className="config-input"
                            value={ollamaBaseUrl}
                            onChange={(e) => setOllamaBaseUrl(e.target.value)}
                            placeholder="http://localhost:11434/v1"
                            disabled={isLoading}
                        />
                    </div>
                    <div className="local-config-row">
                        <label>Model Name</label>
                        <input
                            type="text"
                            className="config-input"
                            value={ollamaModel}
                            onChange={(e) => setOllamaModel(e.target.value)}
                            placeholder="qwen2.5-coder, llama3, mistral, etc."
                            disabled={isLoading}
                        />
                    </div>
                    <p className="config-hint">Make sure Ollama is running locally before analyzing.</p>
                </div>
            )}

            {/* Repo URL Inputs */}
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
                    disabled={!hasValidUrl || needsKey || isLoading}
                    title={needsKey ? 'Please enter your API key first' : ''}
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
