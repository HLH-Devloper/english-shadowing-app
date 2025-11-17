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
    res.status(200).json(result)
  } catch (e) {
    res.status(500).json({ error: 'fetch_failed', message: String(e && e.message || e) })
  }
}