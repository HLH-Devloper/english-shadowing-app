import svc from './lib/youtubeCaptions'

export default async function handler(req, res) {
  try {
    const { videoId, lang } = (req.method === 'GET' ? req.query : req.body) || {}
    if (!videoId || typeof videoId !== 'string') {
      res.status(400).json({ error: 'missing videoId' })
      return
    }

    const result = await svc.getCaptions(videoId, typeof lang === 'string' ? lang : 'en')
    res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=600')
    // 始终返回 200，避免前端因 500 直接进入错误分支
    res.status(200).json(result && Array.isArray(result.segments) ? result : { segments: [], meta: result?.meta || { lang: lang || 'en' } })
  } catch (e) {
    // 非致命错误时返回空列表，让前端走“上传字幕”兜底
    res.status(200).json({ segments: [], meta: { lang: 'en' }, error: 'fetch_failed', message: String(e && e.message || e) })
  }
}
