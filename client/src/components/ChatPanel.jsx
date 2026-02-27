import { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';

export default function ChatPanel({ sessionId, provider }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const send = async () => {
        if (!input.trim() || loading) return;
        const question = input.trim();
        setInput('');

        const userMsg = { role: 'user', content: question };
        setMessages((prev) => [...prev, userMsg]);
        setLoading(true);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    question,
                    provider,
                    history: messages.slice(-10),
                }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setMessages((prev) => [...prev, { role: 'assistant', content: data.answer }]);
        } catch (err) {
            setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    };

    return (
        <div className="chat-panel">
            <div className="chat-messages">
                {messages.length === 0 && (
                    <div className="chat-empty">
                        <p>🧠 Ask anything about this codebase</p>
                        <div className="chat-suggestions">
                            {[
                                'How does authentication work?',
                                'What are the main API endpoints?',
                                'Explain the database schema',
                                'What would break if I change the User model?',
                            ].map((q, i) => (
                                <button key={i} className="chat-suggestion" onClick={() => { setInput(q); }}>
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {messages.map((msg, i) => (
                    <div key={i} className={`chat-msg chat-msg-${msg.role}`}>
                        <div className="chat-msg-avatar">{msg.role === 'user' ? '👤' : '🧠'}</div>
                        <div className="chat-msg-content">
                            <Markdown>{msg.content}</Markdown>
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="chat-msg chat-msg-assistant">
                        <div className="chat-msg-avatar">🧠</div>
                        <div className="chat-msg-content"><span className="progress-spinner" /> Thinking...</div>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>
            <div className="chat-input-row">
                <textarea
                    className="chat-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about the codebase..."
                    rows={1}
                    disabled={loading}
                />
                <button className="btn-analyze chat-send" onClick={send} disabled={!input.trim() || loading}>
                    Send
                </button>
            </div>
        </div>
    );
}
