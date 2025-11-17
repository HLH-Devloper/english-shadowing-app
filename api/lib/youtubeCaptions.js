export async function getCaptions(videoId, lang = 'en') {
  if (!videoId || typeof videoId !== 'string') {
    throw new Error('missing videoId')
  }

  const listXml = await fetchTimedText(`https://www.youtube.com/api/timedtext?type=list&v=${encodeURIComponent(videoId)}`)
  const tracks = parseTrackListXml(listXml)
  const picked = pickTrackAdvanced(tracks, lang)

  const langCode = picked?.lang_code || lang
  const isAuto = picked?.kind === 'asr'

  const commonParams = [`lang=${encodeURIComponent(langCode)}`, `v=${encodeURIComponent(videoId)}`]
  if (picked?.name) commonParams.push(`name=${encodeURIComponent(picked.name)}`)
  if (picked?.kind) commonParams.push(`kind=${encodeURIComponent(picked.kind)}`)
  const baseQuery = commonParams.join('&')
  const srv3Url = `https://www.youtube.com/api/timedtext?${baseQuery}&fmt=srv3`
  let segments = null

  try {
    const srv3JsonText = await fetchTimedText(srv3Url)
    const srv3 = tryParseJson(srv3JsonText)
    if (srv3 && Array.isArray(srv3.events)) {
      segments = parseSrv3(srv3)
    }
  } catch (e) {
    segments = null
  }

  if (!segments || segments.length === 0) {
    // 尝试 vtt
    try {
      const vttUrl = `https://www.youtube.com/api/timedtext?${baseQuery}&fmt=vtt`
      const vttText = await fetchTimedText(vttUrl)
      const vttSegs = parseVtt(vttText)
      if (vttSegs && vttSegs.length) segments = vttSegs
    } catch {}
  }

  if (!segments || segments.length === 0) {
    const xmlUrl = `https://www.youtube.com/api/timedtext?${baseQuery}`
    const xmlText = await fetchTimedText(xmlUrl)
    segments = parseXmlCaptions(xmlText)
  }

  return {
    segments: normalizeSegments(segments),
    meta: { lang: langCode, hasAuto: !!isAuto, tracks }
  }
}

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

function tryParseJson(text) {
  try { return JSON.parse(text) } catch { return null }
}

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

function getAttr(attrs, key) {
  const m = new RegExp(`${key}="([^"]*)"`).exec(attrs)
  return m ? m[1] : undefined
}

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
    const text = cleanText(segs)
    if (text) {
      out.push({ start, end, original: text })
    }
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
    const raw = decodeEntities(m[3] || '')
    const text = cleanText(raw)
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
    // 跳过空行与说明行
    if (!lines[i].trim() || /^WEBVTT/.test(lines[i])) { i++; continue }
    // 可选的编号行
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
    const text = cleanText(textLines.join('\n'))
    if (text) out.push({ start, end, original: text })
    // 跳过段落结束的空行
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

function decodeEntities(s) {
  return s
    .replace(/&#39;/g, "'")
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<br\s*\/>/g, '\n')
}

function cleanText(s) {
  const t = (s || '').replace(/\s+/g, ' ').trim()
  return t
}

function normalizeSegments(arr) {
  if (!Array.isArray(arr)) return []
  return arr
    .filter(x => typeof x.start === 'number' && typeof x.end === 'number' && typeof x.original === 'string' && x.original.trim().length > 0)
    .map(x => ({ start: Math.max(0, x.start), end: Math.max(x.start, x.end), original: x.original }))
}

export default { getCaptions }