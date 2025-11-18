import React from 'react'
import './overlay.css'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import UploadPage from './components/UploadPage'
import PlayerPage from './components/PlayerPage'
import RegisterPage from './components/RegisterPage'
import PasswordPage from './components/PasswordPage'
import InviteSeedPage from './components/InviteSeedPage'
import RedeemPage from './components/RedeemPage'
import CaptionsTestPage from './components/CaptionsTestPage'

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
          {/* 仅供预览环境测试字幕抓取，不影响正式站点 */}
          <Route path="/dev/captions-test" element={<CaptionsTestPage />} />
        </Routes>
      </div>
    </Router>
  )
}


