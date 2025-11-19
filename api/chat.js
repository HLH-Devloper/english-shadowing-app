import { GoogleGenerativeAI } from '@google/generative-ai';

const FALLBACK_MODELS = [
    "qwen/qwen-2.5-72b-instruct:free", // User requested Qwen
    "meta-llama/llama-3-8b-instruct:free",
    "google/gemma-7b-it:free",
    "mistralai/mistral-7b-instruct:free",
    "microsoft/phi-3-mini-128k-instruct:free"
];

async function callOpenRouter(model, messages, systemPrompt) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OpenRouter API Key not configured");

    // Convert messages to OpenAI format
    const openAIMessages = [
        { role: "system", content: systemPrompt },
        ...messages.map(m => ({
            role: m.role === 'ai' ? 'assistant' : 'user',
            content: m.text
        }))
    ];

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://english-shadowing-app.vercel.app", // Optional
            "X-Title": "English Shadowing App" // Optional
        },
        body: JSON.stringify({
            model: model,
            messages: openAIMessages,
            max_tokens: 1000, // Increased for safety
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenRouter API Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

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
    let systemPrompt = '';

    try {
        if (!req.body) {
            return res.status(400).json({ error: 'Missing request body' });
        }

        const { messages, scenario = 'Just Vibe', difficulty = 'Intermediate' } = req.body;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: 'Invalid or empty messages array' });
        }

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

        systemPrompt = `You are a helpful and encouraging English language tutor.
Current Scenario: ${scenario}
Difficulty Level: ${difficulty}

Your goal is to help the user practice spoken English within this scenario.
${difficultyInstruction}

RESPONSE FORMAT:
You must strictly follow this format. Do not output the format description itself.

Case 1: User makes a mistake
[Explain the error in Chinese]|||[Continue conversation in English]

Case 2: User is correct
[Continue conversation in English]

EXAMPLES:
User: "I go to park yesterday."
Output: "go" 应该是 "went"，因为是过去时。|||That sounds nice! Did you go alone or with friends?

User: "I like apple."
Output: "apple" 是可数名词，通常说 "I like apples"。|||Me too! Apples are delicious. What's your favorite kind?

User: "Hello!"
Output: Hi there! How are you doing today?

RULES:
1. The part BEFORE ||| is for CORRECTIONS ONLY (in Chinese).
2. The part AFTER ||| is for the CONVERSATION (in English).
3. If there is no mistake, do NOT output |||. Just output the English response.

FINAL STEP:
At the very end of your response, generate 3 short, natural follow-up responses that the user might say next.
- **CRITICAL**: These must be answers to the question YOU just asked in the "Response Section".
- Example: If you asked "Do you like coffee?", suggestions should be ["Yes, I love it!", "No, I prefer tea.", "I drink it every day."].
- Format: ###SUGGESTIONS###["Option 1", "Option 2", "Option 3"]`;

        // Debug: Check environment variables (masked)
        const geminiKey = process.env.GEMINI_API_KEY;
        const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        const hasKey = !!(geminiKey || googleKey);

        let text = '';
        let lastError = null;
        const triedModels = [];
        const lastMessageText = messages[messages.length - 1].text;

        if (!lastMessageText || lastMessageText.trim() === '') {
            throw new Error('Last message text is empty');
        }

        // Check if this is a translation request
        const isTranslation = lastMessageText && lastMessageText.startsWith('Translate this English text to Chinese');

        // --- LEVEL 1: Try Gemini ---
        if (hasKey) {
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

            for (const modelName of candidateModels) {
                triedModels.push(modelName);
                try {
                    const model = genAI.getGenerativeModel({ model: modelName });

                    if (isTranslation) {
                        const result = await model.generateContent(lastMessageText);
                        const response = await result.response;
                        text = response.text();
                    } else {
                        // Construct history for Gemini
                        let rawHistory = messages.slice(0, -1)
                            .map(msg => ({
                                role: msg.role === 'ai' ? 'model' : 'user',
                                text: msg.text ? String(msg.text).trim() : ''
                            }))
                            .filter(msg => msg.text !== '');

                        // Merge Consecutive Roles
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

                        while (rawHistory.length > 0 && rawHistory[0].role === 'model') {
                            rawHistory.shift();
                        }

                        let history = rawHistory.map(msg => ({
                            role: msg.role,
                            parts: [{ text: msg.text }]
                        }));

                        const systemHistory = [
                            { role: 'user', parts: [{ text: systemPrompt }] },
                            { role: 'model', parts: [{ text: `Understood.I will act as your English tutor for the '${scenario}' scenario at '${difficulty}' level.` }] }
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
                    console.warn(`Gemini Model ${modelName} failed: `, err.message);
                    lastError = err;
                }
            }
        }

        // --- LEVEL 2: Try OpenRouter Fallback ---
        if (!text && process.env.OPENROUTER_API_KEY) {
            console.log("Gemini failed, attempting OpenRouter fallback...");

            // For translation, we just send the text. For chat, we send history.
            // OpenRouter uses OpenAI format, so we need to adapt.

            let openAIMessages = [];
            if (isTranslation) {
                openAIMessages = [{ role: 'user', text: lastMessageText }];
            } else {
                openAIMessages = messages;
            }

            for (const modelName of FALLBACK_MODELS) {
                triedModels.push(modelName);
                try {
                    text = await callOpenRouter(modelName, openAIMessages, systemPrompt);
                    if (text) {
                        console.log(`OpenRouter fallback success with ${modelName} `);
                        break;
                    }
                } catch (err) {
                    console.warn(`OpenRouter Model ${modelName} failed: `, err.message);
                    lastError = err;
                }
            }
        }

        if (!text) {
            throw new Error(`All models failed.Tried: ${triedModels.join(', ')}. Last error: ${lastError?.message} `);
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
