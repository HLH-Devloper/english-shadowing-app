import React, { useEffect, useMemo, useRef, useState } from 'react'

export default function SpeakingChatPanel({ sentence, getMessages, onSend, onClear, loadMessages }) {
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [preference, setPreference] = useState(() => {
    try { return localStorage.getItem('speakingPref') || 'daily' } catch { return 'daily' }
  })
  const msgEndRef = useRef(null)
  const messages = useMemo(() => {
    if (!sentence?.id) return [{ role: 'system', content: '请在字幕列表中选择一句话' }]
    return getMessages(sentence.id)
  }, [sentence, getMessages])
  useEffect(() => { if (sentence?.id) loadMessages?.(sentence.id) }, [sentence?.id])
  useEffect(() => { if (msgEndRef.current) msgEndRef.current.scrollIntoView({ behavior: 'smooth' }) }, [messages?.length])
  useEffect(() => {
    try { localStorage.setItem('speakingPref', preference) } catch {}
  }, [preference])
  const handleSend = async () => {
    const text = String(inputText || '').trim()
    if (!text || !sentence?.id || sending) return
    setSending(true)
    setInputText('')
    try { await onSend?.(sentence.id, text, preference) } finally { setSending(false) }
  }
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }
  return (
    <div className="speaking-chat-root">
      <div className="chat-body">
        {messages.map((m, idx) => (
          <div key={idx} className={`chat-bubble ${m.role === 'user' ? 'bubble-user' : m.role === 'assistant' ? 'bubble-assistant' : 'bubble-system'}`}>
            {m.role === 'assistant' && typeof m.score === 'number' && (
              <div className="score-badge">评分 {m.score.toFixed(1)}</div>
            )}
            <div className="bubble-content">
              {m.role === 'assistant' && m.upgrades ? (
                <div>
                  {m.overview && (
                    <div style={{ padding: '8px 10px', borderRadius: '10px', background: 'var(--muted, rgba(255,255,255,0.08))', marginBottom: '10px' }}>
                      <div style={{ fontWeight: 600, marginBottom: '6px' }}>整体评价</div>
                      <div>{m.overview}</div>
                    </div>
                  )}
                  {(() => {
                    const pref = m.preferenceEcho || 'daily'
                    const order = pref === 'work' ? ['work', 'basic', 'daily'] : ['daily', 'basic', 'work']
                    return order.map((k) => {
                      const item = m.upgrades?.[k]
                      if (!item || !item.text) return null
                      const title = k === 'basic' ? '基础版' : (k === 'daily' ? '日常版' : '礼貌职场版')
                      return (
                        <div key={k} style={{ padding: '10px 12px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', marginBottom: '10px' }}>
                          <div style={{ fontWeight: 600, marginBottom: '6px' }}>表达升级（{title}）</div>
                          <div style={{ whiteSpace: 'pre-wrap' }}>{item.text}</div>
                          {item.explain && (<div style={{ marginTop: '6px', opacity: 0.9 }}>解释：{item.explain}</div>)}
                        </div>
                      )
                    })
                  })()}
                  {Array.isArray(m.practice) && m.practice.length > 0 && (
                    <div style={{ padding: '8px 10px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', marginTop: '10px' }}>
                      <div style={{ fontWeight: 600, marginBottom: '6px' }}>你的练习题</div>
                      <div style={{ display: 'grid', gap: '6px' }}>
                        {m.practice.slice(0, 2).map((t, i) => (
                          <button key={i} onClick={() => setInputText(String(t))} className="secondary-btn" style={{ textAlign: 'left' }}>{t}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>{m.content}</>
              )}
            </div>
            {m.role === 'assistant' && m.rubric && (
              <div className="rubric-row">
                <span>流利度 {Number(m.rubric.fluency || 0).toFixed(1)}</span>
                <span>准确度 {Number(m.rubric.accuracy || 0).toFixed(1)}</span>
                <span>词汇 {Number(m.rubric.vocabulary || 0).toFixed(1)}</span>
                <span>语法 {Number(m.rubric.grammar || 0).toFixed(1)}</span>
              </div>
            )}
          </div>
        ))}
        <div ref={msgEndRef} />
      </div>
      <div className="chat-input-bar">
        <div className="chat-preference" style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <button className={`pref-btn ${preference === 'daily' ? 'active' : ''}`} onClick={() => setPreference('daily')} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--muted)', background: preference === 'daily' ? 'rgba(34,197,94,0.25)' : 'transparent' }}>日常</button>
          <button className={`pref-btn ${preference === 'work' ? 'active' : ''}`} onClick={() => setPreference('work')} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--muted)', background: preference === 'work' ? 'rgba(59,130,246,0.25)' : 'transparent' }}>职场</button>
        </div>
        <div className="chat-input-row" style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <textarea
            className="chat-input"
            placeholder="用英文表达你的意思…"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ flex: 1 }}
          />
          <button className="primary-btn" disabled={!sentence?.id || sending} onClick={handleSend} style={{ height: '36px' }}>{sending ? '发送中…' : '发送'}</button>
        </div>
        <div className="chat-clear-row" style={{ marginTop: '8px' }}>
          <button className="secondary-btn" disabled={!sentence?.id} onClick={() => onClear?.(sentence?.id)}>清空本句</button>
        </div>
      </div>
    </div>
  )
}