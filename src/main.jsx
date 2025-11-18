import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './overlay.css'
import './mobile.css' // 移动端专用样式

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

// 注册 Service Worker（PWA 支持）
// 仅在生产环境注册 Service Worker，避免开发环境拦截热更新与路由，导致页面无法显示
if (import.meta && import.meta.env && import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}


