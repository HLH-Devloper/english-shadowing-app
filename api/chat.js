import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Invalid messages format' });
    }

    try {
        // Use the same environment variable name as dict-gemini.js
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!apiKey) {
            throw new Error('Missing API Key');
        }

        const genAI = new GoogleGenerativeAI(apiKey);

        // Candidate models to try, similar to dict-gemini.js
        const candidateModels = [
            process.env.GEMINI_MODEL,
            'gemini-1.5-flash',
            'gemini-1.5-flash-latest',
            'gemini-1.5-flash-002',
            'gemini-1.5-pro',
            'gemini-pro'
        ].filter(Boolean);

        let lastError = null;
        let text = '';

        // Construct history for Gemini
        const history = messages.slice(0, -1).map(msg => ({
            role: msg.role === 'ai' ? 'model' : 'user',
            parts: [{ text: msg.text }]
        }));
        const lastMessage = messages[messages.length - 1].text;

        for (const modelName of candidateModels) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });

                const chat = model.startChat({
                    history: history,
                    generationConfig: {
                        maxOutputTokens: 150,
                    },
                });

                const result = await chat.sendMessage(lastMessage);
                const response = await result.response;
                text = response.text();

                if (text) break; // Success
            } catch (err) {
                console.warn(`Model ${modelName} failed:`, err.message);
                lastError = err;
                continue; // Try next model
            }
        }

        if (!text) {
            throw lastError || new Error('All models failed');
        }

        res.status(200).json({ reply: text });
    } catch (error) {
        console.error('Gemini API Error:', error);
        res.status(500).json({ error: 'Failed to generate response', details: error.message });
    }
}
