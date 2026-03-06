import test from 'node:test';
import assert from 'node:assert/strict';
import { validate, ValidationError, SCHEMAS } from '../core/validation.js';

test('validation helper', async (t) => {
    await t.test('passes valid payload', () => {
        const payload = {
            sessionId: '123',
            question: 'What is this?',
            provider: 'openai'
        };
        // Should not throw
        validate(payload, SCHEMAS.chat);
    });

    await t.test('throws on missing required field', () => {
        const payload = { question: 'What is this?' };
        assert.throws(
            () => validate(payload, SCHEMAS.chat),
            (err) => err instanceof ValidationError && err.field === 'sessionId'
        );
    });

    await t.test('throws on invalid enum (oneOf)', () => {
        const payload = {
            sessionId: '123',
            question: 'What is this?',
            provider: 'fake-provider'
        };
        assert.throws(
            () => validate(payload, SCHEMAS.chat),
            (err) => err instanceof ValidationError && err.field === 'provider'
        );
    });

    await t.test('throws on invalid type', () => {
        const payload = {
            repos: 'not-an-array'
        };
        assert.throws(
            () => validate(payload, SCHEMAS.analyze),
            (err) => err instanceof ValidationError && err.field === 'repos'
        );
    });

    await t.test('throws on minLength violation', () => {
        const payload = {
            sessionId: '123',
            question: '' // too short
        };
        assert.throws(
            () => validate(payload, SCHEMAS.chat),
            (err) => err instanceof ValidationError && err.field === 'question'
        );
    });
});
