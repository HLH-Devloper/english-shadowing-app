import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
    // Set CORS headers
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
        if (!req.body) {
            return res.status(400).json({ error: 'Missing request body' });
        }

        const { messages } = req.body;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: 'Invalid or empty messages array' });
        }

        // Debug: Check environment variables (masked)
        const geminiKey = process.env.GEMINI_API_KEY;
        const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        const hasKey = !!(geminiKey || googleKey);

        if (!hasKey) {
            throw new Error('API Key not found in environment variables');
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
        // Filter out empty messages to prevent API errors
        let history = messages.slice(0, -1)
            .filter(msg => msg.text && msg.text.trim() !== '')
            .map(msg => ({
                role: msg.role === 'ai' ? 'model' : 'user',
                parts: [{ text: msg.text }]
            }));

        // Gemini requires the first message in history to be from 'user'
        while (history.length > 0 && history[0].role === 'model') {
            history.shift();
        }

        const lastMessage = messages[messages.length - 1].text;

        // Check if this is a translation request
        const isTranslation = lastMessage.startsWith('Translate this English text to Chinese');

        if (!isTranslation) {
            const systemPrompt = `You are a helpful and encouraging English language tutor for a Chinese student.
Your goal is to help the user practice spoken English.

RESPONSE FORMAT:
If the user makes a mistake (grammar, spelling, unnatural expression):
[Correction explanation in Chinese]|||[Conversational Response in English]

If the user's English is correct:
[Conversational Response in English]

RULES:
1. CORRECTION SECTION (before |||):
   - Use Chinese primarily to explain the mistake.
   - Provide the corrected English sentence.
   - Example: "你用了 'traval'，正确的拼写是 'travel'。你可以说：I want to travel."
2. RESPONSE SECTION (after ||| or if no mistake):
   - Pure English.
   - Continue the conversation naturally.
   - Do NOT mention the mistake here.
3. If the user speaks Chinese:
   - Reply in English (Response Section) and encourage them to speak English.
   - You can add a Chinese tip in the Correction Section if needed.
4. Do NOT output ||| if there is no correction.`;

            const systemHistory = [
                { role: 'user', parts: [{ text: systemPrompt }] },
                { role: 'model', parts: [{ text: "Understood. I will use the '|||' separator to distinguish between Chinese corrections and English conversational responses." }] }
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
                    generationConfig: { maxOutputTokens: 500 },
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
                nodeVersion: process.version,
                historyLength: req.body?.messages?.length
            }
        });
    }
}
