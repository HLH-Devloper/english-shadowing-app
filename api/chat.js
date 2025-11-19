import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
    // Set CORS headers to allow requests from any origin (or restrict to your domain)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { messages } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Invalid messages format' });
        }

        // Debug: Check environment variables (masked)
        const geminiKey = process.env.GEMINI_API_KEY;
        const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        const hasKey = !!(geminiKey || googleKey);

        if (!hasKey) {
            throw new Error('API Key not found in environment variables (GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY)');
        }

        const apiKey = geminiKey || googleKey;
        const genAI = new GoogleGenerativeAI(apiKey);

        const candidateModels = [
            process.env.GEMINI_MODEL,
            'gemini-2.5-flash-preview-09-2025',
            'gemini-1.5-flash-latest',
            'gemini-1.5-flash-002',
            'gemini-1.5-pro-002',
            'gemini-1.5-pro-latest',
            'gemini-1.5-flash',
            'gemini-pro'
        ].filter(Boolean);

        let lastError = null;
        let text = '';
        const triedModels = [];

        // Construct history for Gemini
        let history = messages.slice(0, -1).map(msg => ({
            role: msg.role === 'ai' ? 'model' : 'user',
            parts: [{ text: msg.text }]
        }));

        // Gemini requires the first message in history to be from 'user'
        // If the history starts with a 'model' message (e.g. the initial greeting), remove it.
        while (history.length > 0 && history[0].role === 'model') {
            history.shift();
        }

        const lastMessage = messages[messages.length - 1].text;

        // Check if this is a translation request (from the "Translate" button)
        const isTranslation = lastMessage.startsWith('Translate this English text to Chinese');

        if (!isTranslation) {
            const systemPrompt = `You are a helpful and encouraging English language tutor for a Chinese student.
Your goal is to help the user practice spoken English.
Rules:
1. IF the user makes a mistake (grammar, spelling, or expression):
   - FIRST, point out the mistake and explain it using a mix of Chinese and English (e.g., "You said '...' but it's better to say '...' because...").
   - THEN, provide the correct English expression.
   - FINALLY, continue the conversation in English.
2. IF the user's English is correct:
   - Simply reply in English to continue the conversation.
3. IF the user speaks Chinese:
   - Reply in English and encourage them to try saying it in English.
4. Keep your responses concise and conversational.`;

            const systemHistory = [
                { role: 'user', parts: [{ text: systemPrompt }] },
                { role: 'model', parts: [{ text: "Understood. I will act as your English tutor. I will correct mistakes using Chinese/English explanations, but keep the main conversation in English." }] }
            ];
            // Prepend system prompt to history
            history = [...systemHistory, ...history];
        }

        for (const modelName of candidateModels) {
            triedModels.push(modelName);
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const chat = model.startChat({
                    history: history,
                    generationConfig: { maxOutputTokens: 400 }, // Increased token limit for corrections
                });

                const result = await chat.sendMessage(lastMessage);
                const response = await result.response;
                text = response.text();

                if (text) break;
            } catch (err) {
                console.warn(`Model ${modelName} failed:`, err.message);
                lastError = err;
            }
        }

        if (!text) {
            throw new Error(`All models failed. Tried: ${triedModels.join(', ')}. Last error: ${lastError?.message}`);
        }

        res.status(200).json({ reply: text });

    } catch (error) {
        console.error('Server Error:', error);
        // Return 200 with error info so frontend can display it instead of generic 500
        res.status(200).json({
            error: 'Server Error',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            debug: {
                hasKey: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY),
                nodeVersion: process.version
            }
        });
    }
}
