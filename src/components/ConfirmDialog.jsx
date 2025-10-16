import React from 'react'

export default function ConfirmDialog({
  isOpen,
  title = '提示',
  message = '',
  confirmText = '确定',
  cancelText = '取消',
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null
  return (
    <div className="app-modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="app-modal">
        <div className="app-modal-title">{title}</div>
        <div className="app-modal-message">{message}</div>
        <div className="app-modal-actions">
          <button className="primary-btn" onClick={onConfirm}>{confirmText}</button>
          <button className="secondary-btn" onClick={onCancel}>{cancelText}</button>
        </div>
      </div>
    </div>
  )
}