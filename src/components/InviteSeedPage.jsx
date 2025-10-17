import React, { useMemo, useState } from 'react'
import { db } from '../firebase'
import { doc, setDoc, serverTimestamp, getDoc, deleteField } from 'firebase/firestore'
import Toast from './Toast'

export default function InviteSeedPage() {
  const [toastMsg, setToastMsg] = useState('')
  const [toastType, setToastType] = useState('info')
  const dismissNotice = () => setToastMsg('')
  const showNotice = (msg, type = 'info') => { setToastMsg(msg); setToastType(type) }
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [forceAlignSchema, setForceAlignSchema] = useState(true)

  const defaultExpiryStr = useMemo(() => {
    const d = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }, [])
  const [expiryStr, setExpiryStr] = useState(defaultExpiryStr)

  const codes = Array.from({ length: 20 }, (_, i) => `GDY${String(i + 1).padStart(4, '0')}`)

  const seedInvites = async () => {
    if (running) return
    setRunning(true)
    setResult(null)
    showNotice('⏳ 正在按指定字段写入 20 个邀请码...', 'info')
    const ok = []
    const skipped = []
    const failed = []
    try {
      const expiryDate = expiryStr ? new Date(`${expiryStr}T23:59:59`) : null
      for (const code of codes) {
        try {
          const ref = doc(db, 'inviteCodes', code)
          const snap = await getDoc(ref)
          if (!snap.exists()) {
            // 新建：严格按 schema 写入
            await setDoc(ref, {
              code,
              createdAt: serverTimestamp(),
              expiryDate,
              isUsed: false,
            }, { merge: true })
            ok.push(code)
          } else {
            // 已存在：根据选项对齐字段并去除 level
            if (forceAlignSchema) {
              await setDoc(ref, {
                code,
                expiryDate,
                level: deleteField(),
              }, { merge: true })
              skipped.push(code + ' (aligned)')
            } else {
              skipped.push(code)
            }
          }
        } catch (e) {
          failed.push({ code, error: e?.message || String(e) })
        }
      }
      setResult({ ok, skipped, failed })
      if (failed.length === 0) {
        showNotice(`✅ 写入完成：新增 ${ok.length}，跳过 ${skipped.length}`, 'success')
      } else {
        showNotice(`⚠️ 完成但部分失败：新增 ${ok.length}，跳过 ${skipped.length}，失败 ${failed.length}`, 'warning')
      }
    } catch (err) {
      showNotice('❌ 写入失败，请检查权限或网络', 'error')
    } finally {
      setRunning(false)
      setTimeout(() => dismissNotice(), 1200)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 680 }}>
        <div className="auth-header">
          <h1 className="auth-title">生成邀请码（GDY0001–GDY0020）</h1>
          <p className="auth-subtitle">字段：code、createdAt、expiryDate、isUsed=false（按你提供的结构）</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <label className="field-label" style={{ marginRight: 8 }}>过期日期：</label>
          <input type="date" className="auth-input" value={expiryStr} onChange={e => setExpiryStr(e.target.value)} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={forceAlignSchema} onChange={e => setForceAlignSchema(e.target.checked)} />
            已有文档也对齐字段（移除 level、补齐 code/expiryDate）
          </label>
          <button className="primary-btn" onClick={seedInvites} disabled={running}>{running ? '写入中...' : '开始写入'}</button>
          <a className="link-btn" href="/" style={{ marginLeft: 'auto' }}>返回首页</a>
        </div>
        {result && (
          <div style={{ marginTop: 16 }}>
            <div><strong>新增</strong>（{result.ok.length}）：{result.ok.join(', ') || '无'}</div>
            <div style={{ marginTop: 6 }}><strong>跳过/已对齐</strong>（{result.skipped.length}）：{result.skipped.join(', ') || '无'}</div>
            {result.failed.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <strong>失败</strong>（{result.failed.length}）：{result.failed.map(f => f.code).join(', ')}
              </div>
            )}
          </div>
        )}
        <Toast message={toastMsg} type={toastType} onClose={dismissNotice} />
      </div>
    </div>
  )
}