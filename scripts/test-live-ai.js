require('dotenv').config();
const { generateText } = require('ai');
const { createOpenAI } = require('@ai-sdk/openai');
const { createGoogleGenerativeAI } = require('@ai-sdk/google');

async function testKeys() {
  console.log('Testing OpenAI and Gemini keys from .env...');

  const openaiKey = process.env.Openai_Api || process.env.OPENAI_API_KEY;
  const geminiKey = process.env.Gemini_Api || process.env.GEMINI_API_KEY;

  console.log('OpenAI Key present:', !!openaiKey, openaiKey ? openaiKey.substring(0, 15) + '...' : 'NO');
  console.log('Gemini Key present:', !!geminiKey, geminiKey ? geminiKey.substring(0, 15) + '...' : 'NO');

  if (openaiKey) {
    try {
      console.log('\n--- Testing OpenAI (gpt-4o-mini) ---');
      const openai = createOpenAI({ apiKey: openaiKey });
      const res = await generateText({
        model: openai('gpt-4o-mini'),
        prompt: 'Say "OpenAI live connection successful!" in 5 words.',
      });
      console.log('OpenAI Success! Output:', res.text);
    } catch (e) {
      console.error('OpenAI Error:', e.message);
      if (e.data) console.error('OpenAI Error Details:', JSON.stringify(e.data));
    }
  }

  if (geminiKey) {
    try {
      console.log('\n--- Testing Gemini (gemini-1.5-flash) ---');
      const google = createGoogleGenerativeAI({ apiKey: geminiKey });
      const res = await generateText({
        model: google('gemini-1.5-flash'),
        prompt: 'Say "Gemini live connection successful!" in 5 words.',
      });
      console.log('Gemini Success! Output:', res.text);
    } catch (e) {
      console.error('Gemini Error:', e.message);
      if (e.data) console.error('Gemini Error Details:', JSON.stringify(e.data));
    }
  }
}

testKeys().catch(console.error);
