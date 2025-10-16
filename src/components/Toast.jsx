import React, { useEffect, useRef } from 'react'

export default function Toast({ message, type = 'info', duration = 3000, onClose }) {
  const timerRef = useRef(null)

  useEffect(() => {
    // 仅在 message 或 duration 变化时重启计时器，避免因父组件函数引用变化导致一直不触发
    if (!message) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => { try { onClose && onClose() } catch {} }, duration)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [message, duration])

  if (!message) return null
  return (
    <div className={`app-toast ${type}`} role="alert" aria-live="polite">
      {message}
    </div>
  )
}