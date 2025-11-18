import { GoogleGenerativeAI } from '@google/generative-ai'

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return }
  try {
    let payload = {}
    try {
      if (typeof req.body === 'string') {
        payload = JSON.parse(req.body)
      } else {
        payload = req.body || {}
      }
    } catch {
      payload = {}
    }
    const { sentenceId, original, translation, userText, userId, preference } = payload
    const apiKey = process.env.GEMINI_API_KEY || ''
    if (!apiKey) { res.status(401).json({ error: 'GEMINI_API_KEY 未配置或无效' }); return }
  const genai = new GoogleGenerativeAI(apiKey)
  const models = []
  const envModel = (process.env.GEMINI_MODEL || '').trim()
  if (envModel) models.push(envModel)
  models.push('gemini-2.5-flash-preview-09-2025', 'gemini-1.5-flash-latest', 'gemini-1.5-flash-002', 'gemini-1.5-pro-002', 'gemini-1.5-pro-latest')
  let parsed = null
  let lastErr = null
  for (const name of models) {
    try {
      const model = genai.getGenerativeModel({ model: name, generationConfig: { responseMimeType: 'application/json' } })
      const pref = String(preference || 'daily').toLowerCase() === 'work' ? 'work' : 'daily'
      const prompt = [
        'You are an English speaking coach. Evaluate the user\'s paraphrase against the reference sentence. Return concise feedback in Chinese and improved phrasing suggestions in English. Provide a numeric overall score (0-5) and four sub-scores: fluency, accuracy, vocabulary, grammar.',
        `Reference (English): ${String(original || '').trim()}`,
        `Reference (Chinese): ${String(translation || '').trim()}`,
        `User paraphrase: ${String(userText || '').trim()}`,
        `Preference: ${pref} (daily = casual everyday speech with natural emotion; work = polite, formal, and euphemistic register suitable for workplace or formal sharing).`,
        'Output strictly in JSON with keys: score(number), rubric(object: fluency, accuracy, vocabulary, grammar), overview(string, zh), upgrades(object: { basic: { text:string, explain:string }, daily: { text:string, explain:string }, work: { text:string, explain:string } }), practice(array of string, zh instructions describing what to write in English), preferenceEcho(string in [daily, work]). Do NOT include additional text outside JSON.'
      ].join('\n')
      const result = await model.generateContent(prompt)
      let text = String(result?.response?.text?.() || '').trim()
      if (!text) { lastErr = new Error('EmptyGeminiResponse'); continue }
      if (text.startsWith('```')) { text = text.replace(/```json|```/g, '').trim() }
      try {
        parsed = JSON.parse(text)
      } catch (e) {
        const m = text.match(/\{[\s\S]*\}/)
        if (m) {
          parsed = JSON.parse(m[0])
        } else {
          throw e
        }
      }
      if (parsed && typeof parsed === 'object') break
    } catch (e) {
      lastErr = e
      continue
    }
  }
  if (!parsed) {
    // 回退：使用更简单的输出结构提示词，提升可用性
    for (const name of models) {
      try {
        const model = genai.getGenerativeModel({ model: name, generationConfig: { responseMimeType: 'application/json' } })
        const pref = String(preference || 'daily').toLowerCase() === 'work' ? 'work' : 'daily'
        const prompt2 = [
          'You are an English speaking coach. Evaluate the user\'s paraphrase. Return STRICT JSON ONLY with keys:',
          'score(number 0-5), rubric(object: fluency, accuracy, vocabulary, grammar), summary(string, zh), correction(string, en), suggestions(array of string, en), practice(array of string, zh instructions), preferenceEcho(string in [daily, work]).',
          `Reference (English): ${String(original || '').trim()}`,
          `Reference (Chinese): ${String(translation || '').trim()}`,
          `User paraphrase: ${String(userText || '').trim()}`,
          `Preference: ${pref}`
        ].join('\n')
        const result2 = await model.generateContent(prompt2)
        let text2 = String(result2?.response?.text?.() || '').trim()
        if (!text2) continue
        if (text2.startsWith('```')) { text2 = text2.replace(/```json|```/g, '').trim() }
        try {
          parsed = JSON.parse(text2)
        } catch (e) {
          const m2 = text2.match(/\{[\s\S]*\}/)
          if (m2) { parsed = JSON.parse(m2[0]) }
        }
        if (parsed) break
      } catch (_) {}
    }
    if (!parsed) {
      res.status(200).json({ score: 0, rubric: { fluency: 0, accuracy: 0, vocabulary: 0, grammar: 0 }, summary: '评估服务暂不可用', correction: '', suggestions: [] })
      return
    }
  }
    const data = parsed
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({
      score: Number(data.score || 0),
      rubric: {
        fluency: Number(data?.rubric?.fluency || 0),
        accuracy: Number(data?.rubric?.accuracy || 0),
        vocabulary: Number(data?.rubric?.vocabulary || 0),
        grammar: Number(data?.rubric?.grammar || 0)
      },
      overview: String(data.overview || ''),
      upgrades: {
        basic: { text: String(data?.upgrades?.basic?.text || ''), explain: String(data?.upgrades?.basic?.explain || '') },
        daily: { text: String(data?.upgrades?.daily?.text || ''), explain: String(data?.upgrades?.daily?.explain || '') },
        work: { text: String(data?.upgrades?.work?.text || ''), explain: String(data?.upgrades?.work?.explain || '') }
      },
      practice: Array.isArray(data.practice) ? data.practice.slice(0, 4) : [],
      preferenceEcho: String(data.preferenceEcho || pref),
      summary: String(data.overview || ''),
      correction: String(data?.upgrades?.basic?.text || ''),
      suggestions: [String(data?.upgrades?.daily?.text || ''), String(data?.upgrades?.work?.text || '')].filter(Boolean).slice(0, 3),
      refs: { original: String(original || ''), translation: String(translation || '') },
      sentenceId: String(sentenceId || '')
    })
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({ score: 0, rubric: { fluency: 0, accuracy: 0, vocabulary: 0, grammar: 0 }, summary: '评估服务暂不可用', correction: '', suggestions: [] })
  }
}