import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

const container = document.getElementById('root')
const root = createRoot(container)
// 在初始化时应用已保存的主题（默认教学主题）
try {
  const saved = localStorage.getItem('app-theme')
  const initial = saved || (document.body.className || 'theme-dark-edu')
  document.body.className = initial
} catch {}
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)


