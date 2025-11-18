import React, { useEffect, useMemo, useRef, useState } from 'react'
import '../speaking-modern.css'

export default function SpeakingChatPanel({ sentence, getMessages, onSend, onClear, loadMessages }) {
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [preference, setPreference] = useState(() => {
    try { return localStorage.getItem('speakingPref') || 'daily' } catch { return 'daily' }
  })
  const msgEndRef = useRef(null)
  const messages = useMemo(() => {
    if (!sentence?.id) return [{ role: 'system', content: '请在字幕列表中选择一句话' }]
    const allMessages = getMessages(sentence.id)
    // 过滤掉显示当前句子的系统消息（因为顶部已经有句子卡片了）
    return allMessages.filter(m => {
      // 如果是系统消息且包含当前句子的英文或中文，则过滤掉
      if (m.role === 'system') {
        const content = String(m.content || '').trim()
        const original = String(sentence.original || sentence.text || '').trim()
        const translation = String(sentence.translation || '').trim()
        // 如果系统消息包含当前句子的完整文本，则认为是重复的句子展示
        if (original && content.includes(original)) return false
        if (translation && content.includes(translation)) return false
      }
      return true
    })
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
      {/* 当前句子卡片 */}
      {sentence?.id && (
        <div className="chat-sentence-card">
          <div className="sentence-original">{sentence.original || sentence.text || ''}</div>
          {sentence.translation && (
            <div className="sentence-translation">{sentence.translation}</div>
          )}
        </div>
      )}

      <div className="chat-body">
        {messages.map((m, idx) => (
          <div key={idx} className={`chat-bubble ${m.role === 'user' ? 'bubble-user' : m.role === 'assistant' ? 'bubble-assistant' : 'bubble-system'}`}>
            {m.role === 'assistant' && typeof m.score === 'number' && (
              <div className="score-badge">{m.score.toFixed(1)}</div>
            )}
            <div className="bubble-content">
              {m.role === 'assistant' && m.upgrades ? (
                <div>
                  {m.overview && (
                    <div className="overview-card">
                      <div className="overview-card-title">整体评价</div>
                      <div className="overview-card-content">{m.overview}</div>
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
                        <div key={k} className={`upgrade-card ${k}`}>
                          <div className="upgrade-card-title">表达升级（{title}）</div>
                          <div className="upgrade-card-text">{item.text}</div>
                          {item.explain && (
                            <div className="upgrade-card-explain">解释：{item.explain}</div>
                          )}
                        </div>
                      )
                    })
                  })()}
                  {Array.isArray(m.practice) && m.practice.length > 0 && (
                    <div className="practice-card">
                      <div className="practice-card-title">你的练习题</div>
                      <ol className="practice-list">
                        {m.practice.slice(0, 2).map((t, i) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              ) : (
                <>{m.content}</>
              )}
            </div>
            {m.role === 'assistant' && m.rubric && (
              <div className="rubric-row">
                <div className="rubric-item">
                  <span className="icon">🎯</span>
                  <span className="label">流利度</span>
                  <span className="score">{Number(m.rubric.fluency || 0).toFixed(1)}</span>
                </div>
                <div className="rubric-item">
                  <span className="icon">✅</span>
                  <span className="label">准确度</span>
                  <span className="score">{Number(m.rubric.accuracy || 0).toFixed(1)}</span>
                </div>
                <div className="rubric-item">
                  <span className="icon">📚</span>
                  <span className="label">词汇</span>
                  <span className="score">{Number(m.rubric.vocabulary || 0).toFixed(1)}</span>
                </div>
                <div className="rubric-item">
                  <span className="icon">📝</span>
                  <span className="label">语法</span>
                  <span className="score">{Number(m.rubric.grammar || 0).toFixed(1)}</span>
                </div>
              </div>
            )}
          </div>
        ))}
        {sending && (
          <div className="loading-indicator">
            <div className="loading-dot"></div>
            <div className="loading-dot"></div>
            <div className="loading-dot"></div>
          </div>
        )}
        <div ref={msgEndRef} />
      </div>
      <div className="chat-input-bar">
        <div className="chat-preference">
          <button
            className={`pref-btn daily ${preference === 'daily' ? 'active' : ''}`}
            onClick={() => setPreference('daily')}
          >
            日常
          </button>
          <button
            className={`pref-btn work ${preference === 'work' ? 'active' : ''}`}
            onClick={() => setPreference('work')}
          >
            职场
          </button>
        </div>
        <div className="chat-input-row">
          <textarea
            className="chat-input"
            placeholder="用英文表达你的意思…"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            className="send-btn"
            disabled={!sentence?.id || sending}
            onClick={handleSend}
          >
            {sending ? '发送中' : '发送'}
          </button>
        </div>
        <div className="chat-clear-row">
          <button
            className="clear-btn"
            disabled={!sentence?.id}
            onClick={() => onClear?.(sentence?.id)}
          >
            清空本句
          </button>
        </div>
      </div>
    </div>
  )
}