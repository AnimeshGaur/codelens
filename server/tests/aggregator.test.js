import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateResults } from '../core/aggregator.js';

test('aggregator module', async (t) => {
    await t.test('deduplicates components and merges dependencies/files', () => {
        const batch1 = {
            components: [
                { name: 'Auth', files: ['auth.js'], dependencies: ['bcrypt'] }
            ]
        };
        const batch2 = {
            components: [
                { name: 'Auth', files: ['auth.test.js'], dependencies: ['jwt'] },
                { name: 'DB', files: ['db.js'], dependencies: ['pg'] }
            ]
        };

        const result = aggregateResults([batch1, batch2]);

        assert.equal(result.components.length, 2);

        const auth = result.components.find(c => c.name === 'Auth');
        assert.deepEqual(auth.files.sort(), ['auth.js', 'auth.test.js'].sort());
        assert.deepEqual(auth.dependencies.sort(), ['bcrypt', 'jwt'].sort());
    });

    await t.test('deduplicates classes by name and file', () => {
        const batch1 = { classes: [{ name: 'User', file: 'user.js' }] };
        const batch2 = { classes: [{ name: 'User', file: 'user.js' }, { name: 'Admin', file: 'admin.js' }] };

        const result = aggregateResults([batch1, batch2]);
        assert.equal(result.classes.length, 2);
        assert.equal(result.classes.filter(c => c.name === 'User').length, 1);
    });

    await t.test('merges architecture sets', () => {
        const batch1 = {
            architecture: {
                patterns: ['MVC'],
                techStack: { databases: ['PostgreSQL'] },
                securitySurface: { authMechanism: 'OAuth2' }
            }
        };
        const batch2 = {
            architecture: {
                patterns: ['MVC', 'Repository'],
                techStack: { databases: ['Redis'] },
                securitySurface: { protectedEndpoints: ['/api/user'] }
            }
        };

        const result = aggregateResults([batch1, batch2]);
        assert.deepEqual(result.architecture.patterns.sort(), ['MVC', 'Repository'].sort());
        assert.deepEqual(result.architecture.techStack.databases.sort(), ['PostgreSQL', 'Redis'].sort());
        assert.equal(result.architecture.securitySurface.authMechanism, 'OAuth2');
        assert.deepEqual(result.architecture.securitySurface.protectedEndpoints, ['/api/user']);
    });
});
