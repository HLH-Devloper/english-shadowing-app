import React, { useMemo, useState } from 'react'

export default function CaptionsTestPage() {
  const [input, setInput] = useState('')
  const [lang, setLang] = useState('en')
  const [endpoint, setEndpoint] = useState('youtube-transcript')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)

  const videoId = useMemo(() => extractVideoId(input), [input])

  async function handleFetch() {
    setLoading(true)
    setError('')
    setData(null)
    try {
      if (!videoId) {
        throw new Error('请输入有效的视频统一资源定位符(Uniform Resource Locator)或视频标识(videoId)。')
      }
      const qs = new URLSearchParams({ videoId, lang }).toString()
      const url = `/api/${endpoint}?${qs}`
      const res = await fetch(url)
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(`接口返回错误：${res.status} ${res.statusText} ${txt}`)
      }
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  const segments = Array.isArray(data?.segments) ? data.segments : []
  const tracks = Array.isArray(data?.meta?.tracks) ? data.meta.tracks : []
  const source = data?.meta?.source || 'unknown'

  return (
    <div style={styles.wrap}>
      <h2>YouTube 字幕抓取测试页</h2>
      <p style={styles.tip}>此页面仅用于预览环境测试，不影响正式站点。请输入视频统一资源定位符(Uniform Resource Locator)或视频标识(videoId)。</p>

      <div style={styles.formRow}>
        <label style={styles.label}>视频统一资源定位符(Uniform Resource Locator) 或 videoId：</label>
        <input style={styles.input} placeholder="例如：https://www.youtube.com/watch?v=zc3UQQVgQ1s 或 zc3UQQVgQ1s" value={input} onChange={e => setInput(e.target.value)} />
      </div>

      <div style={styles.formRow}>
        <label style={styles.label}>语言(Language)：</label>
        <input style={styles.input} value={lang} onChange={e => setLang(e.target.value)} />
      </div>

      <div style={styles.formRow}>
        <label style={styles.label}>接口(Endpoint)：</label>
        <select style={styles.select} value={endpoint} onChange={e => setEndpoint(e.target.value)}>
          <option value="youtube-transcript">/api/youtube-transcript (内部接口优先，自动回退)</option>
          <option value="youtube-captions">/api/youtube-captions (公开 timedtext 回退)</option>
        </select>
      </div>

      <div style={styles.formRow}>
        <button style={styles.btn} onClick={handleFetch} disabled={loading}> {loading ? '抓取中…' : '抓取字幕'} </button>
        <span style={{ marginLeft: 12, color: '#888' }}>解析到的 videoId：{videoId || '无'}</span>
      </div>

      {error && (
        <div style={styles.error}>错误：{error}</div>
      )}

      {data && (
        <div style={styles.result}>
          <div style={styles.metaLine}>来源(Source)：<b>{source}</b></div>
          <div style={styles.metaLine}>字幕轨道(Tracks)：{tracks.length}</div>
          {tracks.length > 0 && (
            <div style={styles.block}>
              <h4>轨道列表（最多显示 10 条）</h4>
              <ul>
                {tracks.slice(0, 10).map((t, i) => (
                  <li key={i}>
                    lang_code={t.lang_code || ''} name={t.name || ''} kind={t.kind || ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div style={styles.metaLine}>字幕段(Segments)：{segments.length}</div>
          {segments.length > 0 && (
            <div style={styles.block}>
              <h4>前 20 条片段</h4>
              <ol>
                {segments.slice(0, 20).map((s, i) => (
                  <li key={i}>
                    [{fmtTime(s.start)} - {fmtTime(s.end)}] {s.original}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function fmtTime(sec) {
  const s = Number(sec || 0)
  const hh = String(Math.floor(s / 3600)).padStart(2, '0')
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(Math.floor(s % 60)).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

function extractVideoId(input) {
  const s = String(input || '').trim()
  if (!s) return ''
  // 支持 watch、shorts、youtu.be 三种常见格式
  try {
    if (s.includes('youtu.be/')) {
      const m = s.match(/youtu\.be\/([\w-]{6,})/)
      return m ? m[1] : ''
    }
    if (s.includes('youtube.com/watch')) {
      const u = new URL(s)
      return u.searchParams.get('v') || ''
    }
    if (s.includes('youtube.com/shorts/')) {
      const m = s.match(/shorts\/([\w-]{6,})/)
      return m ? m[1] : ''
    }
  } catch {}
  // 如果就是 videoId
  if (/^[\w-]{6,}$/.test(s)) return s
  return ''
}

const styles = {
  wrap: { maxWidth: 900, margin: '24px auto', padding: 16 },
  tip: { color: '#666', fontSize: 14 },
  formRow: { display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0' },
  label: { minWidth: 220 },
  input: { flex: 1, padding: '8px 10px', borderRadius: 4, border: '1px solid #ccc' },
  select: { padding: '8px 10px', borderRadius: 4, border: '1px solid #ccc' },
  btn: { padding: '8px 12px', borderRadius: 4, background: '#0070f3', color: '#fff', border: 'none', cursor: 'pointer' },
  error: { marginTop: 12, color: '#c00' },
  result: { marginTop: 16 },
  metaLine: { margin: '8px 0' },
  block: { margin: '12px 0' }
}