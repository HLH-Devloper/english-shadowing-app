#!/usr/bin/env node
// Simple diagnostic script to test YouTube transcript and captions fetching WITHOUT relying on project internal modules.
// Usage: node scripts/test-youtube-transcript.mjs <videoId> [lang]

function fmtTime(sec) {
  const s = Number(sec || 0)
  const hh = String(Math.floor(s / 3600)).padStart(2, '0')
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(Math.floor(s % 60)).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.youtube.com/',
      'Cookie': 'CONSENT=YES+'
    }
  })
  if (!res.ok) throw new Error(`watch fetch failed: ${res.status} ${res.statusText}`)
  return await res.text()
}

function extractJson(html, markerStart, markerEnd) {
  const sIdx = html.indexOf(markerStart)
  if (sIdx < 0) return null
  const start = sIdx + markerStart.length
  const eIdx = html.indexOf(markerEnd, start)
  if (eIdx < 0) return null
  const raw = html.slice(start, eIdx)
  try { return JSON.parse(raw) } catch { return null }
}

function getYtcfg(html) {
  const re = /ytcfg\.set\((\{[\s\S]*?\})\)/
  const m = re.exec(html)
  if (m) {
    try { return JSON.parse(m[1]) } catch {}
  }
  return null
}

function deepFind(obj, predicate) {
  const stack = [obj]
  while (stack.length) {
    const cur = stack.pop()
    if (!cur || typeof cur !== 'object') continue
    try { if (predicate(cur)) return cur } catch {}
    for (const k in cur) { if (cur[k] && typeof cur[k] === 'object') stack.push(cur[k]) }
  }
  return null
}

function parseTranscriptParams(ytInitialData) {
  const node = deepFind(ytInitialData, (n) => !!n?.transcriptEndpoint?.params)
  return node?.transcriptEndpoint?.params || null
}

function parseCaptionTracks(ytInitialPlayerResponse) {
  const list = ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || []
  return list.map(t => ({
    lang_code: t?.languageCode,
    name: t?.name?.simpleText || t?.name?.runs?.map(r => r.text).join('') || '',
    kind: t?.kind,
    baseUrl: t?.baseUrl,
  }))
}

async function queryInnertubeTranscript(apiKey, clientVersion, params, hl = 'en', gl = 'US') {
  const url = `https://www.youtube.com/youtubei/v1/get_transcript?key=${encodeURIComponent(apiKey)}`
  const body = {
    context: { client: { clientName: 'WEB', clientVersion, hl, gl } },
    params
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
    },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`innertube failed: ${res.status} ${res.statusText}`)
  return await res.json()
}

function parseInnertubeTranscript(json) {
  const actions = json?.actions || []
  const groupsNode = deepFind({ actions }, (n) => Array.isArray(n?.cueGroups))
  const cueGroups = groupsNode?.cueGroups || []
  const segments = []
  for (const g of cueGroups) {
    const cues = g?.cues || []
    for (const c of cues) {
      const r = c?.transcriptCueRenderer
      if (!r) continue
      const start = (r.startOffsetMs || 0) / 1000
      const end = start + (r.durationMs || 0) / 1000
      const text = (r?.cue?.simpleText) || (Array.isArray(r?.cue?.runs) ? r.cue.runs.map(x => x.text || '').join('') : '')
      const norm = String(text || '').replace(/\s+/g, ' ').trim()
      if (norm) segments.push({ start, end, original: norm })
    }
  }
  return segments
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
    const text = (segs || '').replace(/\s+/g, ' ').trim()
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

async function getTranscriptStandalone({ videoId, lang }) {
  const html = await fetchHtml(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`)
  const ytcfg = getYtcfg(html) || {}
  const apiKey = ytcfg?.INNERTUBE_API_KEY || ''
  const clientVersion = ytcfg?.INNERTUBE_CONTEXT?.client?.clientVersion || '2.20241101.00.00'
  const ytInitialData = extractJson(html, 'var ytInitialData = ', ';') || extractJson(html, 'window["ytInitialData"] = ', ';') || null
  const ytInitialPlayerResponse = extractJson(html, 'var ytInitialPlayerResponse = ', ';') || extractJson(html, 'window["ytInitialPlayerResponse"] = ', ';') || null
  const tracks = parseCaptionTracks(ytInitialPlayerResponse)

  let segments = []
  let source = 'innertube'
  let params = parseTranscriptParams(ytInitialData)

  if (apiKey && params) {
    try {
      const json = await queryInnertubeTranscript(apiKey, clientVersion, params, (lang || 'en'))
      segments = parseInnertubeTranscript(json)
    } catch (e) {
      source = 'timedtext'
    }
  } else {
    source = 'timedtext'
  }

  if (!Array.isArray(segments) || segments.length === 0) {
    // fallback to timedtext
    const listXml = await fetchTimedText(`https://www.youtube.com/api/timedtext?type=list&v=${encodeURIComponent(videoId)}`)
    const allTracks = parseTrackListXml(listXml)
    const picked = pickTrackAdvanced(allTracks, lang)

    const langCode = picked?.lang_code || lang || 'en'
    const params = [`lang=${encodeURIComponent(langCode)}`, `v=${encodeURIComponent(videoId)}`]
    if (picked?.name) params.push(`name=${encodeURIComponent(picked.name)}`)
    if (picked?.kind) params.push(`kind=${encodeURIComponent(picked.kind)}`)
    const baseQuery = params.join('&')

    // try srv3
    try {
      const srv3Text = await fetchTimedText(`https://www.youtube.com/api/timedtext?${baseQuery}&fmt=srv3`)
      const srv3 = tryParseJson(srv3Text)
      if (srv3 && Array.isArray(srv3.events)) {
        segments = parseSrv3(srv3)
      }
    } catch {}

    // try vtt
    if (!segments || segments.length === 0) {
      try {
        const vttText = await fetchTimedText(`https://www.youtube.com/api/timedtext?${baseQuery}&fmt=vtt`)
        const vttSegs = parseVtt(vttText)
        if (vttSegs && vttSegs.length) segments = vttSegs
      } catch {}
    }

    // try xml
    if (!segments || segments.length === 0) {
      try {
        const xmlText = await fetchTimedText(`https://www.youtube.com/api/timedtext?${baseQuery}`)
        segments = parseXmlCaptions(xmlText)
      } catch {}
    }

    return { segments, meta: { lang: langCode, tracks: allTracks, source } }
  }

  return { segments, meta: { lang: lang || 'en', tracks, source } }
}

async function main() {
  const videoId = process.argv[2]
  const lang = process.argv[3] || 'en'
  if (!videoId) {
    console.error('Missing videoId. Usage: node scripts/test-youtube-transcript.mjs <videoId> [lang]')
    process.exit(1)
  }

  console.log('--- YouTube Transcript Diagnostic ---')
  console.log('Video ID:', videoId)
  console.log('Language:', lang)

  try {
    const t0 = Date.now()
    const result = await getTranscriptStandalone({ videoId, lang })
    const t1 = Date.now()
    const segs = Array.isArray(result?.segments) ? result.segments : []
    const tracks = Array.isArray(result?.meta?.tracks) ? result.meta.tracks : []
    console.log('Source:', result?.meta?.source || 'unknown')
    console.log('Tracks found:', tracks.length)
    if (tracks.length) {
      for (const t of tracks.slice(0, 10)) {
        console.log(`- lang_code=${t.lang_code || ''} name=${t.name || ''} kind=${t.kind || ''}`)
      }
    }
    console.log('Segments fetched:', segs.length)
    console.log(`Time cost: ${(t1 - t0)} ms`)
    for (const s of segs.slice(0, 10)) {
      console.log(`[${fmtTime(s.start)} - ${fmtTime(s.end)}] ${s.original}`)
    }
  } catch (e) {
    console.error('ERROR:', e?.message || e)
    if (e?.stack) console.error(e.stack)
    process.exitCode = 2
  }
}

main()