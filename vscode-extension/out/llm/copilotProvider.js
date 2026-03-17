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
exports.CopilotProvider = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Copilot LLM Provider using vscode.lm API.
 * Implements the same interface as the server-side providers:
 *   send(prompt: string, systemPrompt?: string) → Promise<string>
 */
class CopilotProvider {
    model = null;
    get name() { return 'copilot'; }
    async init() {
        const models = await vscode.lm.selectChatModels({
            vendor: 'copilot',
            family: 'gpt-4o',
        });
        if (models.length === 0) {
            // Fallback: try any available Copilot model
            const fallback = await vscode.lm.selectChatModels({ vendor: 'copilot' });
            if (fallback.length === 0) {
                throw new Error('No GitHub Copilot language model found. Make sure GitHub Copilot Chat is installed and you are signed in.');
            }
            this.model = fallback[0];
        }
        else {
            this.model = models[0];
        }
    }
    get modelName() {
        return this.model?.name ?? 'copilot';
    }
    /**
     * Send a prompt to Copilot and stream the response to a full string.
     */
    async send(prompt, systemPrompt) {
        if (!this.model) {
            await this.init();
        }
        const messages = [];
        if (systemPrompt) {
            messages.push(vscode.LanguageModelChatMessage.User(systemPrompt));
            messages.push(vscode.LanguageModelChatMessage.Assistant('Understood. I will follow those instructions exactly.'));
        }
        messages.push(vscode.LanguageModelChatMessage.User(prompt));
        const token = new vscode.CancellationTokenSource().token;
        const response = await this.model.sendRequest(messages, {}, token);
        let fullText = '';
        for await (const chunk of response.text) {
            fullText += chunk;
        }
        return fullText;
    }
}
exports.CopilotProvider = CopilotProvider;
//# sourceMappingURL=copilotProvider.js.map