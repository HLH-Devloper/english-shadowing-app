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
            max_tokens: 1000,
            response_format: { type: "json_object" } // Request JSON if supported
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

        const lastMessageText = messages[messages.length - 1].text;
        if (!lastMessageText || lastMessageText.trim() === '') {
            throw new Error('Last message text is empty');
        }

        // Check if this is a translation request
        const isTranslation = lastMessageText && lastMessageText.startsWith('Translate this English text to Chinese');

        // --- Dynamic System Prompt Construction ---
        if (isTranslation) {
            // Minimal prompt for translation to avoid interference
            systemPrompt = "You are a helpful translator. Translate the following English text to Chinese (Simplified). Output ONLY the translation.";
        } else {
            let difficultyInstruction = '';
            switch (difficulty) {
                case 'Beginner':
                    difficultyInstruction = 'STRICTLY LIMIT your vocabulary to CEFR A1-A2 levels. Use ONLY simple words. Speak slowly and clearly using short, simple sentences. AVOID all idioms and complex grammar. Ensure your `suggested_replies` are also very simple (1-5 words).';
                    break;
                case 'Advanced':
                    difficultyInstruction = 'Use sophisticated, academic, and native-level vocabulary (CEFR C1-C2). Use complex sentence structures, idioms, and phrasal verbs freely. Speak naturally and fluently. Ensure your `suggested_replies` are complex and natural for a native speaker.';
                    break;
                case 'Intermediate':
                default:
                    difficultyInstruction = 'Use natural daily conversation vocabulary (CEFR B1-B2). Balance simplicity with natural expression. You can use common phrasal verbs but avoid obscure idioms. Ensure your `suggested_replies` are standard daily expressions.';
                    break;
            }

            systemPrompt = `You are an expert AI English Language Tutor designed to help Chinese speakers improve their spoken English. Your task is to analyze the user's input, check for grammatical errors, and then continue the conversation naturally.

Current Scenario: ${scenario}
Difficulty Level: ${difficulty}
${difficultyInstruction}

### INPUT PROCESSING:
1.  **Analyze**: Carefully examine the user's input for grammatical errors, unnatural phrasing, or vocabulary misuse.
2.  **Filter**: Ignore minor punctuation mistakes or stylistic choices if the sentence is natural. DO NOT hallucinate errors. If the sentence is correct, DO NOT suggest a correction.
3.  **Response**: Generate a natural, engaging reply to keep the conversation going.

### OUTPUT FORMAT (Strict JSON):
You must output a single JSON object with the following structure:
{
  "has_error": boolean, // true if there is a real error, false otherwise
  "correction_explanation": string | null, // If has_error is true, explain the error in CHINESE concisely (e.g., "这里应该用过去式..."). If false, this must be null.
  "corrected_sentence": string | null, // The fully corrected sentence. If has_error is false, this must be null.
  "reply": string, // Your natural reply to the user in English.
  "suggested_replies": [string, string, string] // 3 short suggested responses for the user to say next.
}

### CRITICAL RULES:
1.  **Strict Error Threshold**: Only set "has_error": true if there is a clear grammatical or vocabulary error. If the user's input is grammatically correct (even if simple), "has_error" MUST be false and "correction_explanation" MUST be null.
2.  **No Nitpicking**: Do not correct "I want to eat" to "I would like to eat". Both are correct. Only correct wrong English.
3.  **Language**: The \`reply\` must be in English. The \`correction_explanation\` must be in Chinese.
4.  **JSON Only**: Output ONLY the JSON object. Do not wrap it in markdown code blocks like \`\`\`json ... \`\`\`.

### EXAMPLES:

User: "I go to park yesterday."
Output:
{
  "has_error": true,
  "correction_explanation": "昨天发生的事情应该用过去式 'went'。",
  "corrected_sentence": "I went to the park yesterday.",
  "reply": "Oh, that's nice! Did you have a good time at the park?",
  "suggested_replies": ["Yes, it was fun.", "I played soccer.", "It was raining."]
}

User: "I want to talk about delicious food."
Output:
{
  "has_error": false,
  "correction_explanation": null,
  "corrected_sentence": null,
  "reply": "Great topic! I love talking about food. What is your favorite cuisine?",
  "suggested_replies": ["I love Italian food.", "I like spicy food.", "Japanese food is the best."]
}

### CRITICAL EXCEPTION FOR CAPITALIZATION (STRICT):
- **NEVER** correct capitalization errors.
- **NEVER** correct "i" to "I".
- **NEVER** correct the first letter of a sentence.
- **NEVER** correct proper nouns if the only error is capitalization (e.g., "china" -> "China" is NOT an error for this task).
- Treat all input as case-insensitive.
- Example: "i dont know" -> NO ERROR.
- Example: "china is big" -> NO ERROR.

### CRITICAL EXCEPTION FOR PUNCTUATION:
- IGNORE missing punctuation (periods, commas) at the end of sentences or between clauses.
- Voice input often lacks punctuation. Do NOT correct this unless it causes severe ambiguity.
- Example: "i want to go home" -> Accept as correct (DO NOT correct to "I want to go home.").

### CRITICAL REQUIREMENT FOR SUGGESTIONS (MANDATORY):
- You MUST provide 3 suggested replies.
- These suggestions MUST match the current **Difficulty Level** (${difficulty}).
- Beginner: Simple words, short sentences.
- Intermediate: Natural daily expressions.
- Advanced: Sophisticated vocabulary and structure.

### TOPIC TRANSITION RULES:
When the user's response is COMPLETELY UNRELATED to your previous question:
1. First, acknowledge the topic change with a natural transition phrase.
2. Then smoothly continue with the new topic.`;
        }

        // Debug: Check environment variables (masked)
        const geminiKey = process.env.GEMINI_API_KEY;
        const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        const hasKey = !!(geminiKey || googleKey);

        let text = '';
        let lastError = null;
        const triedModels = [];

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
                    const model = genAI.getGenerativeModel({
                        model: modelName,
                        generationConfig: {
                            responseMimeType: "application/json" // Force JSON output for Gemini
                        }
                    });

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
                            {
                                role: 'model', parts: [{
                                    text: JSON.stringify({
                                        has_error: false,
                                        correction_explanation: null,
                                        corrected_sentence: null,
                                        reply: `Understood. I will act as your English tutor for the '${scenario}' scenario at '${difficulty}' level.`,
                                        suggested_replies: ["Let's start!", "I'm ready.", "Hello!"]
                                    })
                                }]
                            }
                        ];

                        history = [...systemHistory, ...history];
                        debugHistory = history;

                        const chat = model.startChat({
                            history: history,
                            generationConfig: {
                                maxOutputTokens: 1000,
                                temperature: 0.3, // Low temperature for strict adherence
                                responseMimeType: "application/json"
                            },
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

        // --- Response Parsing & Cleaning ---
        let finalResponse = {};

        if (isTranslation) {
            // For translation, we just return the text as reply
            finalResponse = { reply: text };
        } else {
            // Attempt to parse JSON
            try {
                // Remove markdown code blocks if present
                const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
                finalResponse = JSON.parse(cleanText);
            } catch (e) {
                console.error("Failed to parse JSON response:", text);
                // Fallback if JSON parsing fails
                finalResponse = {
                    has_error: false,
                    correction_explanation: null,
                    corrected_sentence: null,
                    reply: text, // Return raw text as reply
                    suggested_replies: []
                };
            }
        }

        res.status(200).json(finalResponse);

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
