import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import styled, { keyframes, css, ThemeProvider } from 'styled-components'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import Toast from './Toast'

// --- Themes ---

const techTheme = {
  id: 'tech',
  bg: '#0f172a',
  bgImage: 'radial-gradient(circle at 50% -20%, #3730a3 0%, #1e1b4b 40%, #0f172a 100%)',
  text: '#f8fafc',
  textSecondary: 'rgba(255, 255, 255, 0.5)',
  headerBg: 'rgba(15, 23, 42, 0.7)',
  cardBg: 'rgba(30, 41, 59, 0.7)',
  userBubble: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
  userText: '#ffffff',
  aiBubble: 'rgba(30, 41, 59, 0.7)',
  correctionBg: 'rgba(239, 68, 68, 0.15)',
  correctionBorder: 'rgba(239, 68, 68, 0.3)',
  accent: '#38bdf8',
  micActive: '#ef4444',
  micInactive: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  inputBg: 'rgba(30, 41, 59, 0.6)',
  shadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
  divider: 'rgba(255, 255, 255, 0.1)',
  sidebarBg: 'rgba(15, 23, 42, 0.95)'
}

const auraTheme = {
  id: 'aura',
  bg: '#fdfbfb',
  bgImage: 'radial-gradient(circle at 50% -20%, #f5d0fe 0%, #ffffff 60%, #f8fafc 100%)',
  text: '#1e293b',
  textSecondary: 'rgba(30, 41, 59, 0.5)',
  headerBg: 'rgba(255, 255, 255, 0.7)',
  cardBg: 'rgba(255, 255, 255, 0.8)',
  userBubble: 'linear-gradient(135deg, #c084fc 0%, #a855f7 100%)',
  userText: '#ffffff',
  aiBubble: '#ffffff',
  correctionBg: 'rgba(254, 202, 202, 0.3)',
  correctionBorder: 'rgba(252, 165, 165, 0.5)',
  accent: '#a855f7',
  micActive: '#ec4899',
  micInactive: 'linear-gradient(135deg, #d8b4fe, #f472b6)',
  border: '1px solid rgba(0, 0, 0, 0.05)',
  inputBg: 'rgba(255, 255, 255, 0.9)',
  shadow: '0 10px 30px rgba(168, 85, 247, 0.15)',
  divider: 'rgba(0, 0, 0, 0.05)',
  sidebarBg: 'rgba(255, 255, 255, 0.95)'
}

const popTheme = {
  id: 'pop',
  bg: '#fefce8', // Yellow-50
  bgImage: 'none',
  text: '#000000',
  textSecondary: 'rgba(0, 0, 0, 0.6)',
  headerBg: '#ffffff',
  cardBg: '#ffffff',
  userBubble: '#000000',
  userText: '#facc15', // Yellow-400
  aiBubble: '#ffffff',
  correctionBg: '#fdf2f8', // Pink-50
  correctionBorder: '#f472b6',
  accent: '#ec4899', // Pink-500
  micActive: '#ef4444',
  micInactive: '#000000',
  border: '2px solid #000000',
  inputBg: '#ffffff',
  shadow: '4px 4px 0px #000000',
  divider: '#000000',
  sidebarBg: '#fefce8'
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
  background: ${props => props.theme.bgImage !== 'none' ? props.theme.bgImage : props.theme.bg};
  background-color: ${props => props.theme.bg};
  background-size: cover;
  background-attachment: fixed;
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
  border-bottom: ${props => props.theme.border};
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 10;
  transition: all 0.3s ease;
  box-shadow: ${props => props.theme.id === 'pop' ? props.theme.shadow : 'none'};
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
  border: ${props => props.theme.id === 'pop' ? '2px solid #000' : 'none'};

  &:hover {
    background: ${props => props.theme.id === 'tech' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'};
    transform: scale(1.05);
    box-shadow: ${props => props.theme.id === 'pop' ? '2px 2px 0px #000' : 'none'};
  }
`

const Title = styled.h1`
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  background: ${props => {
    if (props.theme.id === 'tech') return 'linear-gradient(to right, #38bdf8, #818cf8)'
    if (props.theme.id === 'aura') return 'linear-gradient(to right, #a855f7, #ec4899)'
    return 'none'
  }};
  color: ${props => props.theme.id === 'pop' ? '#000' : 'transparent'};
  -webkit-background-clip: ${props => props.theme.id === 'pop' ? 'border-box' : 'text'};
  -webkit-text-fill-color: ${props => props.theme.id === 'pop' ? 'currentColor' : 'transparent'};
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
  border: ${props => props.theme.id === 'pop' ? '2px solid #000' : 'none'};
  background: ${props => props.theme.id === 'pop' ? '#fff' : undefined};
  box-shadow: ${props => props.theme.id === 'pop' ? '2px 2px 0px #000' : 'none'};
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
  box-shadow: ${props => props.theme.id === 'pop' ? '4px 4px 0px #000' : 'none'};
  border: ${props => props.theme.id === 'pop' ? '2px solid #000' : undefined};
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
    color: ${props.theme.userText};
    border-bottom-right-radius: 4px;
    box-shadow: ${props.theme.id === 'pop' ? '4px 4px 0px #000' : (props.theme.id === 'tech' ? '0 8px 20px rgba(59, 130, 246, 0.3)' : '0 8px 20px rgba(168, 85, 247, 0.3)')};
    border: ${props.theme.id === 'pop' ? '2px solid #000' : 'none'};
  ` : css`
    background: ${props.theme.aiBubble};
    border: ${props.theme.border};
    color: ${props.theme.text};
    border-bottom-left-radius: 4px;
    backdrop-filter: blur(10px);
    box-shadow: ${props.theme.id === 'pop' ? '4px 4px 0px #000' : 'none'};
  `}
`

const BlurOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  backdrop-filter: blur(12px);
  background: ${props => props.theme.id === 'tech' ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)'};
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: inherit;
  transition: opacity 0.3s ease;
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

const ReplayBtn = styled.button`
  background: none;
  border: none;
  color: ${props => props.role === 'user' ? 'rgba(255,255,255,0.8)' : props.theme.accent};
  font-size: 1rem;
  cursor: pointer;
  padding: 4px;
  margin-left: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
  transition: all 0.2s;
  
  &:hover { opacity: 1; transform: scale(1.1); }
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
  border-top: ${props => props.theme.border};
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-bottom: max(24px, env(safe-area-inset-bottom));
  transition: all 0.3s ease;
  box-shadow: ${props => props.theme.id === 'pop' ? '0 -4px 0px #000' : 'none'};
`

const InputGroup = styled.div`
  display: flex;
  gap: 12px;
  background: ${props => props.theme.inputBg};
  padding: 6px;
  border-radius: 16px;
  border: ${props => props.theme.border};
  transition: border-color 0.2s;
  box-shadow: ${props => props.theme.id === 'pop' ? '4px 4px 0px #000' : 'none'};

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
  border: ${props => props.theme.id === 'pop' ? '2px solid #000' : 'none'};
  box-shadow: ${props => props.theme.id === 'pop' ? '2px 2px 0px #000' : 'none'};
  
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
  box-shadow: ${props => props.theme.id === 'pop' ? '4px 4px 0px #000' : '0 10px 30px rgba(0,0,0,0.1)'};
  border: ${props => props.theme.border};
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
  border: ${props => props.theme.id === 'pop' ? '1px solid #000' : 'none'};
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
  border: ${props => props.theme.id === 'pop' ? '2px solid #000' : 'none'};
  
  ${props => props.variant === 'cancel' ? css`
    background: rgba(0,0,0,0.05);
    color: ${props.theme.textSecondary};
    &:hover { background: rgba(0,0,0,0.1); }
  ` : css`
    background: #22c55e; /* Green for send */
    color: white;
    box-shadow: ${props.theme.id === 'pop' ? '2px 2px 0px #000' : '0 4px 12px rgba(34, 197, 94, 0.3)'};
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
  box-shadow: ${props => props.theme.shadow};
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: ${props => props.theme.id === 'pop' ? '2px solid #000' : 'none'};
  
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

const StatusText = styled.span`
  font-size: 0.85rem;
  font-weight: 500;
  color: ${props => props.isListening ? props.theme.micActive : props.theme.textSecondary};
  letter-spacing: 0.5px;
  text-transform: uppercase;
`

const SuggestionContainer = styled.div`
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 12px 24px;
  background: ${props => props.theme.headerBg};
  border-top: ${props => props.theme.border};
  white-space: nowrap;
  -webkit-overflow-scrolling: touch;
  
  &::-webkit-scrollbar { display: none; }
`

const SuggestionChip = styled.button`
  background: ${props => props.theme.cardBg};
  border: ${props => props.theme.border};
  color: ${props => props.theme.text};
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: ${props => props.theme.id === 'pop' ? '2px 2px 0px #000' : '0 2px 8px rgba(0,0,0,0.05)'};
  border: ${props => props.theme.id === 'pop' ? '2px solid #000' : props.theme.border};
  flex-shrink: 0;

  &:hover {
    background: ${props => props.theme.accent};
    color: white;
    transform: translateY(-2px);
    box-shadow: ${props => props.theme.id === 'pop' ? '2px 2px 0px #000' : '0 4px 12px rgba(0,0,0,0.1)'};
  }
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
  border-left: ${props => props.theme.border};
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
  justify-content: space-between;
  gap: 10px;
  font-size: 0.85rem;
  transition: all 0.2s;
  border: ${props => props.theme.id === 'pop' ? '2px solid #000' : (props.active ? props.theme.accent : props.theme.border)};
  box-shadow: ${props => props.theme.id === 'pop' && props.active ? '2px 2px 0px #000' : 'none'};

  &:hover {
    background: ${props => props.active ? props.theme.accent : 'rgba(255, 255, 255, 0.1)'};
  }
`

const OptionContent = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`

const Checkmark = styled.span`
  font-size: 1rem;
  font-weight: bold;
`

const Icon = styled.span`
  font-size: 1rem;
`

// --- Member Overlay ---

const MemberOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(20px);
  z-index: 200;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px;
  color: white;
`

const MemberCard = styled.div`
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  padding: 40px;
  border-radius: 24px;
  max-width: 400px;
  width: 100%;
  box-shadow: 0 20px 50px rgba(59, 130, 246, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.2);
`

const MemberTitle = styled.h2`
  font-size: 1.8rem;
  font-weight: 800;
  margin-bottom: 16px;
`

const MemberDesc = styled.p`
  font-size: 1rem;
  line-height: 1.6;
  margin-bottom: 32px;
  opacity: 0.9;
`

const UpgradeButton = styled.button`
  background: white;
  color: #4f46e5;
  border: none;
  padding: 16px 32px;
  border-radius: 12px;
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
  
  &:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(0,0,0,0.2); }
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
  const [suggestions, setSuggestions] = useState([])

  // Speaking State
  const [speakingMsgId, setSpeakingMsgId] = useState(null)

  // Membership State
  const [isMember, setIsMember] = useState(null) // null = loading, false = not member, true = member

  const recognitionRef = useRef(null)
  const synthRef = useRef(window.speechSynthesis)
  const messagesEndRef = useRef(null)
  const timerRef = useRef(null)

  // Media Recorder Refs
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const finalTranscriptRef = useRef('') // Track accumulated final transcript

  const showNotice = (msg, type = 'info') => { setToastMsg(msg); setToastType(type) }
  const dismissNotice = () => setToastMsg('')

  // Check Membership
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const snap = await getDoc(doc(db, 'users', user.uid))
          if (snap.exists()) {
            const data = snap.data()
            // Check if membership is 'member'
            if (data.membership === 'member') {
              setIsMember(true)
            } else {
              setIsMember(false)
            }
          } else {
            setIsMember(false)
          }
        } catch (e) {
          console.error('Error fetching user profile:', e)
          setIsMember(false)
        }
      } else {
        setIsMember(false)
      }
    })
    return () => unsub()
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
    return () => clearTimeout(timeoutId)
  }, [messages, isListening, suggestions])

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onstart = () => {
        setIsListening(true)
        setRecordingTime(0)
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1)
        }, 1000)
      }

      recognition.onend = () => {
        // Handled by manual stop
      }

      recognition.onresult = (event) => {
        let interimTranscript = ''
        let newFinalTranscript = ''

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            newFinalTranscript += event.results[i][0].transcript
          } else {
            interimTranscript += event.results[i][0].transcript
          }
        }

        // Accumulate final transcripts
        if (newFinalTranscript) {
          finalTranscriptRef.current += (finalTranscriptRef.current ? ' ' : '') + newFinalTranscript
        }

        // Display accumulated final + current interim
        const fullText = finalTranscriptRef.current + (interimTranscript ? ' ' + interimTranscript : '')
        if (fullText) {
          setInputText(fullText)
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

  const startRecording = async () => {
    setInputText('')
    finalTranscriptRef.current = '' // Reset accumulated transcript
    audioChunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      recognitionRef.current?.start()
    } catch (err) {
      console.error("Error accessing microphone:", err)
      showNotice("Could not access microphone", "error")
    }
  }

  const stopRecording = () => {
    setIsListening(false)
    recognitionRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      // Stop all tracks to release mic
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
    }
  }

  const cancelRecording = () => {
    stopRecording()
    setInputText('')
    audioChunksRef.current = []
  }

  const sendRecording = () => {
    // We need to wait for the recorder to actually stop and produce the blob
    // Since stopRecording() calls stop(), the 'stop' event on mediaRecorder will fire
    // We can hook into that or just wait a tiny bit. 
    // Better approach: wrap the stop logic in a promise or use the onstop handler.

    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const audioUrl = URL.createObjectURL(audioBlob)
        handleSendMessage(inputText, audioUrl)
      }
    }

    stopRecording()
  }

  const speakText = (text, msgId, audioUrl) => {
    // If there is a recorded audio URL (user's voice), play that
    if (audioUrl) {
      const audio = new Audio(audioUrl)
      audio.play()
      return
    }

    // Otherwise use TTS (AI voice)
    if (synthRef.current.speaking) {
      synthRef.current.cancel()
    }

    const cleanText = text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')

    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.lang = 'en-US'

    utterance.onstart = () => {
      if (msgId) setSpeakingMsgId(msgId)
    }

    utterance.onend = () => {
      if (msgId) setSpeakingMsgId(null)
    }

    utterance.onerror = () => {
      if (msgId) setSpeakingMsgId(null)
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

  const handleSendMessage = async (text, audioUrl = null) => {
    if (!text.trim()) return

    const newMessages = [...messages, {
      id: Date.now().toString(),
      role: 'user',
      text,
      audioUrl // Store the audio URL if present
    }]
    setMessages(newMessages)
    setInputText('')
    setSuggestions([]) // Clear suggestions immediately

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

      // Parse Suggestions
      let conversationContent = fullReply
      const suggestionSplit = fullReply.split('###SUGGESTIONS###')
      if (suggestionSplit.length > 1) {
        conversationContent = suggestionSplit[0].trim()
        try {
          const parsedSuggestions = JSON.parse(suggestionSplit[1])
          if (Array.isArray(parsedSuggestions)) {
            setSuggestions(parsedSuggestions)
          }
        } catch (e) {
          console.error('Failed to parse suggestions:', e)
        }
      }

      const parts = conversationContent.split('|||')
      let correction = null
      let conversation = conversationContent

      if (parts.length > 1) {
        correction = parts[0].trim()
        conversation = parts[1].trim()
      }

      const aiMsgId = Date.now().toString() + '-ai'

      setSpeakingMsgId(aiMsgId)

      setMessages(prev => [...prev, {
        id: aiMsgId,
        role: 'ai',
        text: conversation,
        correction: correction
      }])

      speakText(conversation, aiMsgId)
    } catch (error) {
      console.error('Chat error:', error)

      // --- LEVEL 3: Local Fallback ---
      const localFallbacks = [
        "I see. Could you tell me more about that?",
        "That's interesting! Please go on.",
        "I understand. What else would you like to say?",
        "Could you explain that in a bit more detail?",
        "Great! Let's keep practicing. What's next?"
      ]
      const randomReply = localFallbacks[Math.floor(Math.random() * localFallbacks.length)]

      const aiMsgId = Date.now().toString() + '-ai-fallback'
      setMessages(prev => [...prev, {
        id: aiMsgId,
        role: 'ai',
        text: randomReply
      }])
      speakText(randomReply, aiMsgId)

      showNotice('网络连接不稳定，已切换至离线模式', 'warning')
    }
  }

  const handleScenarioChange = (newScenario) => {
    setScenario(newScenario)
    showNotice(`Scenario changed to: ${newScenario}`, 'success')
  }

  const handleDifficultyChange = (newDifficulty) => {
    setDifficulty(newDifficulty)
    showNotice(`Difficulty set to: ${newDifficulty}`, 'success')
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}: ${secs.toString().padStart(2, '0')}`
  }

  return (
    <ThemeProvider theme={theme}>
      <PageContainer>
        {/* Member Check Overlay */}
        {isMember === false && (
          <MemberOverlay>
            <MemberCard>
              <MemberTitle>💎 会员专属功能</MemberTitle>
              <MemberDesc>
                AI 口语陪练是跟读鸭会员的专属权益。升级会员，即可解锁无限次 AI 对话练习，快速提升口语能力！
              </MemberDesc>
              <UpgradeButton onClick={() => navigate('/')}>返回首页</UpgradeButton>
            </MemberCard>
          </MemberOverlay>
        )}

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
                    <LoadingDots style={{ color: theme.id === 'tech' ? '#fff' : '#000', fontWeight: 'bold' }}>Speaking</LoadingDots>
                  </BlurOverlay>
                )}

                {msg.text}

                {/* Audio Replay Button */}
                <ReplayBtn
                  role={msg.role}
                  onClick={(e) => { e.stopPropagation(); speakText(msg.text, null, msg.audioUrl) }}
                  title="Play Audio"
                >
                  🔊
                </ReplayBtn>

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
          {suggestions.length > 0 && (
            <SuggestionContainer>
              {suggestions.map((sugg, i) => (
                <SuggestionChip key={i} onClick={() => setInputText(sugg)}>
                  {sugg}
                </SuggestionChip>
              ))}
            </SuggestionContainer>
          )}

          {isListening ? (
            <RecordingBar>
              <ActionButton variant="cancel" onClick={cancelRecording}>✕</ActionButton>
              <Waveform>
                {[0, 0.2, 0.4, 0.1, 0.3, 0.5, 0.2].map((d, i) => (
                  <WaveBar key={i} delay={d} />
                ))}
              </Waveform>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (inputText.trim()) {
                      sendRecording()
                    }
                  }
                }}
                placeholder="Listening..."
                rows={1}
                style={{
                  flex: 1,
                  margin: '0 12px',
                  background: 'transparent',
                  border: 'none',
                  color: 'inherit',
                  fontSize: '1rem',
                  outline: 'none',
                  resize: 'none',
                  overflow: 'hidden',
                  minHeight: '24px',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}
                onInput={(e) => {
                  e.target.style.height = 'auto'
                  e.target.style.height = e.target.scrollHeight + 'px'
                  // Auto-scroll to bottom to show latest content
                  e.target.scrollTop = e.target.scrollHeight
                }}
              />
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
                <StatusText isListening={isListening}>Tap to Speak</StatusText>
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
                <OptionContent><Icon>✨</Icon> Tech (Dark)</OptionContent>
                {theme.id === 'tech' && <Checkmark>✓</Checkmark>}
              </OptionButton>
              <OptionButton
                active={theme.id === 'aura'}
                onClick={() => setTheme(auraTheme)}
              >
                <OptionContent><Icon>☁️</Icon> Aura (Light)</OptionContent>
                {theme.id === 'aura' && <Checkmark>✓</Checkmark>}
              </OptionButton>
              <OptionButton
                active={theme.id === 'pop'}
                onClick={() => setTheme(popTheme)}
              >
                <OptionContent><Icon>🍭</Icon> Pop (Dopamine)</OptionContent>
                {theme.id === 'pop' && <Checkmark>✓</Checkmark>}
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
                  onClick={() => handleDifficultyChange(diff.id)}
                >
                  <OptionContent>{diff.label}</OptionContent>
                  {difficulty === diff.id && <Checkmark>✓</Checkmark>}
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
                  <OptionContent><Icon>{scen.icon}</Icon> {scen.label}</OptionContent>
                  {scenario === scen.id && <Checkmark>✓</Checkmark>}
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
