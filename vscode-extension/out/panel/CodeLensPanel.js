"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeLensPanel = void 0;
const vscode = __importStar(require("vscode"));
const discovery_1 = require("../core/discovery");
const analyzer_1 = require("../core/analyzer");
const aggregator_1 = require("../core/aggregator");
const copilotProvider_1 = require("../llm/copilotProvider");
const diagrams_1 = require("../core/diagrams");
class CodeLensPanel {
    extensionUri;
    static currentPanel;
    _panel;
    _disposables = [];
    static createOrShow(extensionUri) {
        const column = vscode.window.activeTextEditor ? vscode.ViewColumn.Beside : vscode.ViewColumn.One;
        if (CodeLensPanel.currentPanel) {
            CodeLensPanel.currentPanel._panel.reveal(column);
            return CodeLensPanel.currentPanel;
        }
        const panel = vscode.window.createWebviewPanel('codelens', 'CodeLens — Copilot Edition', column, {
            enableScripts: true,
            retainContextWhenHidden: true,
        });
        CodeLensPanel.currentPanel = new CodeLensPanel(panel, extensionUri);
        return CodeLensPanel.currentPanel;
    }
    constructor(panel, extensionUri) {
        this.extensionUri = extensionUri;
        this._panel = panel;
        this._panel.webview.html = this._getHtmlContent();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        // Handle messages from the WebView
        this._panel.webview.onDidReceiveMessage(async (message) => {
            if (message.type === 'analyze') {
                await this._runAnalysis(vscode.Uri.file(message.folderPath));
            }
        }, null, this._disposables);
    }
    async analyzeUri(uri) {
        await this._runAnalysis(uri);
    }
    async _runAnalysis(rootUri) {
        const send = (event, data) => {
            this._panel.webview.postMessage({ type: event, ...data });
        };
        send('progress', { step: 'start', message: `Starting analysis of ${rootUri.fsPath}...` });
        try {
            // 1. Init Copilot provider
            send('progress', { step: 'llm', message: 'Connecting to GitHub Copilot...' });
            const provider = new copilotProvider_1.CopilotProvider();
            await provider.init();
            send('progress', { step: 'llm', message: `Connected to Copilot model: ${provider.modelName}`, done: true });
            // 2. Discover files
            send('progress', { step: 'discover', message: 'Discovering source files...' });
            const files = await (0, discovery_1.discoverFiles)(rootUri);
            send('progress', { step: 'discover', message: `Found ${files.length} source files`, done: true });
            if (files.length === 0) {
                send('error', { message: 'No source files found in the selected folder.' });
                return;
            }
            // 3. Batch
            const batches = (0, discovery_1.createBatches)(files);
            send('progress', { step: 'batch', message: `Created ${batches.length} batch(es) for analysis`, done: true });
            // 4. Analyze via Copilot
            const analyzer = new analyzer_1.Analyzer(provider);
            const batchResults = await analyzer.analyzeAll(batches, (current, total, error) => {
                if (error) {
                    send('progress', { step: 'analyze', message: `Batch ${current} failed: ${error}`, warning: true });
                }
                else {
                    send('progress', { step: 'analyze', message: `Analyzing batch ${current}/${total}...`, batch: current, total });
                }
            });
            send('progress', { step: 'analyze', message: 'Copilot analysis complete', done: true });
            // 5. Aggregate
            send('progress', { step: 'aggregate', message: 'Aggregating results...' });
            const model = (0, aggregator_1.aggregateResults)(batchResults);
            send('progress', { step: 'aggregate', message: 'Aggregation complete', done: true });
            // 6. Generate diagrams
            send('progress', { step: 'diagrams', message: 'Generating diagrams...' });
            const diagrams = {
                component: (0, diagrams_1.generateComponentDiagram)(model.components || []),
                class: (0, diagrams_1.generateClassDiagram)(model.classes || []),
                database: (0, diagrams_1.generateDbDiagram)(model.database || {}),
                endpoints: (0, diagrams_1.generateEndpointDiagram)(model.endpoints || []),
                architecture: (0, diagrams_1.generateArchitectureDiagram)(model.architecture || {}, model),
                externalApis: (0, diagrams_1.generateExternalApiDiagram)(model.externalAPIs || []),
                flows: (0, diagrams_1.generateFlowDiagram)(model.dependencyFlows || []),
            };
            send('progress', { step: 'diagrams', message: 'All diagrams ready', done: true });
            // 7. Send complete data to WebView
            send('complete', {
                folderPath: rootUri.fsPath,
                model,
                diagrams,
            });
        }
        catch (err) {
            send('error', { message: err.message });
        }
    }
    _getHtmlContent() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CodeLens</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      min-height: 100vh;
    }
    header {
      display: flex; align-items: center; gap: 12px;
      padding: 16px 24px;
      background: var(--vscode-sideBar-background);
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    header h1 { font-size: 18px; font-weight: 600; }
    header span { font-size: 12px; opacity: 0.6; }
    #progress-pane {
      padding: 16px 24px;
      background: var(--vscode-editorWidget-background);
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .progress-row {
      display: flex; align-items: center; gap: 8px;
      font-size: 13px; padding: 3px 0; animation: fadeIn 0.2s ease;
    }
    .progress-row .dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
    .dot-active { background:#007acc; animation: pulse 1s infinite; }
    .dot-done { background: #4caf50; }
    .dot-warn { background: #ffa500; }
    .dot-error { background: #f44336; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    @keyframes fadeIn { from { opacity:0; transform:translateY(4px); } to { opacity:1; } }

    #results { display: none; padding: 24px; }
    #results h2 { font-size: 16px; font-weight: 600; margin-bottom: 16px; }

    .stats-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 12px; margin-bottom: 24px;
    }
    .stat-card {
      background: var(--vscode-sideBar-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px; padding: 14px 16px; text-align: center;
    }
    .stat-card .num { font-size: 28px; font-weight: 700; color: #007acc; }
    .stat-card .label { font-size: 11px; opacity: 0.7; margin-top: 2px; }

    .tabs { display: flex; gap: 0; border-bottom: 1px solid var(--vscode-panel-border); margin-bottom: 20px; flex-wrap: wrap; }
    .tab {
      padding: 8px 16px; font-size: 13px; cursor: pointer;
      border-bottom: 2px solid transparent;
      opacity: 0.65; transition: all 0.15s;
      background: none; border: none; color: inherit;
      border-bottom: 2px solid transparent;
    }
    .tab:hover { opacity: 1; }
    .tab.active { opacity: 1; border-bottom: 2px solid #007acc; }

    .diagram-pane { display: none; }
    .diagram-pane.active { display: block; }

    .diagram-wrap {
      background: #1e1e2e; border-radius: 10px; padding: 20px;
      overflow: auto; min-height: 200px;
    }
    .diagram-wrap .mermaid { min-height: 100px; }

    .arch-summary {
      background: var(--vscode-editorWidget-background);
      border-left: 3px solid #007acc;
      border-radius: 4px; padding: 12px 16px;
      font-size: 13px; line-height: 1.6; margin-bottom: 20px; opacity: 0.9;
    }

    #error-banner {
      display: none; margin: 20px 24px;
      background: rgba(244,67,54,0.1);
      border: 1px solid #f44336;
      border-radius: 8px; padding: 12px 16px;
      color: #f44336; font-size: 13px;
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>🔍 CodeLens</h1>
      <span>Copilot Edition</span>
    </div>
  </header>

  <div id="progress-pane">
    <div id="progress-log"></div>
  </div>

  <div id="error-banner"></div>

  <div id="results">
    <div class="stats-grid" id="stats-grid"></div>
    <p class="arch-summary" id="arch-summary"></p>
    <h2>Diagrams</h2>
    <div class="tabs" id="tabs"></div>
    <div id="diagrams-container"></div>
  </div>

  <script>
    mermaid.initialize({ startOnLoad: false, theme: 'dark' });
    const vscode = acquireVsCodeApi();

    function addProgress(step, message, opts = {}) {
      const log = document.getElementById('progress-log');
      const row = document.createElement('div');
      row.className = 'progress-row';
      const dotClass = opts.done ? 'dot-done' : opts.warning ? 'dot-warn' : opts.error ? 'dot-error' : 'dot-active';
      row.innerHTML = \`<span class="dot \${dotClass}"></span><span>\${message}</span>\`;
      log.appendChild(row);
      log.scrollTop = log.scrollHeight;
    }

    function showError(msg) {
      const banner = document.getElementById('error-banner');
      banner.textContent = '❌ ' + msg;
      banner.style.display = 'block';
    }

    async function renderDiagrams(diagrams) {
      const TABS = [
        { key: 'architecture', label: '🏛 Architecture' },
        { key: 'component',    label: '📦 Components' },
        { key: 'class',        label: '🏷 Classes' },
        { key: 'database',     label: '🗄 Database' },
        { key: 'endpoints',    label: '🌐 Endpoints' },
        { key: 'externalApis', label: '🔗 External APIs' },
        { key: 'flows',        label: '🔄 Flows' },
      ];

      const tabsEl = document.getElementById('tabs');
      const container = document.getElementById('diagrams-container');

      for (let i = 0; i < TABS.length; i++) {
        const { key, label } = TABS[i];
        const btn = document.createElement('button');
        btn.className = 'tab' + (i === 0 ? ' active' : '');
        btn.textContent = label;
        btn.dataset.tab = key;
        btn.onclick = () => {
          document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
          document.querySelectorAll('.diagram-pane').forEach(p => p.classList.remove('active'));
          btn.classList.add('active');
          document.getElementById('pane-' + key).classList.add('active');
        };
        tabsEl.appendChild(btn);

        const pane = document.createElement('div');
        pane.className = 'diagram-pane' + (i === 0 ? ' active' : '');
        pane.id = 'pane-' + key;
        pane.innerHTML = \`<div class="diagram-wrap"><div id="mermaid-\${key}" class="mermaid">\${diagrams[key] || ''}</div></div>\`;
        container.appendChild(pane);
      }

      await mermaid.run({ querySelector: '.mermaid' });
    }

    window.addEventListener('message', async (event) => {
      const msg = event.data;

      if (msg.type === 'progress') {
        addProgress(msg.step, msg.message, { done: msg.done, warning: msg.warning });
      }

      if (msg.type === 'error') {
        addProgress('error', msg.message, { error: true });
        showError(msg.message);
      }

      if (msg.type === 'complete') {
        const { model, diagrams, folderPath } = msg;
        document.getElementById('progress-pane').style.display = 'none';
        document.getElementById('results').style.display = 'block';

        // Stats
        const stats = [
          { num: model.components?.length || 0, label: 'Components' },
          { num: model.classes?.length || 0,    label: 'Classes' },
          { num: model.database?.models?.length || 0, label: 'DB Models' },
          { num: model.endpoints?.length || 0,  label: 'Endpoints' },
          { num: model.externalAPIs?.length || 0, label: 'External APIs' },
          { num: model.dependencyFlows?.length || 0, label: 'Flows' },
        ];
        const grid = document.getElementById('stats-grid');
        grid.innerHTML = stats.map(s =>
          \`<div class="stat-card"><div class="num">\${s.num}</div><div class="label">\${s.label}</div></div>\`
        ).join('');

        // Summary
        const summary = model.architecture?.summary || 'No architectural summary generated.';
        document.getElementById('arch-summary').textContent = summary;

        await renderDiagrams(diagrams);
      }
    });
  </script>
</body>
</html>`;
    }
    dispose() {
        CodeLensPanel.currentPanel = undefined;
        this._panel.dispose();
        this._disposables.forEach(d => d.dispose());
    }
}
exports.CodeLensPanel = CodeLensPanel;
//# sourceMappingURL=CodeLensPanel.js.map