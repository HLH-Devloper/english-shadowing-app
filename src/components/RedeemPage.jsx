import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth, db } from '../firebase'
import { doc, runTransaction, serverTimestamp, getDoc, setDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import Toast from './Toast'
import ConfirmDialog from './ConfirmDialog'

function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function RedeemPage() {
  const [inviteCode, setInviteCode] = useState('')
  const [uid, setUid] = useState(null)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [toastMsg, setToastMsg] = useState('')
  const [toastType, setToastType] = useState('info')
  const showNotice = (msg, type = 'info') => { setToastMsg(msg); setToastType(type) }
  const dismissNotice = () => setToastMsg('')
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', confirmText: '确定', cancelText: '取消', onConfirm: null })
  const closeConfirmDialog = () => setConfirmDialog(p => ({ ...p, isOpen: false }))
  const navigate = useNavigate()

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setUid(user?.uid || null)
      setEmail(user?.email || '')
      if (user) {
        try {
          // 确保用户文档存在（Google 登录首次创建为 free）
          const ref = doc(db, 'users', user.uid)
          const snap = await getDoc(ref)
          if (!snap.exists()) {
            await setDoc(ref, {
              email: user.email || '',
              membership: 'free',
              inviteCodeUsed: '',
              dailyVideoLimit: null,
              videosWatchedToday: 0,
              watchDay: formatDate(new Date()),
              videoMaxDurationSeconds: 1200,
              lastLogin: serverTimestamp()
            }, { merge: true })
          }
        } catch (e) {
          // ignore
        }
      }
    })
    return () => unsub()
  }, [])

  const redeem = async (e) => {
    e?.preventDefault?.()
    setError('')
    if (!uid) {
      showNotice('请先登录后再兑换会员资格', 'warning')
      return
    }
    const code = (inviteCode || '').trim().toUpperCase()
    if (!code) { setError('请输入邀请码'); return }
    setLoading(true)
    showNotice('⏳ 正在验证邀请码...', 'info')
    try {
      await runTransaction(db, async (tx) => {
        const codeRef = doc(db, 'inviteCodes', code)
        const codeSnap = await tx.get(codeRef)
        if (!codeSnap.exists()) throw new Error('邀请码不存在')
        const codeData = codeSnap.data()
        if (codeData.isUsed) throw new Error('邀请码已被使用')
        if (codeData.expiryDate && codeData.expiryDate.toDate && codeData.expiryDate.toDate() < new Date()) {
          throw new Error('邀请码已过期')
        }
        const userRef = doc(db, 'users', uid)
        const todayStr = formatDate(new Date())
        tx.set(userRef, {
          email: email || '',
          membership: 'member',
          inviteCodeUsed: code,
          dailyVideoLimit: null,
          videosWatchedToday: 0,
          watchDay: todayStr,
          videoMaxDurationSeconds: null,
          joinedAt: serverTimestamp()
        }, { merge: true })
        tx.update(codeRef, { isUsed: true, usedBy: uid, usedAt: serverTimestamp() })
      })
      setConfirmDialog({
        isOpen: true,
        title: '🎉 兑换成功！',
        message: '您已升级为会员，点击“确定”返回主页开始学习',
        confirmText: '确定',
        cancelText: '取消',
        onConfirm: () => navigate('/')
      })
      showNotice('⭐ 恭喜！您已获得会员权限', 'success')
    } catch (err) {
      const msg = err?.message || ''
      if (/网络|network/i.test(msg)) {
        showNotice('🌐 网络连接失败，请稍后重试', 'error')
      } else if (/邀请码/.test(msg)) {
        showNotice('❌ 邀请码无效、已被使用或已过期', 'error')
      } else {
        showNotice('⚠️ 操作失败，请稍后重试', 'error')
      }
      setError(msg || '兑换失败')
    } finally {
      setLoading(false)
      setTimeout(() => dismissNotice(), 1200)
    }
  }

  if (!uid) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ maxWidth: 520 }}>
          <div className="auth-header">
            <h1 className="auth-title">兑换会员资格</h1>
            <p className="auth-subtitle">请先登录后再输入邀请码完成兑换</p>
          </div>
          <div className="auth-footer" style={{ display: 'flex' }}>
            <button className="primary-btn" onClick={() => navigate('/register?mode=login')}>去登录</button>
            <button className="secondary-btn" style={{ marginLeft: 'auto' }} onClick={() => navigate('/')}>返回首页</button>
          </div>
          <Toast message={toastMsg} type={toastType} onClose={dismissNotice} />
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 520 }}>
        <div className="auth-header">
          <h1 className="auth-title">输入邀请码升级会员</h1>
          <p className="auth-subtitle">当前账户：{email || '未识别邮箱'}</p>
        </div>
        <form onSubmit={redeem} style={{ display: 'grid', gap: 12 }}>
          <label className="field-label" htmlFor="inviteCode">邀请码</label>
          <input id="inviteCode" className="auth-input" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} />
          {error && <div className="error-text">{error}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" className="primary-btn" disabled={loading}>{loading ? '验证中...' : '立即兑换'}</button>
            <button type="button" className="secondary-btn" onClick={() => navigate('/')}>返回首页</button>
          </div>
        </form>
        <Toast message={toastMsg} type={toastType} onClose={dismissNotice} />
        <ConfirmDialog isOpen={confirmDialog.isOpen} title={confirmDialog.title} message={confirmDialog.message} confirmText={confirmDialog.confirmText} cancelText={confirmDialog.cancelText} onConfirm={() => { closeConfirmDialog(); confirmDialog.onConfirm?.() }} onCancel={closeConfirmDialog} />
      </div>
    </div>
  )
}