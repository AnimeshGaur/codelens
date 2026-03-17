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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const CodeLensPanel_1 = require("./panel/CodeLensPanel");
function activate(context) {
    // Command: Analyze current workspace root
    const analyzeWorkspaceCmd = vscode.commands.registerCommand('codelens.analyzeWorkspace', async () => {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            vscode.window.showErrorMessage('CodeLens: No workspace folder is open. Please open a project first.');
            return;
        }
        const targetUri = folders.length === 1
            ? folders[0].uri
            : await pickWorkspaceFolder(folders);
        if (!targetUri) {
            return;
        }
        const panel = CodeLensPanel_1.CodeLensPanel.createOrShow(context.extensionUri);
        await panel.analyzeUri(targetUri);
    });
    // Command: Analyze a specific folder (from Explorer context menu or dialog)
    const analyzeFolderCmd = vscode.commands.registerCommand('codelens.analyzeFolder', async (uri) => {
        let targetUri = uri;
        if (!targetUri) {
            const picked = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: 'Analyze This Folder',
            });
            if (!picked || picked.length === 0) {
                return;
            }
            targetUri = picked[0];
        }
        const panel = CodeLensPanel_1.CodeLensPanel.createOrShow(context.extensionUri);
        await panel.analyzeUri(targetUri);
    });
    context.subscriptions.push(analyzeWorkspaceCmd, analyzeFolderCmd);
}
async function pickWorkspaceFolder(folders) {
    const items = folders.map(f => ({ label: f.name, description: f.uri.fsPath, uri: f.uri }));
    const picked = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a workspace folder to analyze',
    });
    return picked?.uri;
}
function deactivate() {
    // Nothing to clean up
}
//# sourceMappingURL=extension.js.map