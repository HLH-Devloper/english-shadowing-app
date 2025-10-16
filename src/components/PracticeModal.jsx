import React, { useEffect, useRef, useState } from 'react'

// 简易文本清理
const normalizeText = (t) => (String(t || '')
  .toLowerCase()
  .replace(/[^a-z0-9\s']/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim())

// Levenshtein 编辑距离
const editDistance = (a, b) => {
  const s = normalizeText(a)
  const t = normalizeText(b)
  const m = s.length
  const n = t.length
  if (m === 0) return n
  if (n === 0) return m
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      )
    }
  }
  return dp[m][n]
}

// 依据录音 Blob 粗略分析停顿占比（静音帧比例）
const analyzePausesFromBlob = async (blob) => {
  try {
    const buf = await blob.arrayBuffer()
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const decoded = await audioCtx.decodeAudioData(buf)
    const ch = decoded.getChannelData(0)
    let silent = 0
    const total = ch.length
    const thresh = 0.015 // 简易门限
    for (let i = 0; i < total; i++) {
      if (Math.abs(ch[i]) < thresh) silent++
    }
    try { await audioCtx.close() } catch {}
    return total > 0 ? (silent / total) : 0
  } catch {
    return undefined
  }
}

// 打分算法：准确度、流利度、发音（含子项）
const scoreSpeech = ({ targetText, recognizedText, durationSec, confidenceAvg, pauseRatio }) => {
  const sTarget = normalizeText(targetText)
  const sRecog = normalizeText(recognizedText)
  const maxLen = Math.max(sTarget.length, sRecog.length) || 1
  const dist = editDistance(sTarget, sRecog)
  const accuracy = Math.max(0, Math.min(100, Math.round((1 - dist / maxLen) * 100)))

  const words = sRecog ? sRecog.split(' ').filter(Boolean).length : 0
  const wps = durationSec > 0 ? words / durationSec : 0
  // 经验值：每秒 1.6~2.2 词较为自然，映射到 100 分
  const targetWps = 2.0
  const fluencyRaw = Math.max(0, Math.min(100, Math.round((wps / targetWps) * 100)))
  const pausePenalty = (typeof pauseRatio === 'number') ? Math.min(30, Math.round(pauseRatio * 100 * 0.3)) : 0
  const fluency = Math.max(0, fluencyRaw - pausePenalty)

  // 发音子项（启发式）
  const vowels = 'aeiou'
  const countRate = (src, dst, filter) => {
    const s = Array.from(src).filter(filter).length
    const t = Array.from(dst).filter(filter).length
    const common = Math.min(s, t)
    return s > 0 ? Math.round((common / s) * 100) : 0
  }
  const vowelClarity = countRate(sTarget, sRecog, c => vowels.includes(c))
  const consonantArticulation = countRate(sTarget, sRecog, c => /[a-z]/.test(c) && !vowels.includes(c))
  const stressControl = Math.max(0, Math.min(100, 100 - pausePenalty)) // 用停顿惩罚近似重读控制

  let pronunciation = 0
  if (typeof confidenceAvg === 'number' && !Number.isNaN(confidenceAvg)) {
    const confScore = Math.max(0, Math.min(100, Math.round(confidenceAvg * 100)))
    pronunciation = Math.round(vowelClarity * 0.4 + consonantArticulation * 0.4 + stressControl * 0.2)
    // 轻度融合识别置信度
    pronunciation = Math.round(pronunciation * 0.7 + confScore * 0.3)
  } else {
    pronunciation = Math.round(vowelClarity * 0.45 + consonantArticulation * 0.35 + stressControl * 0.20)
  }

  const overall = Math.round(accuracy * 0.5 + fluency * 0.2 + pronunciation * 0.3)

  // 改进建议
  const suggestions = []
  if (accuracy < 85) suggestions.push('关注关键单词的准确发音与连读，避免漏读或替换。')
  if (fluency < 85) suggestions.push('放慢语速并减少停顿，保持句子节奏自然均衡。')
  if (pronunciation < 85) suggestions.push('加强元音/辅音清晰度，重读与弱读分明，提升整体口型控制。')
  if (suggestions.length === 0) suggestions.push('表现不错！继续保持节奏与准确度，尝试更复杂句子。')

  return {
    accuracy,
    fluency,
    pronunciation,
    overall,
    suggestions,
    breakdown: { vowelClarity, consonantArticulation, stressControl, pauseRatio }
  }
}

export default function PracticeModal({ isOpen, onClose, targetText }) {
  const [isRecording, setIsRecording] = useState(false)
  const [recognizedText, setRecognizedText] = useState('')
  const [scores, setScores] = useState(null)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [attempts, setAttempts] = useState([])
  const [attemptCount, setAttemptCount] = useState(0)
  const [showBreakdown, setShowBreakdown] = useState(false)

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const startTimeRef = useRef(0)

  const audioCtxRef = useRef(null)
  const analyserRef = useRef(null)
  const sourceRef = useRef(null)
  const rafRef = useRef(null)
  const canvasRef = useRef(null)

  const recognitionRef = useRef(null)
  const recogConfidenceSumRef = useRef(0)
  const recogConfidenceCntRef = useRef(0)
  const recogTextRef = useRef('')
  // 等待识别结束后再打分，避免出现“识别文本后来才到”的竞态
  const pendingScoreRef = useRef(null)
  const finalizeTimerRef = useRef(null)

  // 每次打开弹窗时重置状态，避免计数停留在 4/4
  useEffect(() => {
    if (isOpen) {
      try {
        setIsRecording(false)
        setRecognizedText('')
        setScores(null)
        setDuration(0)
        setAttempts([])
        setAttemptCount(0)
        recogTextRef.current = ''
        recogConfidenceSumRef.current = 0
        recogConfidenceCntRef.current = 0
      } catch {}
    }
  }, [isOpen])

  // 分数生成后记录最近尝试（最多 5 次），并维护完成计数（最多 5 次）
  useEffect(() => {
    if (!scores) return
    try {
      const snapText = recogTextRef.current || recognizedText
      setAttempts(prev => {
        const next = [...prev, { text: snapText, duration, scores, ts: Date.now() }]
        return next.slice(-5)
      })
      setAttemptCount(c => Math.min(5, c + 1))
    } catch {}
  }, [scores])

  const stopWave = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
  }

  const drawWave = () => {
    const canvas = canvasRef.current
    const analyser = analyserRef.current
    if (!canvas || !analyser) return
    const ctx = canvas.getContext('2d')
    const bufferLen = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLen)

    const render = () => {
      analyser.getByteTimeDomainData(dataArray)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.lineWidth = 2
      ctx.strokeStyle = '#4ade80' // 绿色
      ctx.beginPath()
      const sliceWidth = canvas.width * 1.0 / bufferLen
      let x = 0
      for (let i = 0; i < bufferLen; i++) {
        const v = dataArray[i] / 128.0
        const y = v * canvas.height / 2
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
        x += sliceWidth
      }
      ctx.lineTo(canvas.width, canvas.height / 2)
      ctx.stroke()
      rafRef.current = requestAnimationFrame(render)
    }
    render()
  }

  const cleanupAudio = () => {
    stopWave()
    try { sourceRef.current?.disconnect() } catch {}
    try { analyserRef.current?.disconnect() } catch {}
    try { audioCtxRef.current?.close() } catch {}
    audioCtxRef.current = null
    analyserRef.current = null
    sourceRef.current = null
  }

  const startRecognition = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const recog = new SR()
    // 如果目标文本包含中文，优先中文识别
    const hasZh = /[\u4e00-\u9fff]/.test(String(targetText || ''))
    recog.lang = hasZh ? 'zh-CN' : 'en-US'
    recog.interimResults = true
    recog.continuous = true
    // 提高识别质量：启用多个备选并选择置信度最高的结果
    try { recog.maxAlternatives = 3 } catch {}
    // 开始识别前清空上一轮的文本与计数
    recogTextRef.current = ''
    setRecognizedText('')
    recogConfidenceSumRef.current = 0
    recogConfidenceCntRef.current = 0

    recog.onresult = (event) => {
      try {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i]
          let alt = res[0]
          // 若存在多个备选，优先选择置信度最高的一项
          try {
            const candidates = Array.from(res)
            if (candidates.length > 1) {
              candidates.sort((a, b) => (b?.confidence || 0) - (a?.confidence || 0))
              alt = candidates[0]
            }
          } catch {}
          if (res.isFinal && alt?.transcript) {
            const next = (recogTextRef.current ? recogTextRef.current + ' ' : '') + alt.transcript
            recogTextRef.current = next
            setRecognizedText(next)
            if (typeof alt?.confidence === 'number') {
              recogConfidenceSumRef.current += alt.confidence
              recogConfidenceCntRef.current += 1
            }
          }
        }
      } catch {}
    }
    recog.onerror = () => {}
    recog.onend = () => {
      // 识别彻底结束后再依据当前的 recognizedText 计算分数
      try {
        if (finalizeTimerRef.current) { clearTimeout(finalizeTimerRef.current); finalizeTimerRef.current = null }
        finalizeScores()
      } catch {}
    }
    recognitionRef.current = recog
    try { recog.start() } catch {}
  }

  const stopRecognition = () => {
    try { recognitionRef.current?.stop() } catch {}
    recognitionRef.current = null
  }

  const finalizeScores = async () => {
    const pending = pendingScoreRef.current
    if (!pending) return
    const { dur, confAvg, blobPauseRatio } = pending
    const s = scoreSpeech({
      targetText,
      recognizedText: recogTextRef.current || recognizedText,
      durationSec: dur,
      confidenceAvg: confAvg,
      pauseRatio: blobPauseRatio,
    })
    setScores(s)
    pendingScoreRef.current = null
  }

  const startRecording = async () => {
    setError('')
    setRecognizedText('')
    setScores(null)
    setDuration(0)
    // 清理上一次的录音 URL
    try { if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl('') } } catch {}
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []
      startTimeRef.current = performance.now()

      // WebAudio 可视化
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 2048
      source.connect(analyser)
      audioCtxRef.current = audioCtx
      analyserRef.current = analyser
      sourceRef.current = source
      drawWave()

      // 语音识别（并行进行）
      startRecognition()

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }
      mediaRecorder.onstop = async () => {
        const end = performance.now()
        const dur = Math.max(0, (end - startTimeRef.current) / 1000)
        setDuration(dur)
        cleanupAudio()
        stopRecognition()

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        try {
          const url = URL.createObjectURL(blob)
          setAudioUrl(url)
        } catch {}
        // 可选：未来上传到后端进行更精细的打分
        const confAvg = (recogConfidenceCntRef.current > 0)
          ? (recogConfidenceSumRef.current / recogConfidenceCntRef.current)
          : undefined
        let pauseRatio
        try { pauseRatio = await analyzePausesFromBlob(blob) } catch {}
        // 设置待计算分数数据，实际计算在识别 onend 或延时回调中触发
        pendingScoreRef.current = { dur, confAvg, blobPauseRatio: pauseRatio }
        // 兜底：若 onend 未触发或过慢，延时进行一次计算
        try {
          finalizeTimerRef.current = setTimeout(() => { finalizeScores() }, 350)
        } catch {}
        // 重置计数器
        recogConfidenceSumRef.current = 0
        recogConfidenceCntRef.current = 0

        // 暴露录音 blob 以便调试或下载（可选）
        try { window.__lastPracticeBlob = blob } catch {}
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (err) {
      setError('无法访问麦克风，请检查浏览器权限设置。')
      console.error(err)
    }
  }

  const stopRecording = () => {
    try { mediaRecorderRef.current?.stop() } catch {}
    setIsRecording(false)
  }

  useEffect(() => {
    return () => {
      stopRecognition()
      cleanupAudio()
      try { mediaRecorderRef.current?.stop() } catch {}
      try { if (audioUrl) URL.revokeObjectURL(audioUrl) } catch {}
    }
  }, [audioUrl])

  // 支持按 Esc 关闭弹窗
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        try { stopRecognition(); cleanupAudio(); } catch {}
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!isOpen) return null

  // 步骤状态：1 目标句子 / 2 录音中 / 3 识别中 / 4 评分完成
  const step = isRecording ? 2 : (scores ? 4 : ((recognizedText || audioUrl) ? 3 : 1))

  return (
    <div className="practice-overlay" role="dialog" aria-modal="true">
      <div className="practice-modal">
        <div className="practice-header">
          <div className="practice-title">跟读结果</div>
          <button className="practice-close" onClick={onClose}>✕</button>
        </div>

        <div className="practice-steps">
          <span className="step-index">{attemptCount}/5</span>
          <span className="step-label">{step === 1 ? '目标句子' : step === 2 ? '录音中' : step === 3 ? '识别中' : '评分完成'}</span>
        </div>
        <div className="practice-section-title">目标句子 <button className="practice-btn" onClick={() => replayTargetSentence(targetText)} title="复读原句" style={{ marginLeft: 8, padding: '2px 8px', fontSize: 12 }}>🔁 复读</button></div>
        <div className="practice-target" onClick={() => replayTargetSentence(targetText)} title="点击复读原句">{targetText || '（当前句子为空）'}</div>

        <div className="practice-recorder">
          <canvas ref={canvasRef} className="practice-wave" width={420} height={48} />
          <div className="practice-actions">
            {!isRecording ? (
              <button className="practice-btn primary" onClick={startRecording} title="开始录音">🎙️ 开始</button>
            ) : (
              <button className="practice-btn danger" onClick={stopRecording} title="停止录音">⏹️ 停止</button>
            )}
            {duration > 0 && (
              <span className="practice-duration" aria-live="polite">时长：{duration.toFixed(2)}s</span>
            )}
          </div>
          {error && (<div className="practice-error" role="alert">{error}</div>)}
        </div>

        <div className="practice-section-title">您的录音</div>
        {audioUrl ? (
          <audio className="practice-audio" controls src={audioUrl} />
        ) : (
          <div className="practice-transcript" style={{ opacity: 0.8 }}>（录音结束后可回放）</div>
        )}

        <div className="practice-result">
          <div className="practice-section-title">识别文本（最多显示最近 5 次）</div>
          <div className="practice-transcript" title={(attempts[attempts.length-1]?.text || recognizedText || '')}>
            {(attempts.length > 0 ? attempts.slice().reverse() : [{ text: recognizedText }]).map((a, idx) => (
              <div className="attempt-line" key={idx} style={{ marginTop: idx === 0 ? 0 : 6, opacity: attempts.length > 0 ? Math.max(0.6, 1 - idx * 0.08) : 1 }}>
                {renderHighlighted(a.text, attempts.length > 0 && idx > 0, targetText)}
              </div>
            ))}
          </div>

          <div className="practice-section-title">评分结果</div>
          <div className="score-row">
            <span className="score-label">准确度</span>
            <div className="score-bar"><div className="score-fill" style={{ width: `${scores?.accuracy || 0}%`, background: '#22c55e' }} /></div>
            <span className="score-value">{scores ? `${scores.accuracy}%` : '--'}</span>
          </div>
          <div className="score-row">
            <span className="score-label">流利度</span>
            <div className="score-bar"><div className="score-fill" style={{ width: `${scores?.fluency || 0}%`, background: '#0ea5e9' }} /></div>
            <span className="score-value">{scores ? `${scores.fluency}%` : '--'}</span>
          </div>
          <div className="score-row">
            <span className="score-label">发音</span>
            <div className="score-bar"><div className="score-fill" style={{ width: `${scores?.pronunciation || 0}%`, background: '#f59e0b' }} /></div>
            <span className="score-value">{scores ? `${scores.pronunciation}%` : '--'}</span>
          </div>

          <div className="practice-section-title" style={{ display: 'flex', alignItems: 'center' }}>
            <span>发音子项</span>
            <span
              className="collapse-arrow"
              onClick={() => setShowBreakdown(v => !v)}
              aria-expanded={showBreakdown}
              title={showBreakdown ? '收起' : '展开'}
              style={{ marginLeft: 6 }}
            >{showBreakdown ? '▾' : '▸'}</span>
          </div>
          {showBreakdown && (
            <>
              <div className="score-row">
                <span className="score-label">元音清晰</span>
                <div className="score-bar"><div className="score-fill" style={{ width: `${scores?.breakdown?.vowelClarity || 0}%`, background: 'var(--practice-accent, #22c55e)' }} /></div>
                <span className="score-value">{scores ? `${scores.breakdown.vowelClarity}%` : '--'}</span>
              </div>
              <div className="score-row">
                <span className="score-label">辅音清晰</span>
                <div className="score-bar"><div className="score-fill" style={{ width: `${scores?.breakdown?.consonantArticulation || 0}%`, background: 'var(--practice-accent-2, #0ea5e9)' }} /></div>
                <span className="score-value">{scores ? `${scores.breakdown.consonantArticulation}%` : '--'}</span>
              </div>
              <div className="score-row">
                <span className="score-label">重读控制</span>
                <div className="score-bar"><div className="score-fill" style={{ width: `${scores?.breakdown?.stressControl || 0}%`, background: 'var(--practice-accent-3, #f59e0b)' }} /></div>
                <span className="score-value">{scores ? `${scores.breakdown.stressControl}%` : '--'}</span>
              </div>
              <div className="score-row">
                <span className="score-label">停顿占比</span>
                <div className="score-bar"><div className="score-fill" style={{ width: `${Math.round(((scores?.breakdown?.pauseRatio)||0)*100)}%`, background: '#64748b' }} /></div>
                <span className="score-value">{scores ? `${Math.round(((scores.breakdown.pauseRatio)||0)*100)}%` : '--'}</span>
              </div>
            </>
          )}

          <div className="practice-overall">总分：<strong>{scores ? scores.overall : '--'}</strong>{attempts.length > 0 && (
            <span style={{ marginLeft: 8, color: '#94a3b8' }}>历史最佳：{Math.max(...attempts.map(a => a.scores?.overall || 0))}</span>
          )}</div>
        </div>

        <div className="practice-suggestions">
          <div className="practice-section-title">改进建议</div>
          <ul>
            {(scores?.suggestions || ['录音完成后将给出针对性建议。']).map((s, idx) => (
              <li key={idx}>• {s}</li>
            ))}
          </ul>
        </div>

        <div className="practice-footer">
          <button className="practice-btn" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  )
}
  // 复读目标句：使用浏览器 TTS（传入目标文本）
  const replayTargetSentence = (target) => {
    try {
      const synth = window.speechSynthesis
      if (!synth) return
      synth.cancel()
      const utter = new SpeechSynthesisUtterance(String(target || ''))
      const hasZh = /[\u4e00-\u9fff]/.test(String(target || ''))
      utter.lang = hasZh ? 'zh-CN' : 'en-US'
      const voices = synth.getVoices?.() || []
      const pick = voices.find(v => v.lang?.toLowerCase().includes(utter.lang.toLowerCase()))
      if (pick) utter.voice = pick
      synth.speak(utter)
    } catch {}
  }

  // 词级差异标记（基于 LCS）
  const tokenize = (s) => normalizeText(s).split(' ').filter(Boolean)
  // 对识别文本进行更强的去重：
  // 1) 连续重复词压缩为一个；
  // 2) 连续重复短语（2~8 词）整体去重，解决“整句重复”问题。
  const tokenizeRecog = (s) => {
    const arr = normalizeText(s).split(' ').filter(Boolean)
    const out = []
    for (let i = 0; i < arr.length; i++) {
      // 检测短语级重复：当前片段与紧邻之前的片段完全相同，则跳过当前片段
      let skipped = false
      for (let ws = Math.min(8, i); ws >= 2; ws--) {
        // 比较 [i-ws, i) 与 [i, i+ws)
        if (i + ws <= arr.length) {
          let same = true
          for (let k = 0; k < ws; k++) {
            if (arr[i - ws + k] !== arr[i + k]) { same = false; break }
          }
          if (same) { i += ws - 1; skipped = true; break }
        }
      }
      if (skipped) continue
      // 单词级重复压缩
      if (out[out.length - 1] === arr[i]) continue
      out.push(arr[i])
    }
    return out
  }
  const computeWordDiff = (target, recog) => {
    const a = tokenize(target)
    const b = tokenizeRecog(recog)
    const m = a.length, n = b.length
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1])
      }
    }
    const matchA = new Set(), matchB = new Set()
    let i = m, j = n
    while (i > 0 && j > 0) {
      if (a[i-1] === b[j-1]) { matchA.add(i-1); matchB.add(j-1); i--; j--; }
      else if (dp[i-1][j] >= dp[i][j-1]) i--; else j--
    }
    const missing = []
    for (let k = 0; k < a.length; k++) if (!matchA.has(k)) missing.push(a[k])
    const tokens = b.map((w, idx) => ({ w, ok: matchB.has(idx) }))
    return { tokens, missing }
  }
  const renderHighlighted = (text, faint = false, target = '') => {
    const { tokens, missing } = computeWordDiff(target || '', text || '')
    return (
      <>
        <div>
          {tokens.length === 0 ? (
            <span style={{ opacity: 0.8 }}>（等待录音或识别结果）</span>
          ) : tokens.map((t, i) => (
            <span key={i} className={t.ok ? 'diff-ok' : 'diff-bad'} style={faint ? { opacity: 0.75 } : undefined}>{t.w}</span>
          ))}
        </div>
        {missing.length > 0 && (
          <div className="diff-miss-inline" style={faint ? { opacity: 0.6 } : undefined}>缺失：{missing.join(' ')}</div>
        )}
      </>
    )
  }