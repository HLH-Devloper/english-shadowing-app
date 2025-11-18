// Vercel Serverless Function: YouTube Captions 抓取（仅使用公开 timedtext 接口，不尝试 Innertube）
// 入参：videoId、lang
// 返回：{ segments: [], meta: { lang, tracks, source: 'timedtext' } }

async function fetchTimedText(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
    }
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`fetch failed: ${res.status} ${res.statusText} ${text?.slice(0,200)}`)
  }
  return await res.text()
}

function tryParseJson(text) { try { return JSON.parse(text) } catch { return null } }

function parseTrackListXml(xml) {
  const tracks = []
  const re = /<track\b([^>]+?)\/>/g
  let m
  while ((m = re.exec(xml)) !== null) {
    const attrs = m[1]
    tracks.push({
      id: getAttr(attrs, 'id'),
      lang_code: getAttr(attrs, 'lang_code'),
      lang_original: getAttr(attrs, 'lang_original'),
      name: getAttr(attrs, 'name'),
      kind: getAttr(attrs, 'kind')
    })
  }
  return tracks
}

function getAttr(attrs, key) { const m = new RegExp(`${key}="([^"]*)"`).exec(attrs); return m ? m[1] : undefined }

function pickTrackAdvanced(tracks, desired) {
  if (!Array.isArray(tracks) || tracks.length === 0) return null
  const langsPriority = []
  const d = (desired || '').toLowerCase()
  if (d) langsPriority.push(d)
  langsPriority.push('en', 'en-us', 'en-gb', 'zh-hans', 'zh-hant', 'zh')
  for (const code of langsPriority) {
    const hit = tracks.find(t => (t.lang_code || '').toLowerCase() === code)
    if (hit) return hit
  }
  const enPrefix = tracks.find(t => (t.lang_code || '').toLowerCase().startsWith('en'))
  if (enPrefix) return enPrefix
  return tracks[0]
}

function parseSrv3(json) {
  const out = []
  for (const ev of json.events) {
    const start = (ev.tStartMs || 0) / 1000
    const end = (ev.dDurationMs != null ? (ev.tStartMs + ev.dDurationMs) : ev.tStartMs) / 1000
    const segs = Array.isArray(ev.segs) ? ev.segs.map(s => s.utf8 || '').join('') : ''
    const text = (segs || '').replace(/\s+/g, ' ').trim()
    if (text) { out.push({ start, end, original: text }) }
  }
  return out
}

function parseXmlCaptions(xml) {
  const out = []
  const re = /<text\b[^>]*start="([0-9.]+)"[^>]*dur="([0-9.]+)"[^>]*>([\s\S]*?)<\/text>/g
  let m
  while ((m = re.exec(xml)) !== null) {
    const start = parseFloat(m[1] || '0')
    const dur = parseFloat(m[2] || '0')
    const end = start + dur
    const raw = (m[3] || '')
      .replace(/&#39;/g, "'")
      .replace(/&#34;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/<br\s*\/>/g, '\n')
    const text = (raw || '').replace(/\s+/g, ' ').trim()
    if (text) out.push({ start, end, original: text })
  }
  return out
}

function parseVtt(vtt) {
  if (!vtt || !/^WEBVTT/m.test(vtt)) return []
  const lines = vtt.replace(/\r\n/g, '\n').split('\n')
  const out = []
  let i = 0
  while (i < lines.length) {
    if (!lines[i].trim() || /^WEBVTT/.test(lines[i])) { i++; continue }
    let timeLine = lines[i].trim()
    if (!timeLine.includes('-->') && i + 1 < lines.length) { i++; timeLine = lines[i].trim() }
    if (!timeLine.includes('-->')) { i++; continue }
    const m = timeLine.match(/([0-9:.]+)\s*-->\s*([0-9:.]+)/)
    if (!m) { i++; continue }
    const start = vttTimeToSeconds(m[1])
    const end = vttTimeToSeconds(m[2])
    i++
    const textLines = []
    while (i < lines.length && lines[i].trim()) { textLines.push(lines[i]); i++ }
    const text = (textLines.join('\n') || '').replace(/\s+/g, ' ').trim()
    if (text) out.push({ start, end, original: text })
    while (i < lines.length && !lines[i].trim()) i++
  }
  return out
}

function vttTimeToSeconds(s) {
  const parts = String(s).trim().split(':')
  if (parts.length !== 3) return 0
  const h = parseInt(parts[0], 10) || 0
  const m = parseInt(parts[1], 10) || 0
  const sec = parseFloat(parts[2]) || 0
  return h * 3600 + m * 60 + sec
}

export default async function handler(req, res) {
  try {
    const { videoId, lang, debug } = req.query || {}
    const vid = String(videoId || '').trim()
    const desired = String(lang || 'en').trim()
    const enableDebug = String(debug || '').toLowerCase() === '1'
    const dbg = enableDebug ? { tried: [], notes: [] } : null
    if (!vid) { res.status(400).json({ error: 'BadRequest', message: '缺少 videoId 参数' }); return }

    const listUrl = `https://www.youtube.com/api/timedtext?type=list&v=${encodeURIComponent(vid)}`
    const listXml = await fetchTimedText(listUrl)
    if (dbg) dbg.tried.push(listUrl)
    const allTracks = parseTrackListXml(listXml)
    // 尝试 caps=asr 以便列出自动语音识别轨道
    if ((!allTracks || allTracks.length === 0)) {
      const listAsrUrl = `https://www.youtube.com/api/timedtext?type=list&caps=asr&v=${encodeURIComponent(vid)}`
      try {
        const listAsrXml = await fetchTimedText(listAsrUrl)
        if (dbg) dbg.tried.push(listAsrUrl)
        const tracksAsr = parseTrackListXml(listAsrXml)
        if (tracksAsr && tracksAsr.length) allTracks.push(...tracksAsr)
      } catch {}
    }
    const picked = pickTrackAdvanced(allTracks, desired)
    const langCode = picked?.lang_code || desired || 'en'
    const params = [`lang=${encodeURIComponent(langCode)}`, `v=${encodeURIComponent(vid)}`]
    if (picked?.id) params.push(`id=${encodeURIComponent(picked.id)}`)
    if (picked?.name) params.push(`name=${encodeURIComponent(picked.name)}`)
    if (picked?.kind) params.push(`kind=${encodeURIComponent(picked.kind)}`)
    params.push(`hl=${encodeURIComponent(langCode)}`)
    params.push('client=yt')
    const baseQuery = params.join('&')

    let segments = []
    try {
      const srv3Url = `https://www.youtube.com/api/timedtext?${baseQuery}&fmt=srv3`
      if (dbg) dbg.tried.push(srv3Url)
      const srv3Text = await fetchTimedText(srv3Url)
      const srv3 = tryParseJson(srv3Text)
      if (srv3 && Array.isArray(srv3.events)) segments = parseSrv3(srv3)
      if ((!segments || segments.length === 0)) {
        const json3Url = `https://www.youtube.com/api/timedtext?${baseQuery}&fmt=json3`
        if (dbg) dbg.tried.push(json3Url)
        const json3Text = await fetchTimedText(json3Url)
        const json3 = tryParseJson(json3Text)
        if (json3 && Array.isArray(json3.events)) segments = parseSrv3(json3)
      }
    } catch {}

    if (!segments || segments.length === 0) {
      try {
        const vttUrl = `https://www.youtube.com/api/timedtext?${baseQuery}&fmt=vtt`
        if (dbg) dbg.tried.push(vttUrl)
        const vttText = await fetchTimedText(vttUrl)
        const vttSegs = parseVtt(vttText)
        if (vttSegs && vttSegs.length) segments = vttSegs
      } catch {}
    }

    if (!segments || segments.length === 0) {
      try {
        const xmlUrl = `https://www.youtube.com/api/timedtext?${baseQuery}`
        if (dbg) dbg.tried.push(xmlUrl)
        const xmlText = await fetchTimedText(xmlUrl)
        segments = parseXmlCaptions(xmlText)
      } catch {}
    }

    // 若列表为空或未选择到轨道，直接尝试自动语音识别 asr 轨道
    if (!segments || segments.length === 0) {
      const asrParams = [`lang=${encodeURIComponent(langCode)}`, `v=${encodeURIComponent(vid)}`, 'kind=asr', `hl=${encodeURIComponent(langCode)}`, 'client=yt']
      const asrQuery = asrParams.join('&')
      try {
        const srv3AsrUrl = `https://www.youtube.com/api/timedtext?${asrQuery}&fmt=srv3`
        if (dbg) dbg.tried.push(srv3AsrUrl)
        const srv3AsrText = await fetchTimedText(srv3AsrUrl)
        const srv3Asr = tryParseJson(srv3AsrText)
        if (srv3Asr && Array.isArray(srv3Asr.events)) segments = parseSrv3(srv3Asr)
      } catch {}
      if (!segments || segments.length === 0) {
        try {
          const vttAsrUrl = `https://www.youtube.com/api/timedtext?${asrQuery}&fmt=vtt`
          if (dbg) dbg.tried.push(vttAsrUrl)
          const vttAsrText = await fetchTimedText(vttAsrUrl)
          const vttSegs = parseVtt(vttAsrText)
          if (vttSegs && vttSegs.length) segments = vttSegs
        } catch {}
      }
      if (!segments || segments.length === 0) {
        try {
          const xmlAsrUrl = `https://www.youtube.com/api/timedtext?${asrQuery}`
          if (dbg) dbg.tried.push(xmlAsrUrl)
          const xmlAsrText = await fetchTimedText(xmlAsrUrl)
          const xmlSegs = parseXmlCaptions(xmlAsrText)
          if (xmlSegs && xmlSegs.length) segments = xmlSegs
        } catch {}
      }
    }

    const meta = { lang: langCode, tracks: allTracks, source: 'timedtext' }
    if (dbg) meta.debug = dbg
    const result = { segments, meta }
    try {
      const env = String(process.env.VERCEL_ENV || '').toLowerCase()
      if (env === 'preview' || env === 'development') res.setHeader('Cache-Control', 'no-store')
      else res.setHeader('Cache-Control', 'public, max-age=120')
    } catch { res.setHeader('Cache-Control', 'public, max-age=120') }
    res.status(200).json(result)
  } catch (e) {
    res.status(200).json({ segments: [], meta: { lang: 'en', tracks: [], source: 'error' }, error: 'ProxyError', message: String(e?.message || e) })
  }
}