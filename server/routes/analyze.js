import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { resolveRepo, parseRepoInput } from '../services/github.js';
import { analyzeRepo } from '../services/analyzer.js';
import { storeSession } from './features.js';

export const analyzeRoute = Router();

/**
 * POST /api/analyze
 * Body: { repos: ["/local/path", "https://github.com/user/repo", "git@..."], provider?, model?, apiKey? }
 */
analyzeRoute.post('/analyze', async (req, res) => {
    const { repos, provider, model, apiKey } = req.body;

    if (!repos || !Array.isArray(repos) || repos.length === 0) {
        return res.status(400).json({ error: 'repos[] is required' });
    }

    try {
        repos.forEach((input) => parseRepoInput(input));
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }

    // Set up SSE
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
    });

    const emit = (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const sessionId = crypto.randomUUID();
    const results = [];
    const resolved = [];
    let readme = '';

    try {
        emit('progress', { step: 'resolve', message: `Resolving ${repos.length} repo(s)...` });
        for (const input of repos) {
            try {
                const repo = resolveRepo(input, (msg) => emit('progress', { step: 'resolve', message: msg }));
                resolved.push(repo);
            } catch (err) {
                emit('progress', { step: 'resolve', message: `Failed: ${err.message}`, error: true });
            }
        }
        emit('progress', { step: 'resolve', message: `${resolved.length} repo(s) ready`, done: true });

        // Analyze each repo
        for (const repo of resolved) {
            emit('progress', {
                step: 'repo-start',
                message: `Analyzing ${repo.repoName}...`,
                repoName: repo.repoName,
            });

            // Capture README for drift detection
            const readmePath = findReadme(repo.repoPath);
            if (readmePath) {
                try {
                    readme += fs.readFileSync(readmePath, 'utf-8') + '\n\n';
                } catch {
                    // ignore read errors
                }
            }

            const result = await analyzeRepo(repo.repoPath, repo.repoName, { provider, model, apiKey }, emit);
            results.push(result);

            emit('progress', {
                step: 'repo-done',
                message: `${repo.repoName} complete ✓`,
                repoName: repo.repoName,
            });
        }

        // Store session for feature endpoints (including apiKey for subsequent requests)
        storeSession(sessionId, { repos: results, readme, provider, apiKey });

        // Send final results
        emit('complete', {
            sessionId,
            repos: results,
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        emit('error', { message: err.message });
    } finally {
        resolved.forEach((r) => r.cleanup());
        res.end();
    }
});

/** Find README file in repo root */
function findReadme(repoPath) {
    const candidates = ['README.md', 'readme.md', 'Readme.md', 'README.rst', 'README.txt', 'README'];
    for (const name of candidates) {
        const p = path.join(repoPath, name);
        if (fs.existsSync(p)) return p;
    }
    return null;
}

analyzeRoute.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        providers: ['gemini', 'openai', 'anthropic', 'groq', 'ollama'],
        version: '2.0.0',
    });
});
