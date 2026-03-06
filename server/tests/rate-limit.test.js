import test from 'node:test';
import assert from 'node:assert/strict';
import { rateLimit } from '../core/rate-limit.js';

test('rate-limit module', async (t) => {
    await t.test('allows requests under limit', () => {
        const middleware = rateLimit({ windowMs: 1000, max: 2 });

        const req = { ip: '192.168.1.1' };
        let status = 200, resData = null;
        let nextCalled = false;

        const res = {
            set: () => { },
            status: (s) => { status = s; return res; },
            json: (data) => { resData = data; }
        };
        const next = () => { nextCalled = true; };

        // 1st request
        middleware(req, res, next);
        assert.equal(nextCalled, true);

        // 2nd request
        nextCalled = false;
        middleware(req, res, next);
        assert.equal(nextCalled, true);
    });

    await t.test('blocks requests over limit', () => {
        const middleware = rateLimit({ windowMs: 1000, max: 1 });

        const req = { ip: '10.0.0.1' };
        let status = 200, resData = null;
        let nextCalled = 0;

        const res = {
            set: () => { },
            status: (s) => { status = s; return res; },
            json: (data) => { resData = data; }
        };
        const next = () => { nextCalled++; };

        // 1st request
        middleware(req, res, next);
        assert.equal(nextCalled, 1);

        // 2nd request (blocked)
        middleware(req, res, next);
        assert.equal(nextCalled, 1); // Not incremented
        assert.equal(status, 429);
        assert.equal(resData.error, 'Too Many Requests');
    });
});
