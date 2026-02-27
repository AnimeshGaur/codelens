import { useState, useEffect } from 'react';
import Header from './components/Header';
import RepoInput from './components/RepoInput';
import AnalysisProgress from './components/AnalysisProgress';
import DiagramViewer from './components/DiagramViewer';
import TechDocReport from './components/TechDocReport';
import ChatPanel from './components/ChatPanel';
import BlastRadius from './components/BlastRadius';
import DebtHeatmap from './components/DebtHeatmap';
import DriftReport from './components/DriftReport';
import OnboardingStory from './components/OnboardingStory';
import ADRViewer from './components/ADRViewer';
import CrossRepoMap from './components/CrossRepoMap';
import SettingsModal from './components/SettingsModal';
import { useAnalysis } from './hooks/useAnalysis';

const FEATURE_TABS = [
    { key: 'diagrams', label: '📊 Diagrams', alwaysShow: true },
    { key: 'chat', label: '🧠 Ask Codebase' },
    { key: 'blast', label: '💥 Blast Radius' },
    { key: 'heatmap', label: '🌡️ Debt Heatmap' },
    { key: 'drift', label: '🏗️ Drift Detection' },
    { key: 'onboarding', label: '🧭 Onboarding' },
    { key: 'adrs', label: '📝 ADRs' },
    { key: 'crossrepo', label: '🔗 Cross-Repo', multiOnly: true },
    { key: 'techdoc', label: '📄 Tech Doc' },
];

export default function App() {
    const { analyze, isLoading, steps, results, sessionId, error, reset } = useAnalysis();
    const [activeFeature, setActiveFeature] = useState('diagrams');
    const [provider, setProvider] = useState('ollama');
    const [showSettings, setShowSettings] = useState(false);
    const [apiKeys, setApiKeys] = useState({});

    // Load keys on mount
    useEffect(() => {
        const saved = localStorage.getItem('codelens_api_keys');
        if (saved) {
            try {
                setApiKeys(JSON.parse(saved));
            } catch (e) {
                console.error(e);
            }
        }
    }, [showSettings]); // Reload when settings close (saved)

    const hasResults = results && results.repos && results.repos.length > 0;
    const isMultiRepo = hasResults && results.repos.length > 1;

    // Merge diagrams from all repos
    const mergedDiagrams = hasResults
        ? results.repos.reduce((acc, repo) => {
            if (!repo.diagrams) return acc;
            Object.keys(repo.diagrams).forEach((key) => {
                acc[key] = acc[key] ? acc[key] + '\n' + repo.diagrams[key] : repo.diagrams[key];
            });
            return acc;
        }, {})
        : null;

    // Merge rawModel (components, classes, etc.) across repos
    const mergedRawModel = hasResults
        ? results.repos.reduce((acc, repo) => {
            if (!repo.rawModel) return acc;
            acc.components = [...(acc.components || []), ...(repo.rawModel.components || [])];
            acc.classes = [...(acc.classes || []), ...(repo.rawModel.classes || [])];
            return acc;
        }, {})
        : null;

    // Merge importGraph edges across repos
    const mergedImportGraph = hasResults
        ? results.repos.reduce((acc, repo) => {
            if (!repo.importGraph) return acc;
            acc.edges = [...(acc.edges || []), ...(repo.importGraph.edges || [])];
            acc.nodes = [...(acc.nodes || []), ...(repo.importGraph.nodes || [])];
            return acc;
        }, { edges: [], nodes: [] })
        : null;

    // Aggregate stats
    const totalStats = hasResults
        ? results.repos.reduce(
            (acc, repo) => {
                if (!repo.overview) return acc;
                const s = repo.overview.stats || {};
                acc.files += repo.overview.fileCount || 0;
                acc.components += s.components || 0;
                acc.classes += s.classes || 0;
                acc.dbModels += s.dbModels || 0;
                acc.endpoints += s.endpoints || 0;
                acc.externalApis += s.externalApis || 0;
                acc.flows += s.flows || 0;
                return acc;
            },
            { files: 0, components: 0, classes: 0, dbModels: 0, endpoints: 0, externalApis: 0, flows: 0 },
        )
        : null;

    // Get all component names for blast radius selector
    const componentNames = hasResults
        ? [...new Set(results.repos.flatMap((r) => (r.rawModel?.components || []).map((c) => c.name || c.module).filter(Boolean)))]
        : [];

    const handleAnalyze = (repos, prov) => {
        setProvider(prov);
        // Use the key for the selected provider
        const key = apiKeys[prov] || '';
        analyze(repos, prov, key);
    };

    return (
        <>
            <Header onSettingsClick={() => setShowSettings(true)} />
            <main className="main">
                {/* Phase 1: Input */}
                {!hasResults && !isLoading && <RepoInput onAnalyze={handleAnalyze} isLoading={isLoading} />}

                {/* Error */}
                {error && !isLoading && <div className="error-box">✗ {error}</div>}

                {/* Phase 2: Progress */}
                {isLoading && <AnalysisProgress steps={steps} />}

                {/* Phase 3: Results */}
                {hasResults && (
                    <section className="results-section">
                        <div className="results-header">
                            <h2>
                                Analysis Complete — {results.repos.map((r) => r.overview?.repoName).join(', ')}
                            </h2>
                            <button className="btn-new" onClick={reset}>← New Analysis</button>
                        </div>

                        {/* Stats */}
                        {totalStats && (
                            <div className="stats-grid">
                                {Object.entries(totalStats).map(([key, val]) => (
                                    <div key={key} className="stat-card">
                                        <div className="stat-value">{val}</div>
                                        <div className="stat-label">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Feature Tabs */}
                        <div className="feature-tabs">
                            {FEATURE_TABS.filter((t) => !t.multiOnly || isMultiRepo).map((tab) => (
                                <button
                                    key={tab.key}
                                    className={`feature-tab ${activeFeature === tab.key ? 'active' : ''}`}
                                    onClick={() => setActiveFeature(tab.key)}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Feature Panels */}
                        <div className="feature-content">
                            {activeFeature === 'diagrams' && mergedDiagrams && (
                                <DiagramViewer
                                    diagrams={mergedDiagrams}
                                    rawModel={mergedRawModel}
                                    importGraph={mergedImportGraph}
                                />
                            )}
                            {activeFeature === 'chat' && <ChatPanel sessionId={sessionId} provider={provider} />}
                            {activeFeature === 'blast' && <BlastRadius sessionId={sessionId} provider={provider} components={componentNames} />}
                            {activeFeature === 'heatmap' && <DebtHeatmap sessionId={sessionId} provider={provider} />}
                            {activeFeature === 'drift' && <DriftReport sessionId={sessionId} provider={provider} />}
                            {activeFeature === 'onboarding' && <OnboardingStory sessionId={sessionId} provider={provider} />}
                            {activeFeature === 'adrs' && <ADRViewer sessionId={sessionId} provider={provider} />}
                            {activeFeature === 'crossrepo' && <CrossRepoMap sessionId={sessionId} />}
                            {activeFeature === 'techdoc' && <TechDocReport results={results.repos} />}
                        </div>
                    </section>
                )}
            </main>

            <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
        </>
    );
}
