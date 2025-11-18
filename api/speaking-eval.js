import { GoogleGenerativeAI } from '@google/generative-ai'

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return }
  try {
    const { sentenceId, original, translation, userText, userId } = req.body || {}
    const apiKey = process.env.GEMINI_API_KEY || ''
    if (!apiKey) { res.status(401).json({ error: 'GEMINI_API_KEY 未配置或无效' }); return }
    const genai = new GoogleGenerativeAI(apiKey)
    const model = genai.getGenerativeModel({ model: 'gemini-1.5-flash' })
    const prompt = [
      'You are an English speaking coach. Evaluate the user\'s paraphrase against the reference sentence. Return concise feedback in Chinese and improved phrasing suggestions in English. Provide a numeric overall score (0-5) and four sub-scores: fluency, accuracy, vocabulary, grammar.',
      `Reference (English): ${String(original || '').trim()}`,
      `Reference (Chinese): ${String(translation || '').trim()}`,
      `User paraphrase: ${String(userText || '').trim()}`,
      'Output strictly in JSON with keys: score(number), rubric(object: fluency, accuracy, vocabulary, grammar), summary(string, zh), correction(string, en), suggestions(array of string, en).'
    ].join('\n')
    const result = await model.generateContent(prompt)
    let text = result?.response?.text?.() || ''
    text = String(text || '').trim()
    if (text.startsWith('```')) { text = text.replace(/```json|```/g, '').trim() }
    let data = null
    try { data = JSON.parse(text) } catch { data = null }
    if (!data || typeof data !== 'object') {
      res.status(200).json({ score: 0, rubric: { fluency: 0, accuracy: 0, vocabulary: 0, grammar: 0 }, summary: '暂时无法解析评估结果', correction: '', suggestions: [] })
      return
    }
    res.status(200).json({
      score: Number(data.score || 0),
      rubric: {
        fluency: Number(data?.rubric?.fluency || 0),
        accuracy: Number(data?.rubric?.accuracy || 0),
        vocabulary: Number(data?.rubric?.vocabulary || 0),
        grammar: Number(data?.rubric?.grammar || 0)
      },
      summary: String(data.summary || ''),
      correction: String(data.correction || ''),
      suggestions: Array.isArray(data.suggestions) ? data.suggestions.slice(0, 3) : [],
      refs: { original: String(original || ''), translation: String(translation || '') },
      sentenceId: String(sentenceId || '')
    })
  } catch (e) {
    res.status(200).json({ score: 0, rubric: { fluency: 0, accuracy: 0, vocabulary: 0, grammar: 0 }, summary: '评估服务暂不可用', correction: '', suggestions: [] })
  }
}
