import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import BrandDuck from './BrandDuck'
import Toast from './Toast'
import '../mobile.css' // Reuse mobile styles if needed, or create new ones

export default function ConversationPage() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState([
    { role: 'ai', text: "Hello! I'm your AI English tutor. What would you like to talk about today?" }
  ])
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [inputText, setInputText] = useState('')
  const [toastMsg, setToastMsg] = useState('')
  const [toastType, setToastType] = useState('info')

  const recognitionRef = useRef(null)
  const synthRef = useRef(window.speechSynthesis)
  const messagesEndRef = useRef(null)

  const showNotice = (msg, type = 'info') => { setToastMsg(msg); setToastType(type) }
  const dismissNotice = () => setToastMsg('')

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'en-US'

      recognition.onstart = () => setIsListening(true)
      recognition.onend = () => setIsListening(false)

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        setInputText(transcript)
        handleSendMessage(transcript)
      }

      recognition.onerror = (event) => {
        console.error('Speech recognition error', event.error)
        setIsListening(false)
        showNotice('Speech recognition failed. Please try again or type.', 'error')
      }

      recognitionRef.current = recognition
    } else {
      showNotice('Your browser does not support speech recognition.', 'warning')
    }
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop()
    } else {
      recognitionRef.current?.start()
    }
  }

  const speakText = (text) => {
    if (synthRef.current.speaking) {
      synthRef.current.cancel()
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    synthRef.current.speak(utterance)
  }

  const handleSendMessage = async (text) => {
    if (!text.trim()) return

    const newMessages = [...messages, { role: 'user', text }]
    setMessages(newMessages)
    setInputText('')

    try {
      // Call API
    } catch (error) {
      console.error('Chat error:', error)
      showNotice('Failed to get AI response.', 'error')
    }
  }

  return (
    <div className="conversation-page" style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg)',
      color: 'var(--text)'
    }}>
      {/* Header */}
      <header style={{
        padding: '16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>←</button>
          <div className="brand">
            <span className="brand-title">AI Talk</span>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        {messages.map((msg, index) => (
          <div key={index} style={{
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '80%',
            padding: '12px 16px',
            borderRadius: '12px',
            background: msg.role === 'user' ? 'var(--primary)' : 'var(--card)',
            color: msg.role === 'user' ? '#fff' : 'var(--text)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            {msg.text}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Controls */}
      <div style={{
        padding: '20px',
        borderTop: '1px solid var(--border)',
        background: 'var(--card)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {/* Text Input Fallback */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(inputText)}
            placeholder="Type or speak..."
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text)'
            }}
          />
          <button
            onClick={() => handleSendMessage(inputText)}
            style={{
              padding: '0 20px',
              borderRadius: '8px',
              background: 'var(--primary)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer'
            }}
          >Send</button>
        </div>

        {/* Mic Button */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={toggleListening}
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: isListening ? '#ef4444' : 'var(--primary)',
              color: '#fff',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              transition: 'all 0.2s'
            }}
          >
            {isListening ? '⏹' : '🎤'}
          </button>
        </div>
        <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--muted)' }}>
          {isListening ? 'Listening...' : 'Tap to Speak'}
        </div>
      </div>

      <Toast message={toastMsg} type={toastType} onClose={dismissNotice} />
    </div>
  )
}
