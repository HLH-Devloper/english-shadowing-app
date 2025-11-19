import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import styled, { keyframes, css, ThemeProvider } from 'styled-components'
import Toast from './Toast'

// --- Themes ---

const techTheme = {
  id: 'tech',
  bg: '#0f172a',
  text: '#f8fafc',
  textSecondary: 'rgba(255, 255, 255, 0.5)',
  headerBg: 'rgba(15, 23, 42, 0.85)',
  cardBg: 'rgba(30, 41, 59, 0.7)',
  userBubble: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
  aiBubble: 'rgba(30, 41, 59, 0.7)',
  accent: '#38bdf8',
  micActive: '#ef4444',
  micInactive: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
  border: 'rgba(255, 255, 255, 0.08)',
  inputBg: 'rgba(30, 41, 59, 0.6)',
  shadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
}

const auraTheme = {
  id: 'aura',
  bg: 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)', // Soft white/grey
  bgImage: 'radial-gradient(circle at 50% 0%, #e9d5ff 0%, #fdfbfb 60%)', // Purple glow top
  text: '#1e293b',
  textSecondary: 'rgba(30, 41, 59, 0.5)',
  headerBg: 'rgba(255, 255, 255, 0.7)',
  cardBg: 'rgba(255, 255, 255, 0.8)',
  userBubble: 'linear-gradient(135deg, #c084fc 0%, #a855f7 100%)', // Purple gradient
  aiBubble: '#ffffff',
  accent: '#a855f7',
  micActive: '#ec4899', // Pink
  micInactive: 'linear-gradient(135deg, #d8b4fe, #f472b6)', // Pastel purple/pink
  border: 'rgba(0, 0, 0, 0.05)',
  inputBg: 'rgba(255, 255, 255, 0.9)',
  shadow: '0 10px 30px rgba(168, 85, 247, 0.15)'
}

// --- Styled Components & Animations ---

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(236, 72, 153, 0.4); }
  70% { box-shadow: 0 0 0 20px rgba(236, 72, 153, 0); }
  100% { box-shadow: 0 0 0 0 rgba(236, 72, 153, 0); }
`

const PageContainer = styled.div`
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: ${props => props.theme.bgImage || props.theme.bg};
  color: ${props => props.theme.text};
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  overflow: hidden;
  transition: background 0.5s ease;
`

const Header = styled.header`
  padding: 16px 24px;
  background: ${props => props.theme.headerBg};
  backdrop-filter: blur(12px);
  border-bottom: 1px solid ${props => props.theme.border};
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 10;
  transition: all 0.3s ease;
`

const IconButton = styled.button`
  background: ${props => props.theme.id === 'tech' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'};
  border: none;
  color: ${props => props.theme.text};
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 1.2rem;

  &:hover {
    background: ${props => props.theme.id === 'tech' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'};
    transform: scale(1.05);
  }
`

const Title = styled.h1`
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  background: ${props => props.theme.id === 'tech'
    ? 'linear-gradient(to right, #38bdf8, #818cf8)'
    : 'linear-gradient(to right, #a855f7, #ec4899)'};
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0;
  text-transform: uppercase;
`

const ChatArea = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  scroll-behavior: smooth;
  
  /* Custom Scrollbar */
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: ${props => props.theme.textSecondary};
    border-radius: 3px;
  }
`

const BubbleWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: ${props => props.role === 'user' ? 'flex-end' : 'flex-start'};
  animation: ${fadeIn} 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
  max-width: 85%;
`

const Bubble = styled.div`
  padding: 16px 20px;
  border-radius: 20px;
  font-size: 1rem;
  line-height: 1.6;
  position: relative;
  box-shadow: ${props => props.theme.id === 'aura' && props.role === 'ai' ? '0 4px 15px rgba(0,0,0,0.05)' : 'none'};
  
  ${props => props.role === 'user' ? css`
    background: ${props.theme.userBubble};
    color: white;
    border-bottom-right-radius: 4px;
    box-shadow: 0 8px 20px ${props.theme.id === 'tech' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(168, 85, 247, 0.3)'};
  ` : css`
    background: ${props.theme.aiBubble};
    border: 1px solid ${props.theme.border};
    color: ${props.theme.text};
    border-bottom-left-radius: 4px;
    backdrop-filter: blur(10px);
  `}
`

const RoleLabel = styled.span`
  font-size: 0.75rem;
  color: ${props => props.theme.textSecondary};
  margin-bottom: 6px;
  margin-left: ${props => props.role === 'user' ? '0' : '12px'};
  margin-right: ${props => props.role === 'user' ? '12px' : '0'};
`

const Controls = styled.div`
  padding: 24px;
  background: ${props => props.theme.headerBg};
  backdrop-filter: blur(20px);
  border-top: 1px solid ${props => props.theme.border};
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-bottom: max(24px, env(safe-area-inset-bottom));
  transition: all 0.3s ease;
`

const InputGroup = styled.div`
  display: flex;
  gap: 12px;
  background: ${props => props.theme.inputBg};
  padding: 6px;
  border-radius: 16px;
  border: 1px solid ${props => props.theme.border};
  transition: border-color 0.2s;

  &:focus-within {
    border-color: ${props => props.theme.accent};
  }
`

const Input = styled.input`
  flex: 1;
  background: transparent;
  border: none;
  color: ${props => props.theme.text};
  padding: 10px 16px;
  font-size: 1rem;
  outline: none;
  
  &::placeholder {
    color: ${props => props.theme.textSecondary};
  }
`

const SendButton = styled.button`
  background: ${props => props.theme.accent};
  color: white;
  border: none;
  border-radius: 12px;
  padding: 0 24px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    filter: brightness(1.1);
    transform: scale(1.02);
  }
  &:active {
    transform: scale(0.98);
  }
`

const MicContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
`

const MicButton = styled.button`
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: none;
  background: ${props => props.isListening ? props.theme.micActive : props.theme.micInactive};
  color: white;
  font-size: 28px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: ${props => props.isListening
    ? `0 0 0 4px ${props.theme.micActive}40`
    : props.theme.shadow};
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  ${props => props.isListening && css`
    animation: ${pulse} 1.5s infinite;
  `}
  
  &:hover {
    transform: translateY(-2px) scale(1.05);
  }
  &:active {
    transform: translateY(0) scale(0.95);
  }
`

const StatusText = styled.span`
  font-size: 0.85rem;
  font-weight: 500;
  color: ${props => props.isListening ? props.theme.micActive : props.theme.textSecondary};
  letter-spacing: 0.5px;
  text-transform: uppercase;
`

// --- Main Component ---

export default function ConversationPage() {
  const navigate = useNavigate()
  const [theme, setTheme] = useState(techTheme)
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

  const toggleTheme = () => {
    setTheme(prev => prev.id === 'tech' ? auraTheme : techTheme)
  }

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
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('API Error Details:', errorData)
        throw new Error(errorData.details || errorData.error || 'API request failed')
      }

      const data = await response.json()

      // Check for soft error (200 OK but contains error info)
      if (data.error) {
        console.error('API Soft Error:', data)
        throw new Error(data.message || data.error)
      }

      const aiText = data.reply || "Sorry, I couldn't understand that."

      setMessages(prev => [...prev, { role: 'ai', text: aiText }])
      speakText(aiText)
    } catch (error) {
      console.error('Chat error:', error)
      showNotice(`AI Error: ${error.message}`, 'error')
    }
  }

  return (
    <ThemeProvider theme={theme}>
      <PageContainer>
        <Header>
          <IconButton onClick={() => navigate('/')}>
            ←
          </IconButton>
          <Title>AI Talk</Title>
          <IconButton onClick={toggleTheme} title="Switch Theme">
            {theme.id === 'tech' ? '✨' : '🌙'}
          </IconButton>
        </Header>

        <ChatArea>
          {messages.map((msg, index) => (
            <BubbleWrapper key={index} role={msg.role}>
              <RoleLabel role={msg.role}>{msg.role === 'ai' ? 'AI Tutor' : 'You'}</RoleLabel>
              <Bubble role={msg.role}>
                {msg.text}
              </Bubble>
            </BubbleWrapper>
          ))}
          <div ref={messagesEndRef} />
        </ChatArea>

        <Controls>
          <InputGroup>
            <Input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(inputText)}
              placeholder="Type a message..."
            />
            <SendButton onClick={() => handleSendMessage(inputText)}>
              Send
            </SendButton>
          </InputGroup>

          <MicContainer>
            <MicButton
              isListening={isListening}
              onClick={toggleListening}
              aria-label={isListening ? "Stop listening" : "Start listening"}
            >
              {isListening ? '⏹' : '🎤'}
            </MicButton>
            <StatusText isListening={isListening}>
              {isListening ? 'Listening...' : 'Tap to Speak'}
            </StatusText>
          </MicContainer>
        </Controls>

        <Toast message={toastMsg} type={toastType} onClose={dismissNotice} />
      </PageContainer>
    </ThemeProvider>
  )
}
