import { discoverFiles, createBatches } from '../core/discovery.js';
import { createProvider } from '../core/llm/provider.js';
import { Analyzer } from '../core/llm/analyzer.js';
import { AnalysisCache } from '../core/cache.js';
import { MODEL_DEFAULTS } from '../core/config.js';
import { aggregateResults } from '../core/aggregator.js';
import { buildImportGraph, enrichComponentsWithImports } from '../core/import-graph.js';
import { generateComponentDiagram } from '../core/generators/component-diagram.js';
import { generateClassDiagram } from '../core/generators/class-diagram.js';
import { generateDbDiagram } from '../core/generators/db-diagram.js';
import { generateEndpointDiagram } from '../core/generators/endpoint-diagram.js';
import { generateExternalApiDiagram } from '../core/generators/external-api-diagram.js';
import { generateFlowDiagram } from '../core/generators/flow-diagram.js';
import { generateArchitectureDiagram } from '../core/generators/architecture-diagram.js';
import { generateArchitectureJSON } from '../core/generators/architecture-json.js';

/**
 * Run the full analysis pipeline on a cloned repo path.
 * @param {string} repoPath   Path to the cloned repo
 * @param {string} repoName   Display name (owner/repo)
 * @param {object} options     { provider, model }
 * @param {function} emit      SSE progress callback: (event, data) => void
 * @returns {object} Full analysis result with diagrams
 */
export async function analyzeRepo(repoPath, repoName, options, emit) {
    const provider = options.provider || 'groq';
    const model = options.model || MODEL_DEFAULTS[provider] || MODEL_DEFAULTS.groq;

    // 1. Discover files
    emit('progress', { step: 'discover', message: `Discovering files in ${repoName}...` });
    const files = await discoverFiles(repoPath, {
        exclude: ['node_modules/', 'vendor/', 'dist/', 'build/', '__pycache__/', '.git/', '.codelens-cache/'],
        include: [],
        maxFileSize: 50000,
    });
    emit('progress', { step: 'discover', message: `Found ${files.length} source files`, done: true });

    if (files.length === 0) {
        return { repoName, error: 'No source files found', diagrams: {} };
    }

    // 1b. Static import graph (zero LLM — runs immediately on discovered files)
    emit('progress', { step: 'import-graph', message: 'Building static import graph...' });
    const importGraph = await buildImportGraph(files, repoPath);
    emit('progress', {
        step: 'import-graph',
        message: `Import graph: ${importGraph.stats.relativeEdges} file edges, ${importGraph.stats.externalEdges} external packages`,
        done: true,
    });

    // 2. Batch files
    const batches = createBatches(files);
    emit('progress', { step: 'batch', message: `Created ${batches.length} batch(es)`, done: true });

    // 3. LLM analysis
    emit('progress', { step: 'analyze', message: `Analyzing ${files.length} files with ${provider}...` });
    const llm = createProvider(provider, model, options.apiKey, {
        ollamaBaseUrl: options.ollamaBaseUrl,
        ollamaModel: options.ollamaModel,
    });
    const cache = new AnalysisCache(repoPath);
    await cache.init();
    const analyzer = new Analyzer(llm, cache);

    const batchResults = await analyzer.analyzeAll(batches, files, (batchIdx, totalBatches, errMessage) => {
        if (errMessage) {
            emit('progress', {
                step: 'analyze',
                message: `Batch ${batchIdx} failed: ${errMessage}`,
                warning: true,
            });
        } else {
            emit('progress', {
                step: 'analyze',
                message: `Analyzing batch ${batchIdx}/${totalBatches}...`,
                batch: batchIdx,
                total: totalBatches,
            });
        }
    });

    emit('progress', { step: 'analyze', message: 'LLM analysis complete', done: true });

    // 4. Aggregate
    emit('progress', { step: 'aggregate', message: 'Aggregating results...' });
    const model_data = aggregateResults(batchResults);
    emit('progress', { step: 'aggregate', message: 'Aggregation complete', done: true });

    // Enrich components with precise static import edges
    const enrichedComponents = enrichComponentsWithImports(importGraph, model_data.components || []);
    model_data.components = enrichedComponents;

    // 5. Generate diagrams
    emit('progress', { step: 'diagrams', message: 'Generating diagrams...' });
    const diagrams = {
        component: generateComponentDiagram(model_data.components || []),
        class: generateClassDiagram(model_data.classes || []),
        database: generateDbDiagram(model_data.database || {}),
        endpoints: generateEndpointDiagram(model_data.endpoints || []),
        externalApis: generateExternalApiDiagram(model_data.externalAPIs || []),
        flows: generateFlowDiagram(model_data.dependencyFlows || []),
        architecture: generateArchitectureDiagram(model_data.architecture || {}, model_data),
    };
    model_data.architectureFlow = generateArchitectureJSON(model_data.architecture || {}, model_data);

    emit('progress', { step: 'diagrams', message: 'All 7 diagrams generated', done: true });

    // 6. Build overview
    const overview = {
        repoName,
        fileCount: files.length,
        batchCount: batches.length,
        languages: [...new Set(files.map((f) => f.language).filter(Boolean))],
        stats: {
            components: model_data.components?.length || 0,
            classes: model_data.classes?.length || 0,
            dbModels: model_data.database?.models?.length || 0,
            endpoints: model_data.endpoints?.length || 0,
            externalApis: model_data.externalAPIs?.length || 0,
            flows: model_data.dependencyFlows?.length || 0,
        },
        architecture: model_data.architecture || {},
    };

    return { overview, diagrams, rawModel: model_data, importGraph };
}
