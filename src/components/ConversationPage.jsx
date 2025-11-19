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
  correctionBg: 'rgba(239, 68, 68, 0.15)',
  correctionBorder: 'rgba(239, 68, 68, 0.3)',
  accent: '#38bdf8',
  micActive: '#ef4444',
  micInactive: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
  border: 'rgba(255, 255, 255, 0.08)',
  inputBg: 'rgba(30, 41, 59, 0.6)',
  shadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
  divider: 'rgba(255, 255, 255, 0.1)',
  sidebarBg: 'rgba(15, 23, 42, 0.95)'
}

const auraTheme = {
  id: 'aura',
  bg: 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)',
  bgImage: 'radial-gradient(circle at 50% 0%, #e9d5ff 0%, #fdfbfb 60%)',
  text: '#1e293b',
  textSecondary: 'rgba(30, 41, 59, 0.5)',
  headerBg: 'rgba(255, 255, 255, 0.7)',
  cardBg: 'rgba(255, 255, 255, 0.8)',
  userBubble: 'linear-gradient(135deg, #c084fc 0%, #a855f7 100%)',
  aiBubble: '#ffffff',
  correctionBg: 'rgba(254, 202, 202, 0.3)',
  correctionBorder: 'rgba(252, 165, 165, 0.5)',
  accent: '#a855f7',
  micActive: '#ec4899',
  micInactive: 'linear-gradient(135deg, #d8b4fe, #f472b6)',
  border: 'rgba(0, 0, 0, 0.05)',
  inputBg: 'rgba(255, 255, 255, 0.9)',
  shadow: '0 10px 30px rgba(168, 85, 247, 0.15)',
  divider: 'rgba(0, 0, 0, 0.05)',
  sidebarBg: 'rgba(255, 255, 255, 0.95)'
}

// --- Styled Components ---

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`

const wave = keyframes`
  0% { height: 10%; }
  50% { height: 100%; }
  100% { height: 10%; }
`

const dots = keyframes`
  0%, 20% { content: '.'; }
  40% { content: '..'; }
  60%, 100% { content: '...'; }
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
  position: relative;
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

const ModeBadge = styled.div`
  padding: 4px 12px;
  border-radius: 20px;
  background: ${props => props.theme.id === 'tech' ? 'rgba(56, 189, 248, 0.1)' : 'rgba(168, 85, 247, 0.1)'};
  color: ${props => props.theme.accent};
  font-size: 0.75rem;
  font-weight: 600;
  margin-right: 12px;
  letter-spacing: 0.5px;
`

const ChatArea = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  scroll-behavior: smooth;
  
  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { background: ${props => props.theme.textSecondary}; border-radius: 3px; }
`

const BubbleWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: ${props => props.role === 'user' ? 'flex-end' : 'flex-start'};
  animation: ${fadeIn} 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
  max-width: 85%;
`

const CorrectionBubble = styled.div`
  padding: 12px 16px;
  border-radius: 16px;
  font-size: 0.9rem;
  line-height: 1.5;
  background: ${props => props.theme.correctionBg};
  border: 1px solid ${props => props.theme.correctionBorder};
  color: ${props => props.theme.text};
  margin-bottom: 8px;
  border-bottom-left-radius: 4px;
  backdrop-filter: blur(10px);
`

const Bubble = styled.div`
  padding: 16px 20px;
  border-radius: 20px;
  font-size: 1rem;
  line-height: 1.6;
  position: relative;
  box-shadow: ${props => props.theme.id === 'aura' && props.role === 'ai' ? '0 4px 15px rgba(0,0,0,0.05)' : 'none'};
  overflow: hidden; /* For blur effect */
  
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

const BlurOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  backdrop-filter: blur(8px);
  background: rgba(255, 255, 255, 0.1);
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: inherit;
`

const RoleLabel = styled.span`
  font-size: 0.75rem;
  color: ${props => props.theme.textSecondary};
  margin-bottom: 6px;
  margin-left: ${props => props.role === 'user' ? '0' : '12px'};
  margin-right: ${props => props.role === 'user' ? '12px' : '0'};
`

const TranslationDivider = styled.div`
  height: 1px;
  background: ${props => props.theme.divider};
  margin: 12px 0;
`

const TranslationText = styled.div`
  font-size: 0.95rem;
  color: ${props => props.theme.textSecondary};
  font-style: italic;
`

const TranslateBtn = styled.button`
  background: none;
  border: none;
  color: ${props => props.theme.accent};
  font-size: 0.8rem;
  cursor: pointer;
  margin-top: 8px;
  padding: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0.8;
  
  &:hover { opacity: 1; text-decoration: underline; }
`

const LoadingDots = styled.span`
  &::after {
    content: '.';
    animation: ${dots} 1.5s steps(5, end) infinite;
  }
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

  &:focus-within { border-color: ${props => props.theme.accent}; }
`

const Input = styled.input`
  flex: 1;
  background: transparent;
  border: none;
  color: ${props => props.theme.text};
  padding: 10px 16px;
  font-size: 1rem;
  outline: none;
  &::placeholder { color: ${props => props.theme.textSecondary}; }
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
  
  &:hover { filter: brightness(1.1); transform: scale(1.02); }
  &:active { transform: scale(0.98); }
`

// --- Recording Bar Components ---

const RecordingBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: ${props => props.theme.id === 'tech' ? '#1e293b' : '#ffffff'};
  padding: 16px 24px;
  border-radius: 24px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
  border: 1px solid ${props => props.theme.border};
  animation: ${fadeIn} 0.3s ease;
`

const Waveform = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  height: 30px;
  flex: 1;
  justify-content: center;
  margin: 0 20px;
`

const WaveBar = styled.div`
  width: 4px;
  background: ${props => props.theme.accent};
  border-radius: 2px;
  animation: ${wave} 1s ease-in-out infinite;
  animation-delay: ${props => props.delay}s;
`

const Timer = styled.span`
  font-family: monospace;
  font-size: 1rem;
  color: ${props => props.theme.text};
  margin-right: 16px;
`

const ActionButton = styled.button`
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 1.2rem;
  
  ${props => props.variant === 'cancel' ? css`
    background: rgba(0,0,0,0.05);
    color: ${props.theme.textSecondary};
    &:hover { background: rgba(0,0,0,0.1); }
  ` : css`
    background: #22c55e; /* Green for send */
    color: white;
    box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
    &:hover { transform: scale(1.05); }
  `}
`

const MicButton = styled.button`
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: none;
  background: ${props => props.theme.micInactive};
  color: white;
  font-size: 28px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: ${props.theme.shadow};
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  &:hover {
    transform: translateY(-2px) scale(1.05);
  }
  &:active {
    transform: translateY(0) scale(0.95);
  }
`

const MicContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
`

// --- Settings Sidebar ---

const SidebarOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 99;
  opacity: ${props => props.isOpen ? 1 : 0};
  pointer-events: ${props => props.isOpen ? 'auto' : 'none'};
  transition: opacity 0.3s ease;
`

const Sidebar = styled.div`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 280px;
  background: ${props => props.theme.sidebarBg};
  backdrop-filter: blur(20px);
  z-index: 100;
  transform: translateX(${props => props.isOpen ? '0' : '100%'});
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: -10px 0 30px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  padding: 20px;
  border-left: 1px solid ${props => props.theme.border};
`

const SidebarHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
`

const SidebarTitle = styled.h2`
  font-size: 1rem;
  font-weight: 700;
  margin: 0;
  color: ${props => props.theme.text};
`

const SectionTitle = styled.h3`
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  color: ${props => props.theme.textSecondary};
  margin: 0 0 10px 0;
  letter-spacing: 1px;
`

const Section = styled.div`
  margin-bottom: 24px;
`

const OptionGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
`

const OptionButton = styled.button`
  background: ${props => props.active ? props.theme.accent : 'rgba(255, 255, 255, 0.05)'};
  color: ${props => props.active ? '#fff' : props.theme.text};
  border: 1px solid ${props => props.active ? props.theme.accent : props.theme.border};
  padding: 10px 14px;
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.85rem;
  transition: all 0.2s;

  &:hover {
    background: ${props => props.active ? props.theme.accent : 'rgba(255, 255, 255, 0.1)'};
  }
`

const Icon = styled.span`
  font-size: 1rem;
`

// --- Constants ---

const SCENARIOS = [
  { id: 'Just Vibe', icon: '☕', label: 'Just Vibe (Free Talk)' },
  { id: 'Coffee Run', icon: '🥤', label: 'Coffee Run' },
  { id: 'Hustle', icon: '💼', label: 'Hustle (Work)' },
  { id: 'Wanderlust', icon: '✈️', label: 'Wanderlust (Travel)' },
  { id: 'Retail Therapy', icon: '🛍️', label: 'Retail Therapy' },
  { id: 'Foodie', icon: '🍽️', label: 'Foodie (Dining)' },
  { id: 'Gym Rat', icon: '🏋️', label: 'Gym Rat (Fitness)' },
  { id: 'Tech Support', icon: '💻', label: 'Tech Support' },
  { id: 'Movie Buff', icon: '🎬', label: 'Movie Buff' },
  { id: 'Doctors Visit', icon: '🏥', label: 'Doctor\'s Visit' },
]

const DIFFICULTIES = [
  { id: 'Beginner', label: 'Beginner (A1-A2)' },
  { id: 'Intermediate', label: 'Intermediate (B1-B2)' },
  { id: 'Advanced', label: 'Advanced (C1-C2)' },
]

// --- Main Component ---

export default function ConversationPage() {
  const navigate = useNavigate()
  const [theme, setTheme] = useState(techTheme)
  const [messages, setMessages] = useState([
    { id: 'init', role: 'ai', text: "Hello! I'm your AI English tutor. What would you like to talk about today?" }
  ])
  const [isListening, setIsListening] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [inputText, setInputText] = useState('')
  const [toastMsg, setToastMsg] = useState('')
  const [toastType, setToastType] = useState('info')

  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [scenario, setScenario] = useState('Just Vibe')
  const [difficulty, setDifficulty] = useState('Intermediate')
  const [translatingIndices, setTranslatingIndices] = useState(new Set())

  // Speaking State
  const [speakingMsgId, setSpeakingMsgId] = useState(null)

  const recognitionRef = useRef(null)
  const synthRef = useRef(window.speechSynthesis)
  const messagesEndRef = useRef(null)
  const timerRef = useRef(null)

  const showNotice = (msg, type = 'info') => { setToastMsg(msg); setToastType(type) }
  const dismissNotice = () => setToastMsg('')

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      recognition.continuous = true // Keep listening until stopped
      recognition.interimResults = true // Show results as you speak
      recognition.lang = 'en-US'

      recognition.onstart = () => {
        setIsListening(true)
        setRecordingTime(0)
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1)
        }, 1000)
      }

      recognition.onend = () => {
        // Only stop if explicitly requested or error, otherwise restart if continuous failed
        // But here we manage state manually
      }

      recognition.onresult = (event) => {
        let interimTranscript = ''
        let finalTranscript = ''

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript
          } else {
            interimTranscript += event.results[i][0].transcript
          }
        }

        // Update input text with what we have so far
        // Note: This simple logic appends. For a proper input box sync, we might need more complex logic
        // But for now, replacing input text with the latest transcript chunk is standard for this UI
        if (finalTranscript || interimTranscript) {
          setInputText(prev => {
            // If we want to append, we need to be careful not to duplicate
            // For simplicity in this UI, we'll just show the current session's transcript
            // A better way is to just setInputText(finalTranscript + interimTranscript) 
            // but that requires clearing it on start.
            return finalTranscript + interimTranscript
          })
        }
      }

      recognition.onerror = (event) => {
        console.error('Speech recognition error', event.error)
        stopRecording()
        showNotice('Speech recognition failed. Please try again.', 'error')
      }

      recognitionRef.current = recognition
    } else {
      showNotice('Your browser does not support speech recognition.', 'warning')
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const startRecording = () => {
    setInputText('') // Clear input for new speech
    recognitionRef.current?.start()
  }

  const stopRecording = () => {
    setIsListening(false)
    recognitionRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const cancelRecording = () => {
    stopRecording()
    setInputText('')
  }

  const sendRecording = () => {
    stopRecording()
    handleSendMessage(inputText)
  }

  const speakText = (text, msgId) => {
    if (synthRef.current.speaking) {
      synthRef.current.cancel()
    }

    // Remove emojis for speech
    const cleanText = text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')

    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.lang = 'en-US'

    utterance.onstart = () => {
      setSpeakingMsgId(msgId)
    }

    utterance.onend = () => {
      setSpeakingMsgId(null)
    }

    utterance.onerror = () => {
      setSpeakingMsgId(null)
    }

    synthRef.current.speak(utterance)
  }

  const handleTranslate = async (index, text) => {
    if (messages[index].translation || translatingIndices.has(index)) return

    setTranslatingIndices(prev => new Set(prev).add(index))

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'user', text: `Translate this English text to Chinese (Simplified). Output ONLY the translation. Text: "${text}"` }
          ]
        })
      })

      const responseText = await response.text()

      if (!response.ok) {
        throw new Error(`Server Error (${response.status}): ${responseText.slice(0, 100)}`)
      }

      let data
      try {
        data = JSON.parse(responseText)
      } catch (e) {
        throw new Error(`Invalid JSON response: ${responseText.slice(0, 100)}`)
      }

      if (data.error) {
        throw new Error(data.message || data.error)
      }

      if (data.reply) {
        setMessages(prev => {
          const newMsgs = [...prev]
          newMsgs[index] = { ...newMsgs[index], translation: data.reply }
          return newMsgs
        })
      }
    } catch (error) {
      console.error('Translation error:', error)
      showNotice(`Translation failed: ${error.message}`, 'error')
    } finally {
      setTranslatingIndices(prev => {
        const next = new Set(prev)
        next.delete(index)
        return next
      })
    }
  }

  const handleSendMessage = async (text) => {
    if (!text.trim()) return

    const newMessages = [...messages, { id: Date.now().toString(), role: 'user', text }]
    setMessages(newMessages)
    setInputText('')

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          scenario: scenario,
          difficulty: difficulty
        })
      })

      const responseText = await response.text()

      if (!response.ok) {
        throw new Error(`Server Error (${response.status}): ${responseText.slice(0, 100)}`)
      }

      let data
      try {
        data = JSON.parse(responseText)
      } catch (e) {
        throw new Error(`Invalid JSON response: ${responseText.slice(0, 100)}`)
      }

      if (data.error) {
        console.error('API Soft Error:', data)
        throw new Error(data.message || data.error)
      }

      const fullReply = data.reply || "Sorry, I couldn't understand that."

      const parts = fullReply.split('|||')
      let correction = null
      let conversation = fullReply

      if (parts.length > 1) {
        correction = parts[0].trim()
        conversation = parts[1].trim()
      }

      const aiMsgId = Date.now().toString() + '-ai'

      setMessages(prev => [...prev, {
        id: aiMsgId,
        role: 'ai',
        text: conversation,
        correction: correction
      }])

      speakText(conversation, aiMsgId)
    } catch (error) {
      console.error('Chat error:', error)
      showNotice(`AI Error: ${error.message}`, 'error')
    }
  }

  const handleScenarioChange = (newScenario) => {
    setScenario(newScenario)
    showNotice(`Scenario changed to: ${newScenario}`, 'success')
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <ThemeProvider theme={theme}>
      <PageContainer>
        <Header>
          <IconButton onClick={() => navigate('/')}>←</IconButton>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Title>AI Talk</Title>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <ModeBadge>MODE: {scenario.toUpperCase()}</ModeBadge>
            <IconButton onClick={() => setIsSettingsOpen(true)} title="Settings">
              ⚙️
            </IconButton>
          </div>
        </Header>

        <ChatArea>
          {messages.map((msg, index) => (
            <BubbleWrapper key={index} role={msg.role}>
              <RoleLabel role={msg.role}>{msg.role === 'ai' ? 'AI Tutor' : 'You'}</RoleLabel>

              {msg.correction && (
                <CorrectionBubble>
                  <strong>💡 Correction:</strong><br />
                  {msg.correction}
                </CorrectionBubble>
              )}

              <Bubble role={msg.role}>
                {/* Blur Overlay for AI messages being spoken */}
                {msg.role === 'ai' && speakingMsgId === msg.id && (
                  <BlurOverlay>
                    <LoadingDots style={{ color: '#fff', fontWeight: 'bold' }}>Speaking</LoadingDots>
                  </BlurOverlay>
                )}

                {msg.text}
                {msg.role === 'ai' && (
                  <>
                    {msg.translation && (
                      <>
                        <TranslationDivider />
                        <TranslationText>{msg.translation}</TranslationText>
                      </>
                    )}
                    {!msg.translation && (
                      <TranslateBtn onClick={() => handleTranslate(index, msg.text)}>
                        {translatingIndices.has(index) ? (
                          <span>Translating<LoadingDots /></span>
                        ) : (
                          '文/A Translate'
                        )}
                      </TranslateBtn>
                    )}
                  </>
                )}
              </Bubble>
            </BubbleWrapper>
          ))}
          <div ref={messagesEndRef} />
        </ChatArea>

        <Controls>
          {isListening ? (
            <RecordingBar>
              <ActionButton variant="cancel" onClick={cancelRecording}>✕</ActionButton>
              <Waveform>
                {[0, 0.2, 0.4, 0.1, 0.3, 0.5, 0.2].map((d, i) => (
                  <WaveBar key={i} delay={d} />
                ))}
              </Waveform>
              <Timer>{formatTime(recordingTime)}</Timer>
              <ActionButton onClick={sendRecording}>➜</ActionButton>
            </RecordingBar>
          ) : (
            <>
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
                  onClick={startRecording}
                  aria-label="Start listening"
                >
                  🎤
                </MicButton>
                <StatusText>Tap to Speak</StatusText>
              </MicContainer>
            </>
          )}
        </Controls>

        {/* Settings Sidebar */}
        <SidebarOverlay isOpen={isSettingsOpen} onClick={() => setIsSettingsOpen(false)} />
        <Sidebar isOpen={isSettingsOpen}>
          <SidebarHeader>
            <SidebarTitle>Settings</SidebarTitle>
            <IconButton onClick={() => setIsSettingsOpen(false)}>✕</IconButton>
          </SidebarHeader>

          <Section>
            <SectionTitle>VIBE CHECK (THEME)</SectionTitle>
            <OptionGrid>
              <OptionButton
                active={theme.id === 'tech'}
                onClick={() => setTheme(techTheme)}
              >
                <Icon>✨</Icon> Tech (Dark)
              </OptionButton>
              <OptionButton
                active={theme.id === 'aura'}
                onClick={() => setTheme(auraTheme)}
              >
                <Icon>☁️</Icon> Aura (Light)
              </OptionButton>
            </OptionGrid>
          </Section>

          <Section>
            <SectionTitle>DIFFICULTY</SectionTitle>
            <OptionGrid>
              {DIFFICULTIES.map(diff => (
                <OptionButton
                  key={diff.id}
                  active={difficulty === diff.id}
                  onClick={() => setDifficulty(diff.id)}
                >
                  {diff.label}
                </OptionButton>
              ))}
            </OptionGrid>
          </Section>

          <Section>
            <SectionTitle>SCENARIO</SectionTitle>
            <OptionGrid style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {SCENARIOS.map(scen => (
                <OptionButton
                  key={scen.id}
                  active={scenario === scen.id}
                  onClick={() => handleScenarioChange(scen.id)}
                >
                  <Icon>{scen.icon}</Icon> {scen.label}
                </OptionButton>
              ))}
            </OptionGrid>
          </Section>
        </Sidebar>

        <Toast message={toastMsg} type={toastType} onClose={dismissNotice} />
      </PageContainer>
    </ThemeProvider>
  )
}
