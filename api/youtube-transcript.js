import captionsSvc from './lib/youtubeCaptions.js'

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
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
  // window.ytcfg.set({ ... });
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
  // Navigate actions -> updateEngagementPanelAction -> transcriptRenderer -> body -> transcriptBodyRenderer -> cueGroups
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

export default async function handler(req, res) {
  const videoIdFromQuery = req.query.videoId || req.body.videoId;
  console.log(`[youtube-transcript] Received request for videoId: ${videoIdFromQuery}`);
  try {
    const { videoId, lang } = (req.method === 'GET' ? req.query : req.body) || {}
    if (!videoId || typeof videoId !== 'string') {
      return res.status(400).json({ error: 'missing videoId' })
    }

    console.log(`[youtube-transcript] Fetching HTML for videoId: ${videoId}`);
    const html = await fetchHtml(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`)
    console.log(`[youtube-transcript] Successfully fetched HTML.`);

    const ytcfg = getYtcfg(html) || {}
    const apiKey = ytcfg?.INNERTUBE_API_KEY || ''
    const clientVersion = ytcfg?.INNERTUBE_CONTEXT?.client?.clientVersion || '2.20241101.00.00'
    console.log(`[youtube-transcript] Extracted apiKey: ${apiKey ? 'OK' : 'FAIL'}`);

    const ytInitialData = extractJson(html, 'var ytInitialData = ', ';') || extractJson(html, 'window["ytInitialData"] = ', ';') || null
    const ytInitialPlayerResponse = extractJson(html, 'var ytInitialPlayerResponse = ', ';') || extractJson(html, 'window["ytInitialPlayerResponse"] = ', ';') || null
    const tracks = parseCaptionTracks(ytInitialPlayerResponse)

    let segments = []
    let source = 'innertube'
    let params = parseTranscriptParams(ytInitialData)
    console.log(`[youtube-transcript] Extracted transcript params: ${params ? 'OK' : 'FAIL'}`);

    if (apiKey && params) {
      try {
        console.log(`[youtube-transcript] Querying Innertube API...`);
        const json = await queryInnertubeTranscript(apiKey, clientVersion, params, (lang || 'en'))
        segments = parseInnertubeTranscript(json)
        console.log(`[youtube-transcript] Innertube returned ${segments.length} segments.`);
      } catch (e) {
        console.warn(`[youtube-transcript] Innertube query failed, falling back to timedtext. Error: ${e.message}`);
        source = 'timedtext'
      }
    } else {
      source = 'timedtext'
    }

    if (!Array.isArray(segments) || segments.length === 0) {
      console.log(`[youtube-transcript] No segments from Innertube, trying fallback captionsSvc.`);
      const fallback = await captionsSvc.getCaptions(videoId, typeof lang === 'string' ? lang : 'en')
      segments = fallback.segments || []
      console.log(`[youtube-transcript] Fallback returned ${segments.length} segments.`);
    }

    res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=600')
    res.status(200).json({ segments, meta: { lang: lang || 'en', tracks, source } })
  } catch (e) {
    console.error('[youtube-transcript] CRITICAL ERROR:', e);
    res.status(500).json({ segments: [], meta: { tracks: [] }, error: 'fetch_failed', message: String(e && e.message || e) })
  }
}