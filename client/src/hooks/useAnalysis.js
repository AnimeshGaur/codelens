import { useState, useCallback } from 'react';

/**
 * Custom hook that handles the SSE-based analysis API call.
 * Returns { analyze, isLoading, steps, results, sessionId, error, reset }
 */
export function useAnalysis() {
    const [isLoading, setIsLoading] = useState(false);
    const [steps, setSteps] = useState([]);
    const [results, setResults] = useState(null);
    const [sessionId, setSessionId] = useState(null);
    const [error, setError] = useState(null);

    const reset = useCallback(() => {
        setIsLoading(false);
        setSteps([]);
        setResults(null);
        setSessionId(null);
        setError(null);
    }, []);

    const analyze = useCallback(async (repos, provider, apiKey, ollamaConfig = {}) => {
        setIsLoading(true);
        setSteps([]);
        setResults(null);
        setSessionId(null);
        setError(null);

        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repos, provider, apiKey, ...ollamaConfig }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Analysis failed');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                let eventType = '';
                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        eventType = line.slice(7).trim();
                    } else if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (eventType === 'progress') {
                                setSteps((prev) => [...prev, data]);
                            } else if (eventType === 'complete') {
                                setResults(data);
                                setSessionId(data.sessionId || null);
                            } else if (eventType === 'error') {
                                setError(data.message);
                            }
                        } catch {
                            // skip malformed JSON
                        }
                    }
                }
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    return { analyze, isLoading, steps, results, sessionId, error, reset };
}
