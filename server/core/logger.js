import fs from 'fs';
import path from 'path';

/**
 * Structured logger — zero dependencies.
 *
 * Outputs JSON lines (structured logs) in production,
 * pretty-prints with colors in development.
 *
 * Usage:
 *   import { logger } from './logger.js';
 *   logger.info('Server started', { port: 3001 });
 *   logger.error('Failed to analyze', { error: err.message, batch: 3 });
 */

const IS_PROD = process.env.NODE_ENV === 'production';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const COLORS = { debug: '\x1b[36m', info: '\x1b[32m', warn: '\x1b[33m', error: '\x1b[31m', reset: '\x1b[0m' };

function formatMessage(level, msg, meta = {}) {
    if (IS_PROD) {
        // Structured JSON for log aggregators (ELK, Datadog, CloudWatch, etc.)
        return JSON.stringify({
            level,
            msg,
            time: new Date().toISOString(),
            ...meta,
        });
    }

    // Dev-friendly colored output
    const color = COLORS[level] || COLORS.reset;
    const ts = new Date().toISOString().slice(11, 23); // HH:mm:ss.SSS
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `${color}[${ts}] ${level.toUpperCase().padEnd(5)}${COLORS.reset} ${msg}${metaStr}`;
}

const logFilePath = path.join(process.cwd(), 'codelens-server.log');

// Async fire-and-forget file writing
function writeToFile(level, msg, meta) {
    const jsonOutput = JSON.stringify({
        level,
        msg,
        time: new Date().toISOString(),
        ...meta,
    }) + '\n';

    // We use appendFile without awaiting to ensure logging doesn't block the event loop
    fs.appendFile(logFilePath, jsonOutput, (err) => {
        if (err && process.env.NODE_ENV !== 'test') {
            console.error('[Logger Error] Failed to write to log file', err);
        }
    });
}

export const logger = {
    debug(msg, meta) {
        console.debug(formatMessage('debug', msg, meta));
        writeToFile('debug', msg, meta);
    },
    info(msg, meta) {
        console.log(formatMessage('info', msg, meta));
        writeToFile('info', msg, meta);
    },
    warn(msg, meta) {
        console.warn(formatMessage('warn', msg, meta));
        writeToFile('warn', msg, meta);
    },
    error(msg, meta) {
        console.error(formatMessage('error', msg, meta));
        writeToFile('error', msg, meta);
    },
};
