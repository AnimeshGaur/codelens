export const logger = {
    info: (message, meta = {}) => {
        if (import.meta.env.DEV) {
            console.log(`[INFO] ${message}`, meta);
        }
    },
    warn: (message, meta = {}) => {
        console.warn(`[WARN] ${message}`, meta);
    },
    error: (message, meta = {}) => {
        console.error(`[ERROR] ${message}`, meta);
        // In a real app, you might also send this to Sentry or Datadog here
    }
};
