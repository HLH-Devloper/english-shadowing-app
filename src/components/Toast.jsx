import React, { useEffect } from 'react'

export default function Toast({ message, type = 'info', duration = 3000, onClose }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => onClose && onClose(), duration)
    return () => clearTimeout(t)
  }, [message, duration, onClose])

  if (!message) return null
  return (
    <div className={`app-toast ${type}`} role="alert" aria-live="polite">
      {message}
    </div>
  )
}