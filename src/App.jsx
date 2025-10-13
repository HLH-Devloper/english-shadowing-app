import React from 'react'
import './overlay.css'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import UploadPage from './components/UploadPage'
import PlayerPage from './components/PlayerPage'
import RegisterPage from './components/RegisterPage'

export default function App() {
  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/player" element={<PlayerPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Routes>
      </div>
    </Router>
  )
}


