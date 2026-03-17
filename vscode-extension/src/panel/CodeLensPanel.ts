import * as vscode from 'vscode';
import { discoverFiles, createBatches } from '../core/discovery';
import { Analyzer } from '../core/analyzer';
import { aggregateResults } from '../core/aggregator';
import { CopilotProvider } from '../llm/copilotProvider';
import {
    generateComponentDiagram,
    generateClassDiagram,
    generateDbDiagram,
    generateEndpointDiagram,
    generateArchitectureDiagram,
    generateExternalApiDiagram,
    generateFlowDiagram,
} from '../core/diagrams';

export class CodeLensPanel {
    public static currentPanel: CodeLensPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    static createOrShow(extensionUri: vscode.Uri): CodeLensPanel {
        const column = vscode.window.activeTextEditor ? vscode.ViewColumn.Beside : vscode.ViewColumn.One;

        if (CodeLensPanel.currentPanel) {
            CodeLensPanel.currentPanel._panel.reveal(column);
            return CodeLensPanel.currentPanel;
        }

        const panel = vscode.window.createWebviewPanel(
            'codelens',
            'CodeLens — Copilot Edition',
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            }
        );

        CodeLensPanel.currentPanel = new CodeLensPanel(panel, extensionUri);
        return CodeLensPanel.currentPanel;
    }

    private constructor(panel: vscode.WebviewPanel, private extensionUri: vscode.Uri) {
        this._panel = panel;
        this._panel.webview.html = this._getHtmlContent();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the WebView
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                if (message.type === 'analyze') {
                    await this.analyzeUris([vscode.Uri.file(message.folderPath)]);
                }
            },
            null,
            this._disposables
        );
    }

    /** Analyze one or many workspace folders, emitting per-project results. */
    async analyzeUris(uris: vscode.Uri[]): Promise<void> {
        this._panel.webview.postMessage({ type: 'reset' });
        this._panel.webview.postMessage({
            type: 'init',
            projects: uris.map(u => ({ name: u.fsPath.split('/').pop() || u.fsPath, path: u.fsPath }))
        });

        // Init a single Copilot provider shared across all projects
        const send = (event: string, data: object) =>
            this._panel.webview.postMessage({ type: event, ...data });

        send('progress', { message: 'Connecting to GitHub Copilot...' });
        const provider = new CopilotProvider();
        try {
            await provider.init();
            send('progress', { message: `Connected: ${provider.modelName}`, done: true });
        } catch (err: any) {
            send('error', { message: err.message });
            return;
        }

        for (const uri of uris) {
            await this._runAnalysis(uri, provider, send);
        }

        send('all-complete', {});
    }

    private async _runAnalysis(
        rootUri: vscode.Uri,
        provider: CopilotProvider,
        send: (event: string, data: object) => void
    ): Promise<void> {
        const projectName = rootUri.fsPath.split('/').pop() || rootUri.fsPath;

        send('project-start', { projectPath: rootUri.fsPath, projectName });
        send('progress', { message: `[${projectName}] Discovering files...` });

        try {
            const files = await discoverFiles(rootUri);
            send('progress', { message: `[${projectName}] Found ${files.length} source files`, done: true });

            if (files.length === 0) {
                send('project-complete', {
                    projectPath: rootUri.fsPath,
                    projectName,
                    error: 'No source files found',
                    model: null,
                    diagrams: null,
                });
                return;
            }

            const batches = createBatches(files);
            send('progress', { message: `[${projectName}] ${batches.length} batch(es) queued`, done: true });

            const analyzer = new Analyzer(provider);
            const batchResults = await analyzer.analyzeAll(batches, (current, total, error) => {
                if (error) {
                    send('progress', { message: `[${projectName}] Batch ${current} failed: ${error}`, warning: true });
                } else {
                    send('progress', { message: `[${projectName}] Batch ${current}/${total}...`, batch: current, total });
                }
            });

            send('progress', { message: `[${projectName}] Analysis done ✓`, done: true });

            const model = aggregateResults(batchResults);

            const diagrams = {
                component: generateComponentDiagram(model.components || []),
                class: generateClassDiagram(model.classes || []),
                database: generateDbDiagram(model.database || {}),
                endpoints: generateEndpointDiagram(model.endpoints || []),
                architecture: generateArchitectureDiagram(model.architecture || {}, model),
                externalApis: generateExternalApiDiagram(model.externalAPIs || []),
                flows: generateFlowDiagram(model.dependencyFlows || []),
            };

            send('project-complete', { projectPath: rootUri.fsPath, projectName, model, diagrams });

        } catch (err: any) {
            send('project-complete', {
                projectPath: rootUri.fsPath,
                projectName,
                error: err.message,
                model: null,
                diagrams: null,
            });
        }
    }

    private _getHtmlContent(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CodeLens</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"><\/script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      display: flex; flex-direction: column; min-height: 100vh;
    }
    header {
      padding: 12px 20px;
      background: var(--vscode-sideBar-background);
      border-bottom: 1px solid var(--vscode-panel-border);
      display: flex; align-items: center; gap: 12px;
    }
    header h1 { font-size: 16px; font-weight: 600; }
    header span { font-size: 11px; opacity: 0.55; }

    #main { display: flex; flex: 1; overflow: hidden; }

    /* ── Left sidebar: project list ── */
    #sidebar {
      width: 220px; flex-shrink: 0;
      background: var(--vscode-sideBar-background);
      border-right: 1px solid var(--vscode-panel-border);
      overflow-y: auto; padding: 8px 0;
    }
    #sidebar h3 { font-size: 11px; text-transform: uppercase; letter-spacing: .08em;
      opacity: 0.5; padding: 6px 14px 4px; }
    .proj-btn {
      display: block; width: 100%; text-align: left;
      padding: 8px 14px; font-size: 13px;
      background: none; border: none; color: inherit;
      cursor: pointer; border-left: 3px solid transparent;
      opacity: 0.7; transition: all 0.15s;
    }
    .proj-btn:hover { opacity: 1; background: var(--vscode-list-hoverBackground); }
    .proj-btn.active { opacity: 1; border-left-color: #007acc; font-weight: 600; }
    .proj-btn .status-dot { display: inline-block; width:7px; height:7px;
      border-radius: 50%; margin-right: 6px; background: #555; }
    .proj-btn .status-dot.pending  { background: #555; }
    .proj-btn .status-dot.running  { background: #007acc; animation: pulse 1s infinite; }
    .proj-btn .status-dot.done     { background: #4caf50; }
    .proj-btn .status-dot.error    { background: #f44336; }

    /* ── Right content panel ── */
    #content { flex: 1; overflow-y: auto; }

    #progress-pane {
      padding: 12px 20px;
      background: var(--vscode-editorWidget-background);
      border-bottom: 1px solid var(--vscode-panel-border);
      max-height: 200px; overflow-y: auto;
    }
    .progress-row {
      display: flex; align-items: center; gap: 8px;
      font-size: 12px; padding: 2px 0; animation: fadeIn 0.15s ease;
    }
    .dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
    .dot-active { background:#007acc; animation: pulse 1s infinite; }
    .dot-done { background: #4caf50; }
    .dot-warn { background: #ffa500; }
    .dot-error { background: #f44336; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
    @keyframes fadeIn { from{opacity:0;transform:translateY(3px)} to{opacity:1} }

    /* ── Project result view ── */
    .proj-result { display: none; padding: 20px; }
    .proj-result.active { display: block; }

    .stats-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 10px; margin-bottom: 20px;
    }
    .stat-card {
      background: var(--vscode-sideBar-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px; padding: 12px 14px; text-align: center;
    }
    .stat-card .num { font-size: 26px; font-weight: 700; color: #007acc; }
    .stat-card .label { font-size: 11px; opacity: 0.65; margin-top: 2px; }

    .arch-summary {
      background: var(--vscode-editorWidget-background);
      border-left: 3px solid #007acc;
      border-radius: 4px; padding: 10px 14px;
      font-size: 13px; line-height: 1.6; margin-bottom: 18px; opacity: 0.9;
    }

    .diag-tabs { display: flex; flex-wrap: wrap;
      border-bottom: 1px solid var(--vscode-panel-border); margin-bottom: 16px; }
    .diag-tab {
      padding: 7px 14px; font-size: 12px; cursor: pointer;
      background: none; border: none; color: inherit;
      border-bottom: 2px solid transparent; opacity: 0.6; transition: all 0.15s;
    }
    .diag-tab:hover { opacity: 1; }
    .diag-tab.active { opacity: 1; border-bottom-color: #007acc; }
    .diag-pane { display: none; }
    .diag-pane.active { display: block; }
    .diagram-wrap {
      background: #1e1e2e; border-radius: 8px; padding: 20px;
      overflow: auto; min-height: 180px;
    }
    .mermaid { min-height: 80px; }
    .error-card {
      background: rgba(244,67,54,0.08);
      border: 1px solid #f44336;
      border-radius: 8px; padding: 12px 16px;
      color: #f44336; font-size: 13px; margin-bottom: 16px;
    }
    .placeholder {
      display: flex; align-items: center; justify-content: center;
      height: 200px; opacity: 0.4; font-size: 14px;
    }
  <\/style>
<\/head>
<body>
  <header>
    <div>
      <h1>🔍 CodeLens</h1>
      <span>Copilot Edition</span>
    <\/div>
  <\/header>

  <div id="main">
    <!-- Sidebar -->
    <div id="sidebar">
      <h3>Workspace<\/h3>
      <div id="proj-list"><\/div>
    <\/div>

    <!-- Main content -->
    <div id="content">
      <div id="progress-pane">
        <div id="progress-log"><\/div>
      <\/div>
      <div id="proj-results"><\/div>
    <\/div>
  <\/div>

  <script>
    mermaid.initialize({ startOnLoad: false, theme: 'dark' });
    const vscode = acquireVsCodeApi();

    const projects = {};   // path -> { name, status, data }
    let activeProject = null;

    // ── Helpers ────────────────────────────────────────────────────────────────

    function log(message, opts = {}) {
      const logEl = document.getElementById('progress-log');
      const row = document.createElement('div');
      row.className = 'progress-row';
      const dotCls = opts.done ? 'dot-done' : opts.warning ? 'dot-warn' : opts.error ? 'dot-error' : 'dot-active';
      row.innerHTML = \`<span class="dot \${dotCls}"><\/span><span>\${message}<\/span>\`;
      logEl.appendChild(row);
      logEl.scrollTop = logEl.scrollHeight;
    }

    function setSidebarStatus(path, status) {
      const btn = document.querySelector(\`.proj-btn[data-path="\${CSS.escape(path)}"]\`);
      if (!btn) { return; }
      const dot = btn.querySelector('.status-dot');
      dot.className = \`status-dot \${status}\`;
    }

    function activateProject(path) {
      activeProject = path;
      document.querySelectorAll('.proj-btn').forEach(b => b.classList.remove('active'));
      const btn = document.querySelector(\`.proj-btn[data-path="\${CSS.escape(path)}"]\`);
      if (btn) { btn.classList.add('active'); }
      document.querySelectorAll('.proj-result').forEach(r => r.classList.remove('active'));
      const result = document.getElementById(\`proj-\${path.replace(/[^a-z0-9]/gi, '_')}\`);
      if (result) { result.classList.add('active'); }
    }

    const DIAG_TABS = [
      { key: 'architecture', label: '🏛 Architecture' },
      { key: 'component',    label: '📦 Components' },
      { key: 'class',        label: '🏷 Classes' },
      { key: 'database',     label: '🗄 Database' },
      { key: 'endpoints',    label: '🌐 Endpoints' },
      { key: 'externalApis', label: '🔗 External APIs' },
      { key: 'flows',        label: '🔄 Flows' },
    ];

    async function renderProjectResult(path, name, model, diagrams, error) {
      const el = document.getElementById(\`proj-\${path.replace(/[^a-z0-9]/gi, '_')}\`);
      if (!el) { return; }

      if (error) {
        el.innerHTML = \`<div class="error-card">❌ \${error}<\/div>\`;
        return;
      }

      const stats = [
        { num: model.components?.length || 0, label: 'Components' },
        { num: model.classes?.length || 0,    label: 'Classes' },
        { num: model.database?.models?.length || 0, label: 'DB Models' },
        { num: model.endpoints?.length || 0,  label: 'Endpoints' },
        { num: model.externalAPIs?.length || 0, label: 'Ext APIs' },
        { num: model.dependencyFlows?.length || 0, label: 'Flows' },
      ];

      const safeId = path.replace(/[^a-z0-9]/gi, '_');

      let html = \`<div class="stats-grid">\${stats.map(s =>
        \`<div class="stat-card"><div class="num">\${s.num}<\/div><div class="label">\${s.label}<\/div><\/div>\`
      ).join('')}<\/div>\`;

      html += \`<p class="arch-summary">\${model.architecture?.summary || 'No summary generated.'}<\/p>\`;

      html += \`<div class="diag-tabs" id="tabs-\${safeId}">\${DIAG_TABS.map((t, i) =>
        \`<button class="diag-tab\${i===0?' active':''}" onclick="switchDiag('\${safeId}','\${t.key}',this)">\${t.label}<\/button>\`
      ).join('')}<\/div>\`;

      html += DIAG_TABS.map((t, i) =>
        \`<div class="diag-pane\${i===0?' active':''}" id="pane-\${safeId}-\${t.key}">
           <div class="diagram-wrap"><div class="mermaid">\${diagrams[t.key] || ''}<\/div><\/div>
         <\/div>\`
      ).join('');

      el.innerHTML = html;

      // Render Mermaid diagrams in this result
      await mermaid.run({ nodes: el.querySelectorAll('.mermaid') });
    }

    function switchDiag(safeId, key, btn) {
      document.querySelectorAll(\`#tabs-\${safeId} .diag-tab\`).forEach(t => t.classList.remove('active'));
      document.querySelectorAll(\`[id^="pane-\${safeId}-"]\`).forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(\`pane-\${safeId}-\${key}\`).classList.add('active');
    }

    // ── Message handling ───────────────────────────────────────────────────────

    window.addEventListener('message', async (event) => {
      const msg = event.data;

      if (msg.type === 'reset') {
        document.getElementById('proj-list').innerHTML = '';
        document.getElementById('proj-results').innerHTML = '';
        document.getElementById('progress-log').innerHTML = '';
        Object.keys(projects).forEach(k => delete projects[k]);
        activeProject = null;
      }

      if (msg.type === 'init') {
        for (const proj of msg.projects) {
          projects[proj.path] = { name: proj.name, status: 'pending' };

          // Sidebar button
          const btn = document.createElement('button');
          btn.className = 'proj-btn';
          btn.dataset.path = proj.path;
          btn.innerHTML = \`<span class="status-dot pending"><\/span>\${proj.name}\`;
          btn.onclick = () => activateProject(proj.path);
          document.getElementById('proj-list').appendChild(btn);

          // Result container (placeholder until data arrives)
          const safeId = proj.path.replace(/[^a-z0-9]/gi, '_');
          const div = document.createElement('div');
          div.className = 'proj-result';
          div.id = \`proj-\${safeId}\`;
          div.innerHTML = \`<div class="placeholder">⏳ Waiting for analysis...<\/div>\`;
          document.getElementById('proj-results').appendChild(div);
        }

        // Pre-select first project
        if (msg.projects.length > 0) {
          activateProject(msg.projects[0].path);
        }
      }

      if (msg.type === 'progress') {
        log(msg.message, { done: msg.done, warning: msg.warning, error: msg.error });
      }

      if (msg.type === 'project-start') {
        setSidebarStatus(msg.projectPath, 'running');
        activateProject(msg.projectPath);
      }

      if (msg.type === 'project-complete') {
        setSidebarStatus(msg.projectPath, msg.error ? 'error' : 'done');
        await renderProjectResult(msg.projectPath, msg.projectName, msg.model, msg.diagrams, msg.error);
      }

      if (msg.type === 'all-complete') {
        log('✅ All projects analyzed', { done: true });
        // Hide the progress pane after a short delay
        setTimeout(() => {
          document.getElementById('progress-pane').style.maxHeight = '40px';
          document.getElementById('progress-pane').style.opacity = '0.5';
        }, 2000);
      }
    });
  <\/script>
<\/body>
<\/html>`;
    }

    dispose(): void {
        CodeLensPanel.currentPanel = undefined;
        this._panel.dispose();
        this._disposables.forEach(d => d.dispose());
    }
}
