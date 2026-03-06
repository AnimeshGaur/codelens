/**
 * Lightweight request validation helpers.
 * No external dependencies — uses plain JS for schema checks.
 *
 * Usage:
 *   validate(req.body, {
 *     sessionId: { type: 'string', required: true },
 *     provider:  { type: 'string', oneOf: ['gemini','openai','anthropic','groq','ollama'] },
 *     question:  { type: 'string', required: true, minLength: 1 },
 *   });
 *   // Throws ValidationError on failure
 */

export class ValidationError extends Error {
    constructor(message, field) {
        super(message);
        this.name = 'ValidationError';
        this.field = field;
        this.statusCode = 400;
    }
}

/**
 * Validate an object against a schema.
 * @param {object} data   The request body (or query, params, etc.)
 * @param {object} schema Map of field → rules
 * @throws {ValidationError}
 */
export function validate(data, schema) {
    if (!data || typeof data !== 'object') {
        throw new ValidationError('Request body must be a JSON object');
    }

    for (const [field, rules] of Object.entries(schema)) {
        const value = data[field];

        // Required check
        if (rules.required && (value === undefined || value === null || value === '')) {
            throw new ValidationError(`'${field}' is required`, field);
        }

        // Skip further checks if value is absent and not required
        if (value === undefined || value === null) continue;

        // Type check
        if (rules.type === 'string' && typeof value !== 'string') {
            throw new ValidationError(`'${field}' must be a string`, field);
        }
        if (rules.type === 'number' && typeof value !== 'number') {
            throw new ValidationError(`'${field}' must be a number`, field);
        }
        if (rules.type === 'boolean' && typeof value !== 'boolean') {
            throw new ValidationError(`'${field}' must be a boolean`, field);
        }
        if (rules.type === 'array' && !Array.isArray(value)) {
            throw new ValidationError(`'${field}' must be an array`, field);
        }

        // String constraints
        if (typeof value === 'string') {
            if (rules.minLength !== undefined && value.trim().length < rules.minLength) {
                throw new ValidationError(`'${field}' must be at least ${rules.minLength} character(s)`, field);
            }
            if (rules.maxLength !== undefined && value.length > rules.maxLength) {
                throw new ValidationError(`'${field}' must be at most ${rules.maxLength} characters`, field);
            }
        }

        // Array constraints
        if (Array.isArray(value)) {
            if (rules.minLength !== undefined && value.length < rules.minLength) {
                throw new ValidationError(`'${field}' must have at least ${rules.minLength} item(s)`, field);
            }
        }

        // Enum
        if (rules.oneOf && !rules.oneOf.includes(value)) {
            throw new ValidationError(`'${field}' must be one of: ${rules.oneOf.join(', ')}`, field);
        }
    }
}

/**
 * Schema definitions for all API endpoints.
 */
export const SCHEMAS = {
    analyze: {
        repos: { type: 'array', required: true, minLength: 1 },
        provider: { type: 'string', oneOf: ['gemini', 'openai', 'anthropic', 'groq', 'ollama'] },
        model: { type: 'string' },
        apiKey: { type: 'string' },
    },
    chat: {
        sessionId: { type: 'string', required: true },
        question: { type: 'string', required: true, minLength: 1 },
        provider: { type: 'string', oneOf: ['gemini', 'openai', 'anthropic', 'groq', 'ollama'] },
    },
    blastRadius: {
        sessionId: { type: 'string', required: true },
        component: { type: 'string', required: true, minLength: 1 },
        provider: { type: 'string', oneOf: ['gemini', 'openai', 'anthropic', 'groq', 'ollama'] },
    },
    sessionOnly: {
        sessionId: { type: 'string', required: true },
        provider: { type: 'string', oneOf: ['gemini', 'openai', 'anthropic', 'groq', 'ollama'] },
    },
    crossRepo: {
        sessionId: { type: 'string', required: true },
    },
};
