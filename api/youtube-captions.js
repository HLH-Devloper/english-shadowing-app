import svc from './lib/youtubeCaptions.js'

export default async function handler(req, res) {
  try {
    const { videoId, lang } = (req.method === 'GET' ? req.query : req.body) || {}
    if (!videoId || typeof videoId !== 'string') {
      res.status(400).json({ error: 'missing videoId' })
      return
    }

    // 兼容：优先转发到新的 /api/youtube-transcript（避免旧前端脚本失败）
    try {
      const proto = (req.headers['x-forwarded-proto'] || 'https')
      const host = (req.headers['x-forwarded-host'] || req.headers['host'])
      const base = `${proto}://${host}`
      const q = lang ? `&lang=${encodeURIComponent(lang)}` : ''
      const url = `${base}/api/youtube-transcript?videoId=${encodeURIComponent(videoId)}${q}`
      const resp = await fetch(url)
      if (resp.ok) {
        const data = await resp.json()
        if (Array.isArray(data?.segments) && data.segments.length > 0) {
          res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=600')
          res.status(200).json(data)
          return
        }
      }
    } catch {}

    // 回退到公开 timedtext 抓取
    const result = await svc.getCaptions(videoId, typeof lang === 'string' ? lang : 'en')
    res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=600')
    res.status(200).json(result && Array.isArray(result.segments) ? result : { segments: [], meta: result?.meta || { lang: lang || 'en' } })
  } catch (e) {
    res.status(200).json({ segments: [], meta: { lang: 'en', tracks: [] }, error: 'fetch_failed', message: String(e && e.message || e) })
  }
}