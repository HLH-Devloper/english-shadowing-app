import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth, db } from '../firebase'
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc, runTransaction, serverTimestamp, getDoc } from 'firebase/firestore'

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
  const navigate = useNavigate()

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password)
        navigate('/')
        return
      }
      const cred = await createUserWithEmailAndPassword(auth, email, password)
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

      navigate('/')
    } catch (err) {
      setError(err?.message || '注册失败')
    } finally {
      setLoading(false)
    }
  }

  // 使用 Google 登录（Gmail）
  const onGoogleSignIn = async () => {
    setError('')
    setLoading(true)
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

      navigate('/')
    } catch (err) {
      setError(err?.message || 'Google 登录失败')
    } finally {
      setLoading(false)
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
              <input className="auth-input" type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value.trim())} placeholder="例如 EARLY001" />
            </>
          )}
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="primary-btn" disabled={loading}>{loading ? '提交中...' : (mode === 'register' ? '邮箱注册' : '邮箱登录')}</button>
        </form>

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
    </div>
  )
}