import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { analyzeRoute } from './routes/analyze.js';
import { featuresRoute } from './routes/features.js';
import { notFoundHandler, errorHandler } from './core/errors.js';
import { logger } from './core/logger.js';
import { rateLimit } from './core/rate-limit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Request logging
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(`${req.method} ${req.originalUrl} ${res.statusCode}`, { duration: `${duration}ms` });
    });
    next();
});

// Rate limiting
app.use('/api/analyze', rateLimit({ windowMs: 60_000, max: 5, message: 'Analysis rate limited — max 5 per minute' }));
app.use('/api', rateLimit({ windowMs: 60_000, max: 60 }));

// API routes
app.use('/api', analyzeRoute);
app.use('/api', featuresRoute);

// Serve React build in production
const clientBuild = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientBuild));
app.get('*', (req, res, next) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(clientBuild, 'index.html'));
    } else {
        next();
    }
});

// Error handling (must be registered AFTER routes)
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
const server = app.listen(PORT, () => {
    logger.info(`CodeLens API running`, { port: PORT, url: `http://localhost:${PORT}` });
});

function gracefulShutdown(signal) {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
    // Force exit after 10s
    setTimeout(() => {
        logger.warn('Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { reason: reason?.message || String(reason) });
});
process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { message: err.message, stack: err.stack });
    process.exit(1);
});
