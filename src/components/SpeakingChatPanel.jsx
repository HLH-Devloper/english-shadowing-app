import React, { useEffect, useMemo, useRef, useState } from 'react'

export default function SpeakingChatPanel({ sentence, getMessages, onSend, onClear, loadMessages }) {
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const msgEndRef = useRef(null)
  const messages = useMemo(() => {
    if (!sentence?.id) return [{ role: 'system', content: '请在字幕列表中选择一句话' }]
    return getMessages(sentence.id)
  }, [sentence, getMessages])
  useEffect(() => { if (sentence?.id) loadMessages?.(sentence.id) }, [sentence?.id])
  useEffect(() => { if (msgEndRef.current) msgEndRef.current.scrollIntoView({ behavior: 'smooth' }) }, [messages?.length])
  const handleSend = async () => {
    const text = String(inputText || '').trim()
    if (!text || !sentence?.id || sending) return
    setSending(true)
    try { await onSend?.(sentence.id, text) } finally { setSending(false); setInputText('') }
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
            <div className="bubble-content">{m.content}</div>
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
        <textarea
          className="chat-input"
          placeholder="用英文表达你的意思…"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="chat-actions">
          <button className="secondary-btn" disabled={!sentence?.id} onClick={() => onClear?.(sentence?.id)}>清空本句</button>
          <button className="primary-btn" disabled={!sentence?.id || sending} onClick={handleSend}>{sending ? '发送中…' : '发送'}</button>
        </div>
      </div>
    </div>
  )
}