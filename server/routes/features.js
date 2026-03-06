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
import { validate, SCHEMAS } from '../core/validation.js';
import { asyncHandler } from '../core/errors.js';
import { logger } from '../core/logger.js';

export const featuresRoute = Router();

// In-memory store for analysis results (per session)
const sessionStore = new Map();

/** Store results for later use by feature endpoints */
export function storeSession(id, data) {
    sessionStore.set(id, { ...data, createdAt: Date.now() });
    // Auto-cleanup after 30 minutes
    setTimeout(() => sessionStore.delete(id), 30 * 60 * 1000);
    logger.info('Session stored', { sessionId: id, repos: data.repos?.length });
}

function getSession(id) {
    return sessionStore.get(id);
}

/** Resolve session or throw 404 */
function requireSession(sessionId) {
    const session = getSession(sessionId);
    if (!session) {
        const err = new Error('Session not found. Run an analysis first.');
        err.statusCode = 404;
        throw err;
    }
    return session;
}

/**
 * POST /api/chat
 */
featuresRoute.post('/chat', asyncHandler(async (req, res) => {
    validate(req.body, SCHEMAS.chat);
    const { sessionId, question, provider, history } = req.body;

    const session = requireSession(sessionId);
    const mergedModel = mergeModels(session.repos);
    const answer = await chatWithCodebase(question, mergedModel, { provider, history, apiKey: session.apiKey });
    res.json({ answer });
}));

/**
 * POST /api/blast-radius
 */
featuresRoute.post('/blast-radius', asyncHandler(async (req, res) => {
    validate(req.body, SCHEMAS.blastRadius);
    const { sessionId, component, provider } = req.body;

    const session = requireSession(sessionId);
    const mergedModel = mergeModels(session.repos);
    const result = await computeBlastRadius(component, mergedModel, { provider, apiKey: session.apiKey });
    res.json(result);
}));

/**
 * POST /api/debt-heatmap
 */
featuresRoute.post('/debt-heatmap', asyncHandler(async (req, res) => {
    validate(req.body, SCHEMAS.sessionOnly);
    const { sessionId, provider } = req.body;

    const session = requireSession(sessionId);
    const mergedModel = mergeModels(session.repos);
    const result = await computeDebtHeatmap(mergedModel, { provider, apiKey: session.apiKey });
    res.json(result);
}));

/**
 * POST /api/drift
 */
featuresRoute.post('/drift', asyncHandler(async (req, res) => {
    validate(req.body, SCHEMAS.sessionOnly);
    const { sessionId, provider } = req.body;

    const session = requireSession(sessionId);
    const mergedModel = mergeModels(session.repos);
    const readme = session.readme || '';
    const result = await detectArchitectureDrift(mergedModel, readme, { provider, apiKey: session.apiKey });
    res.json(result);
}));

/**
 * POST /api/onboarding
 */
featuresRoute.post('/onboarding', asyncHandler(async (req, res) => {
    validate(req.body, SCHEMAS.sessionOnly);
    const { sessionId, provider } = req.body;

    const session = requireSession(sessionId);
    const mergedModel = mergeModels(session.repos);
    const result = await generateOnboardingStory(mergedModel, { provider, apiKey: session.apiKey });
    res.json(result);
}));

/**
 * POST /api/adrs
 */
featuresRoute.post('/adrs', asyncHandler(async (req, res) => {
    validate(req.body, SCHEMAS.sessionOnly);
    const { sessionId, provider } = req.body;

    const session = requireSession(sessionId);
    const mergedModel = mergeModels(session.repos);
    const result = await generateADRs(mergedModel, { provider, apiKey: session.apiKey });
    res.json(result);
}));

/**
 * POST /api/cross-repo
 */
featuresRoute.post('/cross-repo', asyncHandler(async (req, res) => {
    validate(req.body, SCHEMAS.crossRepo);
    const { sessionId } = req.body;

    const session = requireSession(sessionId);
    const result = computeCrossRepoMap(session.repos);
    res.json(result);
}));

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
