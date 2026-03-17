import * as vscode from 'vscode';

/**
 * Copilot LLM Provider using vscode.lm API.
 * Implements the same interface as the server-side providers:
 *   send(prompt: string, systemPrompt?: string) → Promise<string>
 */
export class CopilotProvider {
    private model: vscode.LanguageModelChat | null = null;

    get name() { return 'copilot'; }

    async init(): Promise<void> {
        const models = await vscode.lm.selectChatModels({
            vendor: 'copilot',
            family: 'gpt-4o',
        });

        if (models.length === 0) {
            // Fallback: try any available Copilot model
            const fallback = await vscode.lm.selectChatModels({ vendor: 'copilot' });
            if (fallback.length === 0) {
                throw new Error(
                    'No GitHub Copilot language model found. Make sure GitHub Copilot Chat is installed and you are signed in.'
                );
            }
            this.model = fallback[0];
        } else {
            this.model = models[0];
        }
    }

    get modelName(): string {
        return this.model?.name ?? 'copilot';
    }

    /**
     * Send a prompt to Copilot and stream the response to a full string.
     */
    async send(prompt: string, systemPrompt?: string): Promise<string> {
        if (!this.model) {
            await this.init();
        }

        const messages: vscode.LanguageModelChatMessage[] = [];

        if (systemPrompt) {
            messages.push(vscode.LanguageModelChatMessage.User(systemPrompt));
            messages.push(vscode.LanguageModelChatMessage.Assistant(
                'Understood. I will follow those instructions exactly.'
            ));
        }

        messages.push(vscode.LanguageModelChatMessage.User(prompt));

        const token = new vscode.CancellationTokenSource().token;
        const response = await this.model!.sendRequest(messages, {}, token);

        let fullText = '';
        for await (const chunk of response.text) {
            fullText += chunk;
        }
        return fullText;
    }
}
