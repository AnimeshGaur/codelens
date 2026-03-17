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
exports.Analyzer = void 0;
const vscode = __importStar(require("vscode"));
const prompts_1 = require("./prompts");
/**
 * LLM-powered code analyzer.
 * Sends file batches to Copilot and collects structured JSON results.
 */
class Analyzer {
    provider;
    maxRetries = 3;
    retryDelayMs = 2000;
    constructor(provider) {
        this.provider = provider;
    }
    /**
     * Read a file from VS Code workspace fs and return its text content.
     */
    async readFile(uri) {
        const raw = await vscode.workspace.fs.readFile(uri);
        return new TextDecoder().decode(raw);
    }
    /**
     * Analyze a batch of files via Copilot.
     */
    async analyzeBatch(files) {
        const filesWithContent = await Promise.all(files.map(async (f) => ({
            relativePath: f.relativePath,
            language: f.language,
            content: await this.readFile(f.uri),
        })));
        const { userPrompt, systemPrompt } = (0, prompts_1.buildAnalysisPrompt)(filesWithContent);
        const rawResponse = await this._sendWithRetry(userPrompt, systemPrompt);
        return this._parseJSON(rawResponse);
    }
    /**
     * Analyze all file batches, with progress callback.
     */
    async analyzeAll(batches, onProgress) {
        const results = [];
        const total = batches.length;
        for (let i = 0; i < batches.length; i++) {
            try {
                onProgress(i + 1, total);
                const result = await this.analyzeBatch(batches[i]);
                results.push(result);
                // Small delay between batches to be respectful to Copilot rate limits
                if (i < batches.length - 1) {
                    await this._delay(800);
                }
            }
            catch (err) {
                onProgress(i + 1, total, err.message);
                // Continue with next batch
            }
        }
        return results;
    }
    async _sendWithRetry(prompt, systemPrompt) {
        let lastError = null;
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                return await this.provider.send(prompt, systemPrompt);
            }
            catch (err) {
                lastError = err;
                const delay = this.retryDelayMs * attempt;
                if (attempt < this.maxRetries) {
                    await this._delay(delay);
                }
            }
        }
        throw new Error(`LLM request failed after ${this.maxRetries} retries: ${lastError?.message}`);
    }
    _parseJSON(raw) {
        let cleaned = raw.trim();
        // Strip markdown code fences if present
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
        }
        try {
            return JSON.parse(cleaned);
        }
        catch {
            const match = cleaned.match(/\{[\s\S]*\}/);
            if (match) {
                try {
                    return JSON.parse(match[0]);
                }
                catch { /* fall through */ }
            }
            throw new Error(`Failed to parse Copilot JSON response. Preview: ${raw.substring(0, 300)}`);
        }
    }
    _delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.Analyzer = Analyzer;
//# sourceMappingURL=analyzer.js.map