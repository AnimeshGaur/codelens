import { resolveRepo } from './server/services/github.js';
import { analyzeRepo } from './server/services/analyzer.js';

async function runAnalysis() {
    const targetPath = '/Users/animeshgaur/Downloads/mcp-chatbot-poc-main';
    console.log(`\n🔍 Initiating CodeLens Analysis for: ${targetPath}`);
    console.log(`-----------------------------------------------------`);

    try {
        const repo = await resolveRepo(targetPath, (msg) => console.log('✅ progress[resolve-repo]:', msg));

        console.log(`\n🚀 Starting LLM Analysis Pipeline (Provider: groq, Model: llama3-70b-8192)`);
        const result = await analyzeRepo(
            repo.repoPath,
            repo.repoName,
            {
                provider: 'groq',
                model: 'llama3-70b-8192',
                apiKey: process.env.GROQ_API_KEY || 'dummy_test_key_so_it_fails_gracefully'
            },
            (evt, msg) => {
                if (typeof msg === 'string') {
                    console.log(`✅ progress[${evt}]: ${msg}`);
                } else if (msg && msg.message) {
                    // some emitters send { message, done, etc }
                    console.log(`✅ progress[${evt}]: ${msg.message}`);
                }
            }
        );

        console.log('\n🎉 Analysis SUCCESS!');
        console.log(JSON.stringify(result, null, 2));

    } catch (err) {
        console.log('\n❌ Analysis FAILED:');
        console.error(err.message);

        if (err.message.includes('401') && err.message.includes('Invalid API Key')) {
            console.log('\n💡 Tip: The Groq API key is either missing or invalid.');
            console.log('Please set GROQ_API_KEY in your `.env` file or provide it directly.');
        }
    }
}

runAnalysis().catch(console.error);
