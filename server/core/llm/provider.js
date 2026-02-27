import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Factory that creates a unified LLM client, regardless of backend.
 * All providers expose the same interface: send(prompt, systemPrompt?) → string
 */

/**
 * Create an LLM provider instance.
 * @param {string} providerName  'gemini' | 'openai' | 'anthropic' | 'groq'
 * @param {string} model         Model identifier
 * @returns {{ send: (prompt: string, systemPrompt?: string) => Promise<string> }}
 */
export function createProvider(providerName, model, apiKey) {
  switch (providerName) {
    case 'gemini':
      return createGeminiProvider(model, apiKey);
    case 'openai':
      return createOpenAIProvider(model, apiKey);
    case 'anthropic':
      return createAnthropicProvider(model, apiKey);
    case 'groq':
      return createGroqProvider(model, apiKey);
    case 'ollama':
      return createOllamaProvider(model);
    default:
      throw new Error(
        `Unknown LLM provider: ${providerName}. Supported: gemini, openai, anthropic, groq, ollama`,
      );
  }
}

function createGeminiProvider(model, userKey) {
  const apiKey = userKey || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is required');

  const genAI = new GoogleGenerativeAI(apiKey);

  return {
    name: 'gemini',
    model,
    async send(prompt, systemPrompt = '') {
      const generativeModel = genAI.getGenerativeModel({
        model,
        systemInstruction: systemPrompt || undefined,
      });

      const result = await generativeModel.generateContent(prompt);
      return result.response.text();
    },
  };
}

function createOpenAIProvider(model, userKey) {
  const apiKey = userKey || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY environment variable is required');

  const client = new OpenAI({ apiKey });

  return {
    name: 'openai',
    model,
    async send(prompt, systemPrompt = '') {
      const messages = [];
      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
      messages.push({ role: 'user', content: prompt });

      const response = await client.chat.completions.create({
        model,
        messages,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });

      return response.choices[0].message.content;
    },
  };
}

function createAnthropicProvider(model, userKey) {
  const apiKey = userKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable is required');

  const client = new Anthropic({ apiKey });

  return {
    name: 'anthropic',
    model,
    async send(prompt, systemPrompt = '') {
      const response = await client.messages.create({
        model,
        max_tokens: 8192,
        system: systemPrompt || undefined,
        messages: [{ role: 'user', content: prompt }],
      });

      return response.content[0].text;
    },
  };
}

function createGroqProvider(model, userKey) {
  const apiKey = userKey || process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY environment variable is required');

  const client = new OpenAI({
    apiKey,
    baseURL: 'https://api.groq.com/openai/v1',
  });

  return {
    name: 'groq',
    model,
    async send(prompt, systemPrompt = '') {
      const messages = [];
      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
      messages.push({ role: 'user', content: prompt });

      const response = await client.chat.completions.create({
        model,
        messages,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });

      return response.choices[0].message.content;
    },
  };
}

function createOllamaProvider(model) {
  const ollamaModel = model || 'qwen2.5-coder';
  const baseURL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';

  const client = new OpenAI({
    apiKey: 'ollama',   // Ollama doesn't need a real key but the SDK requires one
    baseURL,
  });

  return {
    name: 'ollama',
    model: ollamaModel,
    async send(prompt, systemPrompt = '') {
      const messages = [];
      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
      messages.push({ role: 'user', content: prompt });

      const response = await client.chat.completions.create({
        model: ollamaModel,
        messages,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });

      return response.choices[0].message.content;
    },
  };
}
