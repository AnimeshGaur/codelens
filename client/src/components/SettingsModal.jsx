import { useState, useEffect } from 'react';

export default function SettingsModal({ isOpen, onClose }) {
    const [keys, setKeys] = useState({
        groq: '',
        gemini: '',
        openai: '',
        anthropic: '',
    });

    useEffect(() => {
        if (isOpen) {
            const saved = localStorage.getItem('codelens_api_keys');
            if (saved) {
                try {
                    setKeys(JSON.parse(saved));
                } catch (e) {
                    console.error('Failed to parse API keys', e);
                }
            }
        }
    }, [isOpen]);

    const handleChange = (provider, value) => {
        setKeys((prev) => ({ ...prev, [provider]: value }));
    };

    const handleSave = () => {
        localStorage.setItem('codelens_api_keys', JSON.stringify(keys));
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content settings-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>⚙️ Settings</h2>
                    <button className="btn-close" onClick={onClose}>×</button>
                </div>

                <div className="modal-body">
                    <p className="settings-desc">
                        Configure your API keys to use specific LLM providers.
                        Keys are stored locally in your browser.
                    </p>

                    <div className="settings-group">
                        <label>Groq API Key</label>
                        <input
                            type="password"
                            placeholder="gsk_..."
                            value={keys.groq || ''}
                            onChange={(e) => handleChange('groq', e.target.value)}
                        />
                    </div>

                    <div className="settings-group">
                        <label>Google Gemini API Key</label>
                        <input
                            type="password"
                            placeholder="AIza..."
                            value={keys.gemini || ''}
                            onChange={(e) => handleChange('gemini', e.target.value)}
                        />
                    </div>

                    <div className="settings-group">
                        <label>OpenAI API Key</label>
                        <input
                            type="password"
                            placeholder="sk-..."
                            value={keys.openai || ''}
                            onChange={(e) => handleChange('openai', e.target.value)}
                        />
                    </div>

                    <div className="settings-group">
                        <label>Anthropic API Key</label>
                        <input
                            type="password"
                            placeholder="sk-ant-..."
                            value={keys.anthropic || ''}
                            onChange={(e) => handleChange('anthropic', e.target.value)}
                        />
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn-primary" onClick={handleSave}>Save Changes</button>
                </div>
            </div>
        </div>
    );
}
