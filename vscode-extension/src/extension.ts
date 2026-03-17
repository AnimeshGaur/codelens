import * as vscode from 'vscode';
import { CodeLensPanel } from './panel/CodeLensPanel';

export function activate(context: vscode.ExtensionContext) {
    // Command: Analyze current workspace root
    const analyzeWorkspaceCmd = vscode.commands.registerCommand(
        'codelens.analyzeWorkspace',
        async () => {
            const folders = vscode.workspace.workspaceFolders;
            if (!folders || folders.length === 0) {
                vscode.window.showErrorMessage('CodeLens: No workspace folder is open. Please open a project first.');
                return;
            }

            const targetUri = folders.length === 1
                ? folders[0].uri
                : await pickWorkspaceFolder(folders);

            if (!targetUri) { return; }

            const panel = CodeLensPanel.createOrShow(context.extensionUri);
            await panel.analyzeUri(targetUri);
        }
    );

    // Command: Analyze a specific folder (from Explorer context menu or dialog)
    const analyzeFolderCmd = vscode.commands.registerCommand(
        'codelens.analyzeFolder',
        async (uri?: vscode.Uri) => {
            let targetUri = uri;

            if (!targetUri) {
                const picked = await vscode.window.showOpenDialog({
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    openLabel: 'Analyze This Folder',
                });
                if (!picked || picked.length === 0) { return; }
                targetUri = picked[0];
            }

            const panel = CodeLensPanel.createOrShow(context.extensionUri);
            await panel.analyzeUri(targetUri);
        }
    );

    context.subscriptions.push(analyzeWorkspaceCmd, analyzeFolderCmd);
}

async function pickWorkspaceFolder(
    folders: readonly vscode.WorkspaceFolder[]
): Promise<vscode.Uri | undefined> {
    const items = folders.map(f => ({ label: f.name, description: f.uri.fsPath, uri: f.uri }));
    const picked = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a workspace folder to analyze',
    });
    return picked?.uri;
}

export function deactivate() {
    // Nothing to clean up
}
