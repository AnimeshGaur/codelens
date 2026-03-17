import * as vscode from 'vscode';
import { buildAnalysisPrompt } from './prompts';
import type { DiscoveredFile } from './discovery';
import type { CopilotProvider } from '../llm/copilotProvider';

/**
 * LLM-powered code analyzer.
 * Sends file batches to Copilot and collects structured JSON results.
 */
export class Analyzer {
    private maxRetries = 3;
    private retryDelayMs = 2000;

    constructor(private provider: CopilotProvider) { }

    /**
     * Read a file from VS Code workspace fs and return its text content.
     */
    private async readFile(uri: vscode.Uri): Promise<string> {
        const raw = await vscode.workspace.fs.readFile(uri);
        return new TextDecoder().decode(raw);
    }

    /**
     * Analyze a batch of files via Copilot.
     */
    async analyzeBatch(files: DiscoveredFile[]): Promise<object> {
        const filesWithContent = await Promise.all(
            files.map(async (f) => ({
                relativePath: f.relativePath,
                language: f.language,
                content: await this.readFile(f.uri),
            }))
        );

        const { userPrompt, systemPrompt } = buildAnalysisPrompt(filesWithContent);
        const rawResponse = await this._sendWithRetry(userPrompt, systemPrompt);
        return this._parseJSON(rawResponse);
    }

    /**
     * Analyze all file batches, with progress callback.
     */
    async analyzeAll(
        batches: DiscoveredFile[][],
        onProgress: (current: number, total: number, error?: string) => void
    ): Promise<object[]> {
        const results: object[] = [];
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
            } catch (err: any) {
                onProgress(i + 1, total, err.message);
                // Continue with next batch
            }
        }

        return results;
    }

    private async _sendWithRetry(prompt: string, systemPrompt: string): Promise<string> {
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                return await this.provider.send(prompt, systemPrompt);
            } catch (err: any) {
                lastError = err;
                const delay = this.retryDelayMs * attempt;
                if (attempt < this.maxRetries) {
                    await this._delay(delay);
                }
            }
        }

        throw new Error(`LLM request failed after ${this.maxRetries} retries: ${lastError?.message}`);
    }

    private _parseJSON(raw: string): object {
        let cleaned = raw.trim();

        // Strip markdown code fences if present
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
        }

        try {
            return JSON.parse(cleaned);
        } catch {
            const match = cleaned.match(/\{[\s\S]*\}/);
            if (match) {
                try { return JSON.parse(match[0]); } catch { /* fall through */ }
            }
            throw new Error(`Failed to parse Copilot JSON response. Preview: ${raw.substring(0, 300)}`);
        }
    }

    private _delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
