import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth, changePassword, sendPasswordReset } from '../firebase'
import { fetchSignInMethodsForEmail, EmailAuthProvider, linkWithCredential } from 'firebase/auth'
import Toast from './Toast'

export default function PasswordPage() {
  const navigate = useNavigate()
  const [toastMsg, setToastMsg] = useState('')
  const [toastType, setToastType] = useState('info')
  const showNotice = (msg, type = 'info') => { setToastMsg(msg); setToastType(type) }
  const dismissNotice = () => setToastMsg('')

  // 忘记密码
  const [email, setEmail] = useState('')
  const [resetStatus, setResetStatus] = useState('')

  useEffect(() => {
    // 默认填充当前登录邮箱，便于用户直接操作
    if (auth.currentUser?.email) setEmail(auth.currentUser.email)
  }, [])

  const onReset = async () => {
    setResetStatus('')
    const normalizedEmail = (email || '').trim()
    if (!normalizedEmail) { setResetStatus('请输入邮箱以接收重置链接'); return }
    showNotice('📧 正在发送重置邮件...', 'info')
    try {
      // 直接尝试发送，让 Firebase 返回更准确的结果
      await sendPasswordReset(normalizedEmail)
      setResetStatus('重置邮件已发送，请前往邮箱并按提示操作')
      showNotice('✅ 重置邮件已发送', 'success')
    } catch (err) {
      const code = err?.code || err?.message || ''
      let msg = '发送失败，请稍后重试'
      if (code === 'auth/invalid-email') msg = '邮箱格式不正确'
      if (code === 'auth/user-not-found') msg = '该邮箱未注册或尚未设置邮箱密码'
      if (code === 'auth/too-many-requests') msg = '尝试过于频繁，请稍后再试'
      // 若该邮箱仅绑定了 Google 登录，提供更明确的指引
      try {
        const methods = await fetchSignInMethodsForEmail(auth, normalizedEmail)
        if (methods.includes('google.com') && !methods.includes('password')) {
          msg = '该邮箱目前仅绑定 Google 登录。请先在下方“设置登录密码”绑定邮箱密码后，再尝试重置；或直接使用 Google 登录。'
        }
      } catch {}
      setResetStatus(msg)
      showNotice(`⚠️ ${msg}`, 'error')
    } finally {
      dismissNotice()
    }
  }

  // 修改密码（需已登录）
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changeStatus, setChangeStatus] = useState('')

  const onChangePassword = async (e) => {
    e?.preventDefault?.()
    setChangeStatus('')
    const isLoggedIn = !!auth.currentUser
    if (!isLoggedIn) { setChangeStatus('请先登录后再修改密码'); return }
    if (newPassword.length < 6) { setChangeStatus('新密码至少 6 位'); return }
    if (newPassword !== confirmPassword) { setChangeStatus('两次输入不一致'); return }
    showNotice('🔐 正在修改密码...', 'info')
    try {
      await changePassword(currentPassword, newPassword)
      setChangeStatus('修改成功，下次登录请使用新密码')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      showNotice('✅ 密码修改成功', 'success')
    } catch (err) {
      const code = err?.code || err?.message || ''
      let msg = '修改失败，请稍后重试'
      if (code === 'auth/wrong-password') msg = '当前密码错误'
      if (code === 'auth/weak-password') msg = '新密码过于简单（至少 6 位）'
      if (code === 'auth/requires-recent-login') msg = '需要近期登录凭证，请重新登录后再试'
      if (code === 'not_logged_in') msg = '尚未登录，请先登录'
      setChangeStatus(msg)
      showNotice(`⚠️ ${msg}`, 'error')
    } finally {
      dismissNotice()
    }
  }

  // 设置登录密码（适用于使用 Google 登录且尚未设置密码的用户）
  const [setupPassword, setSetupPassword] = useState('')
  const [setupConfirm, setSetupConfirm] = useState('')
  const [setupStatus, setSetupStatus] = useState('')

  const onSetupPassword = async () => {
    setSetupStatus('')
    const user = auth.currentUser
    if (!user) { setSetupStatus('请先使用 Google 登录'); return }
    const userEmail = user.email
    if (!userEmail) { setSetupStatus('该账户没有邮箱地址，无法设置邮箱密码'); return }
    if (setupPassword.length < 6) { setSetupStatus('新密码至少 6 位'); return }
    if (setupPassword !== setupConfirm) { setSetupStatus('两次输入不一致'); return }
    showNotice('🔐 正在为账户设置登录密码...', 'info')
    try {
      // 如果已经有密码登录方法，给出提示而不是重复绑定
      const methods = await fetchSignInMethodsForEmail(auth, userEmail)
      if (methods.includes('password')) {
        setSetupStatus('你的账户已设置过登录密码。如需更改请使用右侧“修改密码”。')
        showNotice('ℹ️ 已存在邮箱密码', 'info')
        return
      }
      const credential = EmailAuthProvider.credential(userEmail, setupPassword)
      await linkWithCredential(user, credential)
      setSetupStatus('设置成功！以后既可用邮箱+密码登录，也可继续使用 Google 登录。')
      setSetupPassword('')
      setSetupConfirm('')
      showNotice('✅ 登录密码设置成功', 'success')
    } catch (err) {
      const code = err?.code || err?.message || ''
      let msg = '设置失败，请稍后重试'
      if (code === 'auth/provider-already-linked') msg = '账户已绑定邮箱密码'
      if (code === 'auth/requires-recent-login') msg = '需要近期登录凭证，请重新登录后再试'
      if (code === 'auth/email-already-in-use') msg = '该邮箱已存在邮箱密码账户，请使用“忘记密码”重置或更换邮箱'
      setSetupStatus(msg)
      showNotice(`⚠️ ${msg}`, 'error')
    } finally {
      dismissNotice()
    }
  }

  return (
    <div className="auth-page" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">账户安全</h1>
          <p className="auth-subtitle">忘记密码与已登录修改密码的操作中心</p>
        </div>

        {/* 并排布局，减少滚动：大屏并排，窄屏自动换行 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, alignItems: 'start' }}>
          {/* 忘记密码模块 */}
          <section style={{ marginTop: 8 }}>
            <h2 className="auth-title" style={{ fontSize: 18, marginBottom: 6 }}>忘记密码</h2>
            <p className="auth-subtitle" style={{ marginBottom: 8 }}>输入你的注册邮箱，我们会发送重置链接到你的邮箱。</p>
            <label className="field-label">邮箱</label>
            <input className="auth-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="用于接收重置链接的邮箱" />
            <button type="button" className="primary-btn" onClick={onReset}>发送重置邮件</button>
            {resetStatus && <div className="auth-error" style={{ whiteSpace: 'pre-line' }}>{resetStatus}</div>}
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
              提示：请检查垃圾邮件/推广邮件。若仍未收到，请确认该邮箱已启用“密码登录”。
            </div>
          </section>

          {/* 修改密码模块 */}
          <section>
            <h2 className="auth-title" style={{ fontSize: 18, marginBottom: 6 }}>修改密码（需已登录）</h2>
            <p className="auth-subtitle" style={{ marginBottom: 8 }}>为安全起见，需要先验证当前密码，再设置新密码。</p>
            <form onSubmit={onChangePassword} className="auth-form">
              <label className="field-label">当前密码</label>
              <input className="auth-input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="当前密码" />
              <label className="field-label">新密码（≥6位）</label>
              <input className="auth-input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="新密码" />
              <label className="field-label">确认新密码</label>
              <input className="auth-input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="再次输入新密码" />
              <button type="submit" className="primary-btn">修改密码</button>
            </form>
            {changeStatus && <div className="auth-error" style={{ whiteSpace: 'pre-line' }}>{changeStatus}</div>}
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
              已使用 Google 登录并在下方设置了密码？请在上方输入当前密码后进行修改。尚未设置的用户请先在下方完成“设置登录密码”。
            </div>
          </section>

          {/* 设置登录密码模块（Google 登录用户） */}
          <section>
            <h2 className="auth-title" style={{ fontSize: 18, marginBottom: 6 }}>设置登录密码（Google 登录用户）</h2>
            <p className="auth-subtitle" style={{ marginBottom: 8 }}>已使用 Google 登录但没有邮箱密码？在此为你的账户设置一个邮箱密码，之后可用邮箱+密码或继续用 Google 登录。</p>
            <label className="field-label">新密码（≥6位）</label>
            <input className="auth-input" type="password" value={setupPassword} onChange={(e) => setSetupPassword(e.target.value)} placeholder="新密码" />
            <label className="field-label">确认新密码</label>
            <input className="auth-input" type="password" value={setupConfirm} onChange={(e) => setSetupConfirm(e.target.value)} placeholder="再次输入新密码" />
            <button type="button" className="primary-btn" onClick={onSetupPassword}>设置登录密码</button>
            {setupStatus && <div className="auth-error" style={{ whiteSpace: 'pre-line' }}>{setupStatus}</div>}
          </section>
        </div>

      <div className="auth-footer" style={{ marginTop: 16 }}>
        <button className="link-btn" onClick={() => navigate('/register')}>返回登录</button>
        <button className="link-btn" style={{ marginLeft: 'auto' }} onClick={() => navigate('/')}>返回首页</button>
      </div>
      <Toast message={toastMsg} type={toastType} onClose={dismissNotice} />
      </div>
    </div>
  )
}