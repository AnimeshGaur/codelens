import { createProvider } from './server/core/llm/provider.js';

async function testGroqDirect() {
    console.log('Testing Groq Provider direct logic...');
    try {
        // We initialize the provider. Since we rewrote it to use native fetch, 
        // it requires NO external packages!
        console.log('Creating provider with dummy key...');
        const groq = createProvider('groq', 'llama3-70b-8192', 'gsk_dummy_test_key_123');

        console.log('Sending prompt to Groq API...');
        const response = await groq.send('Hello, this is a test. Respond with {"status": "ok"}', 'You are a helpful assistant.');

        console.log('Response received:', response);
    } catch (err) {
        console.log('API Test executed. Expected failure with dummy key:');
        console.error('-->', err.message);
    }
}

testGroqDirect().catch(console.error);
