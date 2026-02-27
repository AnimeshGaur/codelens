import { createProvider } from '../core/llm/provider.js';

const MODEL_DEFAULTS = {
    gemini: 'gemini-2.0-flash',
    openai: 'gpt-4o',
    anthropic: 'claude-sonnet-4-20250514',
    groq: 'llama-3.3-70b-versatile',
};

/**
 * Feature 1: Ask the Codebase — Chat with the analyzed code model
 */
export async function chatWithCodebase(question, codeModel, options = {}) {
    const provider = options.provider || 'groq';
    const model = options.model || MODEL_DEFAULTS[provider];
    const llm = createProvider(provider, model, options.apiKey);
    const history = options.history || [];

    const systemPrompt = `You are CodeLens AI, an expert code architecture assistant.
You have analyzed a codebase and have the following structural model:

COMPONENTS: ${JSON.stringify(codeModel.components || [], null, 1)}
CLASSES: ${JSON.stringify(codeModel.classes || [], null, 1)}
DB MODELS: ${JSON.stringify(codeModel.dbModels || [], null, 1)}
ENDPOINTS: ${JSON.stringify(codeModel.endpoints || [], null, 1)}
EXTERNAL APIS: ${JSON.stringify(codeModel.externalApis || [], null, 1)}
FLOWS: ${JSON.stringify(codeModel.flows || [], null, 1)}
ARCHITECTURE: ${JSON.stringify(codeModel.architecture || {}, null, 1)}

Answer questions about this codebase accurately and concisely.
Use markdown formatting. Reference specific components, classes, files, and endpoints by name.
If asked about something not in the model, say so honestly.`;

    const historyText = history
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n');

    const prompt = historyText
        ? `Previous conversation:\n${historyText}\n\nUser: ${question}`
        : question;

    const response = await llm.send(prompt, systemPrompt);
    return response;
}

/**
 * Feature 2: Impact Blast Radius — Find what's affected if a component changes
 */
export async function computeBlastRadius(targetComponent, codeModel, options = {}) {
    const provider = options.provider || 'groq';
    const model = options.model || MODEL_DEFAULTS[provider];
    const llm = createProvider(provider, model, options.apiKey);

    const prompt = `Analyze the impact blast radius if the component/module "${targetComponent}" is modified in this codebase.

CODEBASE MODEL:
Components: ${JSON.stringify(codeModel.components || [])}
Classes: ${JSON.stringify(codeModel.classes || [])}
Endpoints: ${JSON.stringify(codeModel.endpoints || [])}
DB Models: ${JSON.stringify(codeModel.dbModels || [])}
Flows: ${JSON.stringify(codeModel.flows || [])}

Return a JSON object with this exact structure:
{
  "target": "${targetComponent}",
  "directImpact": [{"name": "...", "type": "component|class|endpoint|dbModel", "reason": "..."}],
  "indirectImpact": [{"name": "...", "type": "...", "reason": "...", "chain": "A → B → C"}],
  "safeComponents": [{"name": "...", "reason": "..."}],
  "riskScore": 1-10,
  "summary": "One paragraph summary of impact",
  "recommendations": ["..."]
}`;

    const response = await llm.send(prompt, 'You are a code impact analysis expert. Return only valid JSON.');
    return JSON.parse(response);
}

/**
 * Feature 3: Technical Debt Heatmap — Score each component
 */
export async function computeDebtHeatmap(codeModel, options = {}) {
    const provider = options.provider || 'groq';
    const model = options.model || MODEL_DEFAULTS[provider];
    const llm = createProvider(provider, model, options.apiKey);

    const prompt = `Analyze technical debt for each component in this codebase.

CODEBASE MODEL:
Components: ${JSON.stringify(codeModel.components || [])}
Classes: ${JSON.stringify(codeModel.classes || [])}
Endpoints: ${JSON.stringify(codeModel.endpoints || [])}
DB Models: ${JSON.stringify(codeModel.dbModels || [])}
Architecture: ${JSON.stringify(codeModel.architecture || {})}

For each component/module, score its technical debt on a 1-10 scale.
Return a JSON object:
{
  "items": [
    {
      "name": "component name",
      "debtScore": 1-10,
      "category": "low|medium|high|critical",
      "issues": ["issue 1", "issue 2"],
      "suggestions": ["fix 1", "fix 2"],
      "metrics": {
        "complexity": 1-10,
        "coupling": 1-10,
        "cohesion": 1-10,
        "testability": 1-10
      }
    }
  ],
  "overallScore": 1-10,
  "summary": "Overall technical debt assessment",
  "topPriorities": ["priority 1", "priority 2", "priority 3"]
}`;

    const response = await llm.send(prompt, 'You are a code quality expert. Return only valid JSON.');
    return JSON.parse(response);
}

/**
 * Feature 4: Architecture Drift Detection — Intended vs Actual
 */
export async function detectArchitectureDrift(codeModel, readmeContent, options = {}) {
    const provider = options.provider || 'groq';
    const model = options.model || MODEL_DEFAULTS[provider];
    const llm = createProvider(provider, model, options.apiKey);

    const prompt = `Compare the INTENDED architecture (from documentation) with the ACTUAL architecture (from code analysis).

DOCUMENTATION / README:
${readmeContent || '(No README found)'}

ACTUAL CODE ARCHITECTURE:
Components: ${JSON.stringify(codeModel.components || [])}
Classes: ${JSON.stringify(codeModel.classes || [])}
Endpoints: ${JSON.stringify(codeModel.endpoints || [])}
Architecture Patterns: ${JSON.stringify(codeModel.architecture || {})}
DB Models: ${JSON.stringify(codeModel.dbModels || [])}

Return a JSON object:
{
  "drifts": [
    {
      "area": "area of drift",
      "intended": "what the docs say",
      "actual": "what the code does",
      "severity": "low|medium|high|critical",
      "recommendation": "how to fix"
    }
  ],
  "alignments": [
    {
      "area": "area that matches",
      "description": "how code matches docs"
    }
  ],
  "driftScore": 1-10,
  "summary": "Overall drift assessment"
}`;

    const response = await llm.send(prompt, 'You are an architecture compliance expert. Return only valid JSON.');
    return JSON.parse(response);
}

/**
 * Feature 5: Onboarding Story Generator — Narrated walkthrough
 */
export async function generateOnboardingStory(codeModel, options = {}) {
    const provider = options.provider || 'groq';
    const model = options.model || MODEL_DEFAULTS[provider];
    const llm = createProvider(provider, model, options.apiKey);

    const prompt = `Generate an interactive onboarding story for a new developer joining this codebase.

CODEBASE MODEL:
Components: ${JSON.stringify(codeModel.components || [])}
Classes: ${JSON.stringify(codeModel.classes || [])}
Endpoints: ${JSON.stringify(codeModel.endpoints || [])}
Flows: ${JSON.stringify(codeModel.flows || [])}
Architecture: ${JSON.stringify(codeModel.architecture || {})}
DB Models: ${JSON.stringify(codeModel.dbModels || [])}

Create a step-by-step narrated walkthrough. Return a JSON object:
{
  "title": "Getting Started with [Project Name]",
  "estimatedTime": "15 min",
  "steps": [
    {
      "step": 1,
      "title": "Step Title",
      "description": "Detailed explanation (2-3 sentences)",
      "highlightComponents": ["component1", "component2"],
      "codeContext": "Relevant code pattern or file reference",
      "tip": "Pro tip for the new developer"
    }
  ],
  "prerequisites": ["Node.js", "etc"],
  "keyTakeaways": ["takeaway 1", "takeaway 2"]
}`;

    const response = await llm.send(prompt, 'You are a developer onboarding expert. Return only valid JSON.');
    return JSON.parse(response);
}

/**
 * Feature 6: Auto-Generated ADRs (Architecture Decision Records)
 */
export async function generateADRs(codeModel, options = {}) {
    const provider = options.provider || 'groq';
    const model = options.model || MODEL_DEFAULTS[provider];
    const llm = createProvider(provider, model, options.apiKey);

    const prompt = `Analyze this codebase and infer the key Architecture Decision Records (ADRs).
Reverse-engineer WHY certain patterns and technologies were chosen based on code evidence.

CODEBASE MODEL:
Components: ${JSON.stringify(codeModel.components || [])}
Classes: ${JSON.stringify(codeModel.classes || [])}
Endpoints: ${JSON.stringify(codeModel.endpoints || [])}
Architecture: ${JSON.stringify(codeModel.architecture || {})}
DB Models: ${JSON.stringify(codeModel.dbModels || [])}
External APIs: ${JSON.stringify(codeModel.externalApis || [])}

Generate 3-6 ADRs. Return a JSON object:
{
  "adrs": [
    {
      "id": "ADR-001",
      "title": "Use [Technology/Pattern] for [Purpose]",
      "status": "Accepted",
      "date": "Inferred",
      "context": "The problem or requirement that led to this decision",
      "decision": "What was decided and why",
      "consequences": ["positive consequence 1", "negative consequence 2"],
      "evidence": ["code evidence 1", "code evidence 2"],
      "alternatives": ["rejected alternative 1"]
    }
  ]
}`;

    const response = await llm.send(prompt, 'You are a software architecture expert specializing in ADRs. Return only valid JSON.');
    return JSON.parse(response);
}

/**
 * Feature 7: Cross-Repo Microservices Map
 */
export function computeCrossRepoMap(repoResults) {
    if (!repoResults || repoResults.length < 2) {
        return {
            connections: [],
            sharedDependencies: [],
            diagram: '',
            summary: 'Cross-repo analysis requires 2+ repositories.',
        };
    }

    const connections = [];
    const sharedDeps = new Map();

    // Find shared external APIs
    for (let i = 0; i < repoResults.length; i++) {
        const repoA = repoResults[i];
        const aApis = repoA.rawModel?.externalApis || [];
        const aEndpoints = repoA.rawModel?.endpoints || [];

        for (let j = i + 1; j < repoResults.length; j++) {
            const repoB = repoResults[j];
            const bApis = repoB.rawModel?.externalApis || [];
            const bEndpoints = repoB.rawModel?.endpoints || [];

            // Check if repo A calls an API that repo B exposes (and vice versa)
            for (const api of aApis) {
                for (const endpoint of bEndpoints) {
                    if (
                        api.url?.includes(endpoint.path) ||
                        api.service?.toLowerCase().includes(repoB.overview?.repoName?.toLowerCase() || '')
                    ) {
                        connections.push({
                            from: repoA.overview?.repoName,
                            to: repoB.overview?.repoName,
                            type: 'api-call',
                            detail: `${api.service || api.url} → ${endpoint.method} ${endpoint.path}`,
                        });
                    }
                }
            }

            for (const api of bApis) {
                for (const endpoint of aEndpoints) {
                    if (
                        api.url?.includes(endpoint.path) ||
                        api.service?.toLowerCase().includes(repoA.overview?.repoName?.toLowerCase() || '')
                    ) {
                        connections.push({
                            from: repoB.overview?.repoName,
                            to: repoA.overview?.repoName,
                            type: 'api-call',
                            detail: `${api.service || api.url} → ${endpoint.method} ${endpoint.path}`,
                        });
                    }
                }
            }

            // Check shared DB models
            const aModels = (repoA.rawModel?.dbModels || []).map((m) => m.name?.toLowerCase());
            const bModels = (repoB.rawModel?.dbModels || []).map((m) => m.name?.toLowerCase());
            const sharedModels = aModels.filter((m) => m && bModels.includes(m));
            if (sharedModels.length > 0) {
                connections.push({
                    from: repoA.overview?.repoName,
                    to: repoB.overview?.repoName,
                    type: 'shared-db',
                    detail: `Shared models: ${sharedModels.join(', ')}`,
                });
            }
        }

        // Track shared external dependencies
        for (const api of aApis) {
            const key = api.service || api.url || 'unknown';
            if (!sharedDeps.has(key)) sharedDeps.set(key, []);
            sharedDeps.get(key).push(repoA.overview?.repoName);
        }
    }

    // Find deps used by 2+ repos
    const sharedDependencies = [...sharedDeps.entries()]
        .filter(([, repos]) => repos.length > 1)
        .map(([dep, repos]) => ({ dependency: dep, usedBy: repos }));

    // Generate Mermaid diagram
    let diagram = 'graph TD\n';
    repoResults.forEach((r, i) => {
        const name = r.overview?.repoName || `Repo${i}`;
        const safeId = `repo_${i}`;
        diagram += `    ${safeId}(("🏠 ${name}"))\n`;
        diagram += `    style ${safeId} fill:#3498DB,stroke:#2980B9,color:#fff\n`;
    });

    connections.forEach((c, i) => {
        const fromIdx = repoResults.findIndex((r) => r.overview?.repoName === c.from);
        const toIdx = repoResults.findIndex((r) => r.overview?.repoName === c.to);
        if (fromIdx >= 0 && toIdx >= 0) {
            const label = c.type === 'api-call' ? 'API Call' : 'Shared DB';
            diagram += `    repo_${fromIdx} -- "${label}" --> repo_${toIdx}\n`;
        }
    });

    sharedDependencies.forEach((sd, i) => {
        const depId = `dep_${i}`;
        diagram += `    ${depId}["🌐 ${sd.dependency}"]\n`;
        diagram += `    style ${depId} fill:#9B59B6,stroke:#8E44AD,color:#fff\n`;
        sd.usedBy.forEach((repo) => {
            const idx = repoResults.findIndex((r) => r.overview?.repoName === repo);
            if (idx >= 0) diagram += `    repo_${idx} --> ${depId}\n`;
        });
    });

    return {
        connections,
        sharedDependencies,
        diagram,
        summary: `Found ${connections.length} connection(s) and ${sharedDependencies.length} shared dependency(ies) across ${repoResults.length} repos.`,
    };
}
