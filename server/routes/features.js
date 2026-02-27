import { Router } from 'express';
import {
    chatWithCodebase,
    computeBlastRadius,
    computeDebtHeatmap,
    detectArchitectureDrift,
    generateOnboardingStory,
    generateADRs,
    computeCrossRepoMap,
} from '../services/features.js';

export const featuresRoute = Router();

// In-memory store for analysis results (per session)
const sessionStore = new Map();

/** Store results for later use by feature endpoints */
export function storeSession(id, data) {
    sessionStore.set(id, { ...data, createdAt: Date.now() });
    // Auto-cleanup after 30 minutes
    setTimeout(() => sessionStore.delete(id), 30 * 60 * 1000);
}

function getSession(id) {
    return sessionStore.get(id);
}

/**
 * POST /api/chat
 * Body: { sessionId, question, provider?, history?: [{role, content}] }
 */
featuresRoute.post('/chat', async (req, res) => {
    try {
        const { sessionId, question, provider, history } = req.body;
        if (!sessionId || !question) {
            return res.status(400).json({ error: 'sessionId and question are required' });
        }

        const session = getSession(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found. Run an analysis first.' });
        }

        // Merge all repo models into one context
        const mergedModel = mergeModels(session.repos);
        const answer = await chatWithCodebase(question, mergedModel, { provider, history, apiKey: session.apiKey });
        res.json({ answer });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/blast-radius
 * Body: { sessionId, component, provider? }
 */
featuresRoute.post('/blast-radius', async (req, res) => {
    try {
        const { sessionId, component, provider } = req.body;
        if (!sessionId || !component) {
            return res.status(400).json({ error: 'sessionId and component are required' });
        }

        const session = getSession(sessionId);
        if (!session) return res.status(404).json({ error: 'Session not found' });

        const mergedModel = mergeModels(session.repos);
        const result = await computeBlastRadius(component, mergedModel, { provider, apiKey: session.apiKey });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/debt-heatmap
 * Body: { sessionId, provider? }
 */
featuresRoute.post('/debt-heatmap', async (req, res) => {
    try {
        const { sessionId, provider } = req.body;
        if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

        const session = getSession(sessionId);
        if (!session) return res.status(404).json({ error: 'Session not found' });

        const mergedModel = mergeModels(session.repos);
        const result = await computeDebtHeatmap(mergedModel, { provider, apiKey: session.apiKey });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/drift
 * Body: { sessionId, provider? }
 */
featuresRoute.post('/drift', async (req, res) => {
    try {
        const { sessionId, provider } = req.body;
        if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

        const session = getSession(sessionId);
        if (!session) return res.status(404).json({ error: 'Session not found' });

        const mergedModel = mergeModels(session.repos);
        const readme = session.readme || '';
        const result = await detectArchitectureDrift(mergedModel, readme, { provider, apiKey: session.apiKey });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/onboarding
 * Body: { sessionId, provider? }
 */
featuresRoute.post('/onboarding', async (req, res) => {
    try {
        const { sessionId, provider } = req.body;
        if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

        const session = getSession(sessionId);
        if (!session) return res.status(404).json({ error: 'Session not found' });

        const mergedModel = mergeModels(session.repos);
        const result = await generateOnboardingStory(mergedModel, { provider, apiKey: session.apiKey });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/adrs
 * Body: { sessionId, provider? }
 */
featuresRoute.post('/adrs', async (req, res) => {
    try {
        const { sessionId, provider } = req.body;
        if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

        const session = getSession(sessionId);
        if (!session) return res.status(404).json({ error: 'Session not found' });

        const mergedModel = mergeModels(session.repos);
        const result = await generateADRs(mergedModel, { provider, apiKey: session.apiKey });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/cross-repo
 * Body: { sessionId }
 */
featuresRoute.post('/cross-repo', (req, res) => {
    try {
        const { sessionId } = req.body;
        if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

        const session = getSession(sessionId);
        if (!session) return res.status(404).json({ error: 'Session not found' });

        const result = computeCrossRepoMap(session.repos);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/** Merge raw models from multiple repos into one */
function mergeModels(repos) {
    const merged = {
        components: [],
        classes: [],
        dbModels: [],
        endpoints: [],
        externalApis: [],
        flows: [],
        architecture: {},
    };

    for (const repo of repos) {
        const m = repo.rawModel || {};
        merged.components.push(...(m.components || []));
        merged.classes.push(...(m.classes || []));
        merged.dbModels.push(...(m.dbModels || []));
        merged.endpoints.push(...(m.endpoints || []));
        merged.externalApis.push(...(m.externalApis || []));
        merged.flows.push(...(m.flows || []));
        if (m.architecture) {
            merged.architecture = { ...merged.architecture, ...m.architecture };
        }
    }

    return merged;
}
