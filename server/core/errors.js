/**
 * Express error-handling middleware.
 *
 * Catches both sync and async errors and returns
 * a consistent JSON error response.
 */

import { ValidationError } from './validation.js';
import { logger } from './logger.js';

/**
 * Async route wrapper — catches promise rejections so they
 * propagate to the error middleware instead of crashing.
 *
 * Usage:
 *   router.post('/foo', asyncHandler(async (req, res) => { ... }));
 */
export function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * 404 handler — must be registered AFTER all routes.
 */
export function notFoundHandler(req, res, _next) {
    res.status(404).json({
        error: 'Not Found',
        message: `No route matches ${req.method} ${req.originalUrl}`,
        statusCode: 404,
    });
}

/**
 * Global error handler — must be registered LAST.
 * Express identifies error handlers by the 4-argument signature (err, req, res, next).
 */
export function errorHandler(err, req, res, _next) {
    // Validation errors → 400
    if (err instanceof ValidationError) {
        logger.warn('Validation error', { field: err.field, message: err.message, path: req.path });
        return res.status(400).json({
            error: 'Validation Error',
            message: err.message,
            field: err.field,
            statusCode: 400,
        });
    }

    // Known operational errors
    if (err.statusCode && err.statusCode < 500) {
        return res.status(err.statusCode).json({
            error: err.name || 'Error',
            message: err.message,
            statusCode: err.statusCode,
        });
    }

    // Unexpected / server errors
    logger.error('Unhandled error', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
    });

    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'production'
            ? 'An unexpected error occurred'
            : err.message,
        statusCode: 500,
    });
}
