/**
 * Simple in-memory rate limiter — zero dependencies.
 *
 * Uses a sliding-window token bucket per IP address.
 *
 * Usage:
 *   app.use('/api', rateLimit({ windowMs: 60_000, max: 60 }));
 */

/**
 * @param {object} options
 * @param {number} options.windowMs  Window duration in ms (default: 60 seconds)
 * @param {number} options.max       Max requests per window per IP (default: 60)
 * @param {string} options.message   Error message (default: 'Too many requests')
 */
export function rateLimit({ windowMs = 60_000, max = 60, message = 'Too many requests, please try again later' } = {}) {
    const hits = new Map(); // IP → { count, resetTime }

    // Periodic cleanup of expired entries
    setInterval(() => {
        const now = Date.now();
        for (const [ip, entry] of hits) {
            if (now > entry.resetTime) hits.delete(ip);
        }
    }, windowMs).unref(); // .unref() so it doesn't keep the process alive

    return (req, res, next) => {
        const ip = req.ip || req.socket?.remoteAddress || 'unknown';
        const now = Date.now();

        let entry = hits.get(ip);
        if (!entry || now > entry.resetTime) {
            entry = { count: 0, resetTime: now + windowMs };
            hits.set(ip, entry);
        }

        entry.count++;

        // Set standard rate-limit headers
        res.set('X-RateLimit-Limit', String(max));
        res.set('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));
        res.set('X-RateLimit-Reset', String(Math.ceil(entry.resetTime / 1000)));

        if (entry.count > max) {
            res.set('Retry-After', String(Math.ceil((entry.resetTime - now) / 1000)));
            return res.status(429).json({
                error: 'Too Many Requests',
                message,
                retryAfter: Math.ceil((entry.resetTime - now) / 1000),
                statusCode: 429,
            });
        }

        next();
    };
}
