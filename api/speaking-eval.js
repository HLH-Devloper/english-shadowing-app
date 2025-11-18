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
      const txt = String(userText || '').trim()
      const ref = String(original || '').trim()
      const zh = String(translation || '').trim()
      const toWords = (s) => s.toLowerCase().replace(/[^a-z\s']/g, ' ').split(/\s+/).filter(Boolean)
      const sRef = toWords(ref).join(' ')
      const sTxt = toWords(txt).join(' ')
      const ed = (() => {
        const a = sRef
        const b = sTxt
        const m = a.length
        const n = b.length
        const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
        for (let i = 0; i <= m; i++) dp[i][0] = i
        for (let j = 0; j <= n; j++) dp[0][j] = j
        for (let i = 1; i <= m; i++) {
          for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
          }
        }
        return dp[m][n]
      })()
      const maxLen = Math.max(sRef.length, sTxt.length) || 1
      const accuracy = Math.max(0, Math.min(100, Math.round((1 - ed / maxLen) * 100)))
      const words = sTxt ? sTxt.split(' ').filter(Boolean).length : 0
      const fluency = Math.max(0, Math.min(100, Math.round(Math.min(1, words / Math.max(1, sRef.split(' ').length)) * 100)))
      const vocab = Math.max(0, Math.min(100, Math.round(Math.min(1, (new Set(sTxt.split(' ')).size) / Math.max(1, new Set(sRef.split(' ')).size)) * 100)))
      const grammar = Math.max(0, Math.min(100, Math.round(100 - Math.max(0, 2 - words) * 20)))
      const overview = zh ? `请用英文表达并保持与参考句的语气一致。当前表达偏简略，建议补充关键信息：${zh}` : '请用英文完整表达含义，并尽量贴近参考句的语气和信息点。'
      const basicText = txt ? `${txt}` : ref
      const dailyText = ref ? `${ref}` : 'Use a natural everyday tone.'
      const workText = ref ? `It ${ref.replace(/^([A-Za-z]+\s)/, '').toLowerCase()}` : 'Use a polite and formal register.'
      const practice = [
        zh ? `请用英文写一句话，表达：${zh}` : '请用英文写一句话，完整表达参考句的含义。',
        '再写一句，用比较委婉的方式表达相同含义。'
      ]
      res.setHeader('Cache-Control', 'no-store')
      res.status(200).json({
        score: Math.round((accuracy / 100) * 5 * 10) / 10,
        rubric: { fluency, accuracy, vocabulary: vocab, grammar },
        overview,
        upgrades: {
          basic: { text: basicText, explain: '在保留你表达的基础上补充或增强信息点。' },
          daily: { text: dailyText, explain: '使用更自然的日常口语，贴近参考句语气。' },
          work: { text: workText, explain: '使用更委婉、正式的表达，适合职场语域。' }
        },
        practice,
        preferenceEcho: String(preference || 'daily')
      })
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