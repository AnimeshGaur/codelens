/**
 * Factory that creates a unified LLM client, regardless of backend.
 * All providers expose the same interface: send(prompt, systemPrompt?) → string
 */

import { Ollama } from 'ollama';

export function createProvider(providerName, model, apiKey, options = {}) {
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
      return createOllamaProvider(model, options);
    default:
      throw new Error(
        `Unknown LLM provider: ${providerName}. Supported: gemini, openai, anthropic, groq, ollama`,
      );
  }
}

// ─── Shared OpenAI-Compatible Fetcher (OpenAI, Groq, Ollama) ─────────────────

async function openAiCompatibleFetch(url, apiKey, model, prompt, systemPrompt = '') {
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey && apiKey !== 'ollama') {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LLM API Error (${model}): ${response.status} - ${errText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// ─── Individual Native Providers ─────────────────────────────────────────────

function createOpenAIProvider(model, userKey) {
  const apiKey = userKey || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY environment variable is required');
  return {
    name: 'openai',
    model,
    send: (p, sp) => openAiCompatibleFetch('https://api.openai.com/v1/chat/completions', apiKey, model, p, sp)
  };
}

function createGroqProvider(model, userKey) {
  const apiKey = userKey || process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY environment variable is required');
  return {
    name: 'groq',
    model,
    send: (p, sp) => openAiCompatibleFetch('https://api.groq.com/openai/v1/chat/completions', apiKey, model, p, sp)
  };
}

function createOllamaProvider(model, options = {}) {
  const ollamaModel = options.ollamaModel || model || 'gemma3n';
  const baseURL = options.ollamaBaseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';

  // Extract host from baseURL since UI might send /v1
  const host = baseURL.replace(/\/v1\/?$/, '');
  const ollama = new Ollama({ host });

  return {
    name: 'ollama',
    model: ollamaModel,
    async send(p, sp) {
      const messages = [];
      if (sp) messages.push({ role: 'system', content: sp });
      messages.push({ role: 'user', content: p });

      let fullResponse = '';
      const response = await ollama.chat({
        model: ollamaModel,
        messages: messages,
        stream: true,
      });

      for await (const part of response) {
        fullResponse += part.message.content;
      }
      return fullResponse;
    }
  };
}

function createAnthropicProvider(model, userKey) {
  const apiKey = userKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable is required');

  return {
    name: 'anthropic',
    model,
    async send(prompt, systemPrompt = '') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model,
          max_tokens: 8192,
          system: systemPrompt || undefined,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Anthropic API Error: ${response.status} - ${errText}`);
      }

      const data = await response.json();
      return data.content[0].text;
    }
  };
}

function createGeminiProvider(model, userKey) {
  const apiKey = userKey || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is required');

  return {
    name: 'gemini',
    model,
    async send(prompt, systemPrompt = '') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const payload = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json"
        }
      };

      if (systemPrompt) {
        payload.systemInstruction = {
          parts: [{ text: systemPrompt }]
        };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API Error: ${response.status} - ${errText}`);
      }

      const data = await response.json();
      // Gemini's response structure
      return data.candidates[0].content.parts[0].text;
    }
  };
}
