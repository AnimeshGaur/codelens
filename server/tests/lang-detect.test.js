import test from 'node:test';
import assert from 'node:assert/strict';
import { detectLanguage, isSourceFile } from '../core/lang-detect.js';

test('lang-detect module', async (t) => {
    await t.test('detectLanguage returns correct capitalized names', () => {
        assert.equal(detectLanguage('app.js'), 'JavaScript');
        assert.equal(detectLanguage('Component.jsx'), 'JavaScript (JSX)');
        assert.equal(detectLanguage('main.ts'), 'TypeScript');
        assert.equal(detectLanguage('main.py'), 'Python');
        assert.equal(detectLanguage('main.go'), 'Go');
        assert.equal(detectLanguage('unknown.xyz'), null);
    });

    await t.test('isSourceFile correctly identifies processable files', () => {
        assert.equal(isSourceFile('app.js'), true);
        assert.equal(isSourceFile('styles.css'), false); // Assuming CSS is not in SOURCE_EXTENSIONS by default or it is?
        assert.equal(isSourceFile('README.md'), false);
    });
});
