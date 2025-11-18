#!/usr/bin/env node
// Simple diagnostic script to test YouTube transcript and captions fetching.
// Usage: node scripts/test-youtube-transcript.mjs <videoId> [lang]

import { getTranscript } from '../api/youtube-transcript.js'
import captionsSvc from '../api/lib/youtubeCaptions.js'

function fmtTime(sec) {
  const s = Number(sec || 0)
  const hh = String(Math.floor(s / 3600)).padStart(2, '0')
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(Math.floor(s % 60)).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
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
    const result = await getTranscript({ videoId, lang })
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

    if (!segs.length) {
      console.log('No segments from getTranscript. Trying fallback captionsSvc.getCaptions...')
      const t2 = Date.now()
      const fb = await captionsSvc.getCaptions(videoId, lang)
      const t3 = Date.now()
      const fsegs = Array.isArray(fb?.segments) ? fb.segments : []
      const ftracks = Array.isArray(fb?.meta?.tracks) ? fb.meta.tracks : []
      console.log('Fallback tracks:', ftracks.length)
      if (ftracks.length) {
        for (const t of ftracks.slice(0, 10)) {
          console.log(`- lang_code=${t.lang_code || ''} name=${t.name || ''} kind=${t.kind || ''}`)
        }
      }
      console.log('Fallback segments:', fsegs.length)
      console.log(`Fallback time cost: ${(t3 - t2)} ms`)
      for (const s of fsegs.slice(0, 10)) {
        console.log(`[${fmtTime(s.start)} - ${fmtTime(s.end)}] ${s.original}`)
      }
    }
  } catch (e) {
    console.error('ERROR:', e?.message || e)
    // Print additional error details if available
    if (e?.stack) console.error(e.stack)
    process.exitCode = 2
  }
}

main()