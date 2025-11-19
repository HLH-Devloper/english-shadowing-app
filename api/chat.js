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

    let debugHistory = [];

    try {
        if (!req.body) {
            return res.status(400).json({ error: 'Missing request body' });
        }

        const { messages, scenario = 'Just Vibe', difficulty = 'Intermediate' } = req.body;

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

        const lastMessageText = messages[messages.length - 1].text;

        if (!lastMessageText || lastMessageText.trim() === '') {
            throw new Error('Last message text is empty');
        }

        // Check if this is a translation request
        const isTranslation = lastMessageText && lastMessageText.startsWith('Translate this English text to Chinese');

        for (const modelName of candidateModels) {
            triedModels.push(modelName);
            try {
                const model = genAI.getGenerativeModel({ model: modelName });

                if (isTranslation) {
                    // --- STRATEGY 1: Translation (Stateless) ---
                    // Use generateContent directly for translation to avoid history issues
                    const result = await model.generateContent(lastMessageText);
                    const response = await result.response;
                    text = response.text();
                } else {
                    // --- STRATEGY 2: Conversation (Stateful) ---
                    // Construct history for Gemini

                    // 1. Initial Map & Filter
                    let rawHistory = messages.slice(0, -1)
                        .map(msg => ({
                            role: msg.role === 'ai' ? 'model' : 'user',
                            text: msg.text ? String(msg.text).trim() : ''
                        }))
                        .filter(msg => msg.text !== ''); // Remove empty messages

                    // 2. Merge Consecutive Roles
                    if (rawHistory.length > 0) {
                        let mergedHistory = [];
                        let currentMsg = rawHistory[0];

                        for (let i = 1; i < rawHistory.length; i++) {
                            const nextMsg = rawHistory[i];
                            if (nextMsg.role === currentMsg.role) {
                                currentMsg.text += '\n' + nextMsg.text;
                            } else {
                                mergedHistory.push(currentMsg);
                                currentMsg = nextMsg;
                            }
                        }
                        mergedHistory.push(currentMsg);
                        rawHistory = mergedHistory;
                    }

                    // 3. Ensure Start with User
                    while (rawHistory.length > 0 && rawHistory[0].role === 'model') {
                        rawHistory.shift();
                    }

                    // 4. Convert to Gemini Format
                    let history = rawHistory.map(msg => ({
                        role: msg.role,
                        parts: [{ text: msg.text }]
                    }));

                    // --- Dynamic System Prompt Construction ---
                    let difficultyInstruction = '';
                    switch (difficulty) {
                        case 'Beginner':
                            difficultyInstruction = 'Use simple vocabulary (CEFR A1-A2). Speak slowly and clearly using short sentences. Avoid idioms.';
                            break;
                        case 'Advanced':
                            difficultyInstruction = 'Use sophisticated vocabulary and idioms (CEFR C1-C2). Speak naturally and fluently with complex sentence structures.';
                            break;
                        case 'Intermediate':
                        default:
                            difficultyInstruction = 'Use natural daily conversation vocabulary (CEFR B1-B2). Balance simplicity with natural expression.';
                            break;
                    }

                    const systemPrompt = `You are a helpful and encouraging English language tutor.
Current Scenario: ${scenario}
Difficulty Level: ${difficulty}

Your goal is to help the user practice spoken English within this scenario.
${difficultyInstruction}

RESPONSE FORMAT:
If the user makes a mistake (grammar, spelling, unnatural expression):
[Correction explanation in Chinese]|||[Conversational Response in English]

If the user's English is correct:
[Conversational Response in English]

RULES:
1. CORRECTION SECTION (before |||):
   - Use Chinese primarily to explain the mistake.
   - Provide the corrected English sentence.
2. RESPONSE SECTION (after ||| or if no mistake):
   - Pure English.
   - Continue the conversation naturally based on the '${scenario}' scenario.
   - Do NOT mention the mistake here.
3. If the user speaks Chinese:
   - Reply in English (Response Section) and encourage them to speak English.
4. Do NOT output ||| if there is no correction.`;

                    const systemHistory = [
                        { role: 'user', parts: [{ text: systemPrompt }] },
                        { role: 'model', parts: [{ text: `Understood. I will act as your English tutor for the '${scenario}' scenario at '${difficulty}' level.` }] }
                    ];

                    history = [...systemHistory, ...history];
                    debugHistory = history;

                    const chat = model.startChat({
                        history: history,
                        generationConfig: { maxOutputTokens: 500 },
                    });

                    const result = await chat.sendMessage(lastMessageText);
                    const response = await result.response;
                    text = response.text();
                }

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
        res.status(200).json({
            error: 'Server Error',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            debug: {
                hasKey: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY),
                nodeVersion: process.version,
                historyLength: debugHistory.length
            }
        });
    }
}
