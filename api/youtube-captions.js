import svc from './lib/youtubeCaptions.js'
import { getTranscript } from './youtube-transcript.js'

export default async function handler(req, res) {
  try {
    const { videoId, lang } = (req.method === 'GET' ? req.query : req.body) || {}
    if (!videoId || typeof videoId !== 'string') {
      res.status(400).json({ error: 'missing videoId' })
      return
    }

        // 兼容：优先调用新的 youtube-transcript 逻辑
    try {
      const data = await getTranscript({ videoId, lang })
      if (Array.isArray(data?.segments) && data.segments.length > 0) {
        res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=600')
        res.status(200).json(data)
        return
      }
      // 即使没有抓到具体段落，也要把可选轨道返回给前端用于选择
      if (Array.isArray(data?.meta?.tracks) && data.meta.tracks.length > 0) {
        res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=600')
        res.status(200).json(data)
        return
      }
    } catch (e) {
      console.warn('[youtube-captions] getTranscript failed, falling back to public timedtext', e.message)
    }

    // 回退到公开 timedtext 抓取
    const result = await svc.getCaptions(videoId, typeof lang === 'string' ? lang : 'en')
    res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=600')
    res.status(200).json(result && Array.isArray(result.segments) ? result : { segments: [], meta: result?.meta || { lang: lang || 'en' } })
  } catch (e) {
    res.status(200).json({ segments: [], meta: { lang: 'en', tracks: [] }, error: 'fetch_failed', message: String(e && e.message || e) })
  }
}