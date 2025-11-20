import React from 'react'
import './overlay.css'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import UploadPage from './components/UploadPage'
import PlayerPage from './components/PlayerPage'
import RegisterPage from './components/RegisterPage'
import PasswordPage from './components/PasswordPage'
import InviteSeedPage from './components/InviteSeedPage'
import RedeemPage from './components/RedeemPage'
import ConversationPage from './components/ConversationPage'
import HistoryPage from './components/HistoryPage'

export default function App() {
  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/player" element={<PlayerPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/password" element={<PasswordPage />} />
          <Route path="/seed" element={<InviteSeedPage />} />
          <Route path="/redeem" element={<RedeemPage />} />
          <Route path="/conversation" element={<ConversationPage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </div>
    </Router>
  )
}


