import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { auth, db } from '../firebase'
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, fetchSignInMethodsForEmail, deleteUser, signOut } from 'firebase/auth'
import { doc, setDoc, runTransaction, serverTimestamp, getDoc } from 'firebase/firestore'
import Toast from './Toast'
import ConfirmDialog from './ConfirmDialog'

function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function RegisterPage() {
  const [mode, setMode] = useState('register') // register | login
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [toastMsg, setToastMsg] = useState('')
  const [toastType, setToastType] = useState('info')
  // 登录页外部密码帮助，将导航至独立页面
  const showNotice = (msg, type = 'info') => { setToastMsg(msg); setToastType(type) }
  const dismissNotice = () => setToastMsg('')
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', confirmText: '确定', cancelText: '取消', onConfirm: null })
  const closeConfirmDialog = () => setConfirmDialog(p => ({ ...p, isOpen: false }))
  const navigate = useNavigate()
  const location = useLocation()

  // 如果从首页“登录”入口跳转，默认进入登录模式
  useEffect(() => {
    const initMode = location.state?.mode || (new URLSearchParams(location.search).get('mode')) || null
    if (initMode === 'login') setMode('login')
  }, [location])

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    showNotice('⏳ 加载中...', 'info')
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password)
        setConfirmDialog({
          isOpen: true,
          title: '👋 欢迎回来！',
          message: '登录成功，点击“确定”后将返回主页继续学习',
          confirmText: '确定',
          cancelText: '取消',
          onConfirm: () => navigate('/')
        })
        return
      }
      const cred = await createUserWithEmailAndPassword(auth, email, password)

      try {
        const uid = cred.user.uid
        const todayStr = formatDate(new Date())

        if (inviteCode) {
          await runTransaction(db, async (tx) => {
            const codeRef = doc(db, 'inviteCodes', inviteCode)
            const codeSnap = await tx.get(codeRef)
            if (!codeSnap.exists()) throw new Error('邀请码不存在')
            const codeData = codeSnap.data()
            if (codeData.isUsed) throw new Error('邀请码已被使用')
            if (codeData.expiryDate && codeData.expiryDate.toDate && codeData.expiryDate.toDate() < new Date()) {
              throw new Error('邀请码已过期')
            }
            const userRef = doc(db, 'users', uid)
            tx.set(userRef, {
              email,
              membership: 'member',
              inviteCodeUsed: inviteCode,
              dailyVideoLimit: null,
              videosWatchedToday: 0,
              watchDay: todayStr,
              videoMaxDurationSeconds: null,
              joinedAt: serverTimestamp()
            }, { merge: true })
            tx.update(codeRef, { isUsed: true, usedBy: uid, usedAt: serverTimestamp() })
          })
        } else {
          await setDoc(doc(db, 'users', uid), {
            email,
            membership: 'free',
            inviteCodeUsed: '',
            dailyVideoLimit: 2,
            videosWatchedToday: 0,
            watchDay: todayStr,
            videoMaxDurationSeconds: 1200,
            lastLogin: serverTimestamp()
          }, { merge: true })
        }
      } catch (firestoreError) {
        try {
          await deleteUser(cred.user)
        } catch {
          try { await signOut(auth) } catch {}
        }
        throw firestoreError
      }
      // 成功注册提示
      setConfirmDialog({
        isOpen: true,
        title: '🎉 注册成功！',
        message: '欢迎加入跟读鸭～\n接下来建议：1）上传本地视频练习；2）或返回首页了解功能。\n点击“确定”后返回主页。',
        confirmText: '确定',
        cancelText: '取消',
        onConfirm: () => navigate('/')
      })
      if (inviteCode) {
        showNotice('⭐ 恭喜！您已获得终身会员权限', 'success')
      }
    } catch (err) {
      const code = err?.code || ''
      const msg = err?.message || ''
      if (mode === 'login') {
        // 友好提示：Google 登录用户未设置密码的情况
        if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
          try {
            const methods = await fetchSignInMethodsForEmail(auth, (email || '').trim())
            const hasPassword = methods.includes('password')
            const hasGoogle = methods.includes('google.com')
            if (hasGoogle && !hasPassword) {
              const friendly = '该邮箱目前仅绑定了 Google 登录，尚未设置登录密码。\n请点击下方“使用 Google 继续”登录后，进入“账户安全”页面的“设置登录密码”模块，为你的账户设置一个邮箱密码。'
              setError(friendly)
              showNotice('⚠️ 尚未设置邮箱密码，请先通过 Google 登录并前往“账户安全”设置密码', 'warning')
            } else {
              const friendly = code === 'auth/wrong-password' ? '密码错误，请重试或使用“忘记密码”找回' : '登录失败，请确认邮箱与密码是否正确'
              setError(friendly)
              showNotice('⚠️ ' + friendly, 'error')
            }
          } catch (e) {
            setError('登录失败，请稍后重试')
            showNotice('⚠️ 操作失败，请稍后重试', 'error')
          }
        } else if (code === 'auth/too-many-requests') {
          setError('尝试过于频繁，请稍后再试或使用 Google 登录')
          showNotice('⏳ 稍后再试', 'warning')
        } else if (/网络|network/i.test(msg) || code === 'auth/network-request-failed') {
          setError('网络连接失败，请检查后重试')
          showNotice('🌐 网络连接失败，请检查后重试', 'error')
        } else {
          setError('登录失败，请稍后重试')
          showNotice('⚠️ 操作失败，请稍后重试', 'error')
        }
      } else {
        if (/网络|network/i.test(msg) || code === 'auth/network-request-failed') {
          showNotice('🌐 网络连接失败，请检查后重试', 'error')
        } else if (/邀请码/.test(msg)) {
          showNotice('❌ 邀请码无效或已被使用\n请检查后重试', 'error')
        } else {
          showNotice('⚠️ 操作失败，请稍后重试', 'error')
        }
        setError(msg || '注册失败')
      }
    } finally {
      setLoading(false)
      dismissNotice()
    }
  }

  // 引导到独立密码页面的导航

  // 使用 Google 登录（Gmail）
  const onGoogleSignIn = async () => {
    setError('')
    setLoading(true)
    showNotice('⏳ 加载中...', 'info')
    try {
      const provider = new GoogleAuthProvider()
      const cred = await signInWithPopup(auth, provider)
      const uid = cred.user.uid
      const todayStr = formatDate(new Date())

      // 检查是否已有用户文档
      const userRef = doc(db, 'users', uid)
      const existing = await getDoc(userRef)

      if (inviteCode) {
        // 带邀请码：事务性升级为 member
        await runTransaction(db, async (tx) => {
          const codeRef = doc(db, 'inviteCodes', inviteCode)
          const codeSnap = await tx.get(codeRef)
          if (!codeSnap.exists()) throw new Error('邀请码不存在')
          const codeData = codeSnap.data()
          if (codeData.isUsed) throw new Error('邀请码已被使用')
          if (codeData.expiryDate && codeData.expiryDate.toDate && codeData.expiryDate.toDate() < new Date()) {
            throw new Error('邀请码已过期')
          }
          tx.set(userRef, {
            email: cred.user.email || email,
            membership: 'member',
            inviteCodeUsed: inviteCode,
            dailyVideoLimit: null,
            videosWatchedToday: 0,
            watchDay: todayStr,
            videoMaxDurationSeconds: null,
            joinedAt: serverTimestamp()
          }, { merge: true })
          tx.update(codeRef, { isUsed: true, usedBy: uid, usedAt: serverTimestamp() })
        })
      } else if (!existing.exists()) {
        // 首次登录且无邀请码：创建 free 用户文档
        await setDoc(userRef, {
          email: cred.user.email || email,
          membership: 'free',
          inviteCodeUsed: '',
          dailyVideoLimit: 2,
          videosWatchedToday: 0,
          watchDay: todayStr,
          videoMaxDurationSeconds: 1200,
          lastLogin: serverTimestamp()
        }, { merge: true })
      } else {
        // 已存在文档：仅更新最后登录时间
        await setDoc(userRef, { lastLogin: serverTimestamp() }, { merge: true })
      }

      setConfirmDialog({
        isOpen: true,
        title: '👋 欢迎回来！',
        message: '登录成功，点击“确定”后将返回主页继续学习',
        confirmText: '确定',
        cancelText: '取消',
        onConfirm: () => navigate('/')
      })
      if (inviteCode) {
        showNotice('⭐ 恭喜！您已获得终身会员权限', 'success')
      }
    } catch (err) {
      const msg = err?.message || ''
      if (/网络|network/i.test(msg) || err?.code === 'auth/network-request-failed') {
        showNotice('🌐 网络连接失败，请检查后重试', 'error')
      } else if (/邀请码/.test(msg)) {
        showNotice('❌ 邀请码无效或已被使用\n请检查后重试', 'error')
      } else {
        showNotice('⚠️ 操作失败，请稍后重试', 'error')
      }
      setError(msg || 'Google 登录失败')
    } finally {
      setLoading(false)
      dismissNotice()
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">{mode === 'register' ? '创建你的账户' : '登录到你的账户'}</h1>
          <p className="auth-subtitle">{mode === 'register' ? '使用邮箱注册，或直接使用 Google 登录' : '使用邮箱登录，或直接使用 Google 登录'}</p>
        </div>
        <form onSubmit={onSubmit} className="auth-form">
          <label className="field-label">邮箱</label>
          <input className="auth-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <label className="field-label">密码</label>
          <input className="auth-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          {mode === 'register' && (
            <>
              <label className="field-label">邀请码（选填）</label>
              <input className="auth-input" type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value.trim())} placeholder="" />
            </>
          )}
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="primary-btn" disabled={loading}>{loading ? '提交中...' : (mode === 'register' ? '邮箱注册' : '邮箱登录')}</button>
        </form>

        {mode === 'login' && (
          <div className="auth-footer" style={{ marginTop: 8 }}>
            <button className="link-btn" onClick={() => navigate('/password')}>账户安全（忘记/修改/设置密码）</button>
          </div>
        )}

        <div className="auth-divider"><span>或</span></div>
        <button className="google-btn" onClick={onGoogleSignIn} disabled={loading}>使用 Google {mode === 'register' ? '登录' : '继续'}</button>

        <div className="auth-footer">
          {mode === 'register' ? (
            <>
              <span>已有账户？</span>
              <button className="link-btn" onClick={() => setMode('login')}>去登录</button>
            </>
          ) : (
            <>
              <span>还没有账户？</span>
              <button className="link-btn" onClick={() => setMode('register')}>去注册</button>
            </>
          )}
          <button className="link-btn" style={{ marginLeft: 'auto' }} onClick={() => navigate('/')}>返回首页</button>
        </div>
      </div>
      {/* 成功/确认弹窗 */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        onConfirm={() => { confirmDialog.onConfirm?.(); closeConfirmDialog() }}
        onCancel={closeConfirmDialog}
      />
      {/* 轻量提示 */}
      <Toast message={toastMsg} type={toastType} onClose={dismissNotice} />
    </div>
  )
}