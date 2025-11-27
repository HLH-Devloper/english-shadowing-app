import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth, db } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, getDocs, doc, getDoc, setDoc, deleteDoc, serverTimestamp, query, orderBy, writeBatch } from 'firebase/firestore'
import Toast from './Toast'

export default function AdminPage() {
    const navigate = useNavigate()
    const [currentUser, setCurrentUser] = useState(null)
    const [isAdmin, setIsAdmin] = useState(false)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('users') // 'users' | 'invites'
    const [users, setUsers] = useState([])
    const [inviteCodes, setInviteCodes] = useState([])
    const [newCode, setNewCode] = useState('')
    const [expiryDate, setExpiryDate] = useState('')
    const [selectedCodes, setSelectedCodes] = useState(new Set())
    const [toastMsg, setToastMsg] = useState('')
    const [toastType, setToastType] = useState('info')

    const showNotice = (msg, type = 'info') => { setToastMsg(msg); setToastType(type) }
    const dismissNotice = () => setToastMsg('')

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setCurrentUser(user)
                // Check admin role
                try {
                    const userDoc = await getDoc(doc(db, 'users', user.uid))
                    if (userDoc.exists() && userDoc.data().role === 'admin') {
                        setIsAdmin(true)
                        loadData()
                    } else {
                        navigate('/') // Not admin, redirect home
                    }
                } catch (error) {
                    console.error('Error checking admin role:', error)
                    navigate('/')
                }
            } else {
                navigate('/register?mode=login')
            }
            setLoading(false)
        })
        return () => unsub()
    }, [])

    const loadData = async () => {
        await Promise.all([loadUsers(), loadInviteCodes()])
    }

    const loadUsers = async () => {
        try {
            // Remove orderBy to ensure we get all users (some might miss joinedAt)
            const q = query(collection(db, 'users'))
            const snapshot = await getDocs(q)
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

            // Client-side sort: joinedAt -> lastLogin -> 0
            list.sort((a, b) => {
                const timeA = a.joinedAt?.toDate?.() || a.lastLogin?.toDate?.() || new Date(0)
                const timeB = b.joinedAt?.toDate?.() || b.lastLogin?.toDate?.() || new Date(0)
                return timeB - timeA
            })

            setUsers(list)
        } catch (error) {
            console.error('Load users error:', error)
            showNotice('加载用户列表失败: ' + error.message, 'error')
        }
    }

    const loadInviteCodes = async () => {
        try {
            const q = query(collection(db, 'inviteCodes'), orderBy('createdAt', 'desc'))
            const snapshot = await getDocs(q)
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            setInviteCodes(list)
            setSelectedCodes(new Set()) // Reset selection on reload
        } catch (error) {
            console.error('Load invite codes error:', error)
            showNotice('加载邀请码失败', 'error')
        }
    }

    const handleCreateCode = async () => {
        const code = newCode.trim().toUpperCase()
        if (!code) return

        try {
            const data = {
                createdAt: serverTimestamp(),
                isUsed: false,
                usedBy: null,
                usedAt: null
            }
            if (expiryDate) {
                data.expiryDate = new Date(expiryDate)
            }

            await setDoc(doc(db, 'inviteCodes', code), data)
            setNewCode('')
            setExpiryDate('')
            showNotice('邀请码创建成功', 'success')
            loadInviteCodes()
        } catch (error) {
            showNotice('创建失败，可能已存在', 'error')
        }
    }

    const handleGenerateCode = () => {
        const randomCode = Math.random().toString(36).substring(2, 10).toUpperCase()
        setNewCode(randomCode)
    }

    const handleDeleteCode = async (codeId) => {
        if (!window.confirm(`确定要删除邀请码 ${codeId} 吗？`)) return
        try {
            await deleteDoc(doc(db, 'inviteCodes', codeId))
            showNotice('删除成功', 'success')
            setInviteCodes(prev => prev.filter(c => c.id !== codeId))
        } catch (error) {
            showNotice('删除失败', 'error')
        }
    }

    // Bulk Actions
    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedCodes(new Set(inviteCodes.map(c => c.id)))
        } else {
            setSelectedCodes(new Set())
        }
    }

    const handleSelect = (codeId) => {
        const newSelected = new Set(selectedCodes)
        if (newSelected.has(codeId)) {
            newSelected.delete(codeId)
        } else {
            newSelected.add(codeId)
        }
        setSelectedCodes(newSelected)
    }

    const handleBulkDelete = async () => {
        if (selectedCodes.size === 0) return
        if (!window.confirm(`确定要删除选中的 ${selectedCodes.size} 个邀请码吗？`)) return

        try {
            const batch = writeBatch(db)
            selectedCodes.forEach(codeId => {
                batch.delete(doc(db, 'inviteCodes', codeId))
            })
            await batch.commit()
            showNotice(`成功删除 ${selectedCodes.size} 个邀请码`, 'success')
            loadInviteCodes()
        } catch (error) {
            console.error('Bulk delete error:', error)
            showNotice('批量删除失败', 'error')
        }
    }

    const handleBulkUpdateExpiry = async () => {
        if (selectedCodes.size === 0) return
        const dateStr = prompt('请输入新的过期日期 (YYYY-MM-DD)，留空则清除过期时间：')
        if (dateStr === null) return // Cancelled

        let newDate = null
        if (dateStr.trim()) {
            newDate = new Date(dateStr)
            if (isNaN(newDate.getTime())) {
                showNotice('日期格式无效', 'error')
                return
            }
        }

        try {
            const batch = writeBatch(db)
            selectedCodes.forEach(codeId => {
                const ref = doc(db, 'inviteCodes', codeId)
                if (newDate) {
                    batch.update(ref, { expiryDate: newDate })
                } else {
                    // Firestore doesn't support deleting a field easily in update without FieldValue.delete()
                    // But we can set it to null or a far future date. Let's use null for "no expiry" logic if supported,
                    // or just update logic to check for null.
                    // Assuming our logic checks `expiryDate && ...`
                    batch.update(ref, { expiryDate: null })
                }
            })
            await batch.commit()
            showNotice(`成功更新 ${selectedCodes.size} 个邀请码`, 'success')
            loadInviteCodes()
        } catch (error) {
            console.error('Bulk update error:', error)
            showNotice('批量更新失败', 'error')
        }
    }

    const handleEditExpiry = async (code) => {
        const currentStr = code.expiryDate?.toDate ? code.expiryDate.toDate().toISOString().split('T')[0] : ''
        const dateStr = prompt('修改过期日期 (YYYY-MM-DD)，留空清除：', currentStr)
        if (dateStr === null) return

        let newDate = null
        if (dateStr.trim()) {
            newDate = new Date(dateStr)
            if (isNaN(newDate.getTime())) {
                showNotice('日期格式无效', 'error')
                return
            }
        }

        try {
            await setDoc(doc(db, 'inviteCodes', code.id), { expiryDate: newDate }, { merge: true })
            showNotice('更新成功', 'success')
            loadInviteCodes()
        } catch (error) {
            showNotice('更新失败', 'error')
        }
    }

    if (loading) return <div style={{ color: '#fff', padding: '50px', textAlign: 'center' }}>Loading...</div>
    if (!isAdmin) return null

    return (
        <div className="cyber-page" style={{ minHeight: '100vh', padding: '80px 20px' }}>
            <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                    <h1 style={{ color: '#fff', margin: 0 }}>🛡️ 管理后台</h1>
                    <button onClick={() => navigate('/')} style={{ background: 'none', border: '1px solid #475569', color: '#94a3b8', padding: '6px 16px', borderRadius: '8px', cursor: 'pointer' }}>返回首页</button>
                </header>

                <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
                    <button
                        onClick={() => setActiveTab('users')}
                        style={{
                            padding: '10px 24px',
                            borderRadius: '8px',
                            border: 'none',
                            background: activeTab === 'users' ? '#3b82f6' : 'rgba(30, 41, 59, 0.5)',
                            color: '#fff',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >用户管理 ({users.length})</button>
                    <button
                        onClick={() => setActiveTab('invites')}
                        style={{
                            padding: '10px 24px',
                            borderRadius: '8px',
                            border: 'none',
                            background: activeTab === 'invites' ? '#8b5cf6' : 'rgba(30, 41, 59, 0.5)',
                            color: '#fff',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >邀请码管理 ({inviteCodes.length})</button>
                </div>

                <div style={{ background: 'rgba(15, 23, 42, 0.6)', borderRadius: '16px', border: '1px solid #334155', padding: '20px', overflowX: 'auto' }}>
                    {activeTab === 'users' ? (
                        <table style={{ width: '100%', borderCollapse: 'collapse', color: '#cbd5e1', fontSize: '14px' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #334155', textAlign: 'left' }}>
                                    <th style={{ padding: '12px' }}>Email</th>
                                    <th style={{ padding: '12px' }}>会员状态</th>
                                    <th style={{ padding: '12px' }}>注册时间</th>
                                    <th style={{ padding: '12px' }}>最后登录</th>
                                    <th style={{ padding: '12px' }}>使用邀请码</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(user => (
                                    <tr key={user.id} style={{ borderBottom: '1px solid #1e293b' }}>
                                        <td style={{ padding: '12px' }}>{user.email}</td>
                                        <td style={{ padding: '12px' }}>
                                            <span style={{
                                                padding: '2px 8px', borderRadius: '4px',
                                                background: user.membership === 'member' ? '#10b981' : '#64748b',
                                                color: '#fff', fontSize: '12px'
                                            }}>
                                                {user.membership === 'member' ? '终身会员' : '免费用户'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px' }}>{user.joinedAt?.toDate ? user.joinedAt.toDate().toLocaleDateString() : '-'}</td>
                                        <td style={{ padding: '12px' }}>{user.lastLogin?.toDate ? user.lastLogin.toDate().toLocaleDateString() : '-'}</td>
                                        <td style={{ padding: '12px', fontFamily: 'monospace' }}>{user.inviteCodeUsed || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div>
                            {/* Create Bar */}
                            <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid #334155', paddingBottom: '20px' }}>
                                <input
                                    type="text"
                                    value={newCode}
                                    onChange={e => setNewCode(e.target.value)}
                                    placeholder="输入新邀请码"
                                    style={{
                                        background: '#1e293b', border: '1px solid #475569', borderRadius: '8px',
                                        padding: '8px 12px', color: '#fff', outline: 'none'
                                    }}
                                />
                                <input
                                    type="date"
                                    value={expiryDate}
                                    onChange={e => setExpiryDate(e.target.value)}
                                    style={{
                                        background: '#1e293b', border: '1px solid #475569', borderRadius: '8px',
                                        padding: '8px 12px', color: '#fff', outline: 'none'
                                    }}
                                    title="过期时间（可选）"
                                />
                                <button
                                    onClick={handleGenerateCode}
                                    style={{ background: '#334155', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer' }}
                                >🎲 随机生成</button>
                                <button
                                    onClick={handleCreateCode}
                                    style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer' }}
                                >➕ 添加</button>
                            </div>

                            {/* Bulk Actions Bar */}
                            {selectedCodes.size > 0 && (
                                <div style={{ marginBottom: '20px', padding: '10px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3b82f6', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <span style={{ color: '#fff', fontWeight: 'bold' }}>已选择 {selectedCodes.size} 项</span>
                                    <button
                                        onClick={handleBulkUpdateExpiry}
                                        style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}
                                    >📅 批量修改过期时间</button>
                                    <button
                                        onClick={handleBulkDelete}
                                        style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}
                                    >🗑️ 批量删除</button>
                                </div>
                            )}

                            <table style={{ width: '100%', borderCollapse: 'collapse', color: '#cbd5e1', fontSize: '14px' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #334155', textAlign: 'left' }}>
                                        <th style={{ padding: '12px', width: '40px' }}>
                                            <input
                                                type="checkbox"
                                                onChange={handleSelectAll}
                                                checked={inviteCodes.length > 0 && selectedCodes.size === inviteCodes.length}
                                            />
                                        </th>
                                        <th style={{ padding: '12px' }}>邀请码</th>
                                        <th style={{ padding: '12px' }}>状态</th>
                                        <th style={{ padding: '12px' }}>过期时间</th>
                                        <th style={{ padding: '12px' }}>使用者</th>
                                        <th style={{ padding: '12px' }}>创建时间</th>
                                        <th style={{ padding: '12px' }}>操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {inviteCodes.map(code => (
                                        <tr key={code.id} style={{ borderBottom: '1px solid #1e293b', background: selectedCodes.has(code.id) ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }}>
                                            <td style={{ padding: '12px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedCodes.has(code.id)}
                                                    onChange={() => handleSelect(code.id)}
                                                />
                                            </td>
                                            <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: '16px', color: '#fff' }}>{code.id}</td>
                                            <td style={{ padding: '12px' }}>
                                                <span style={{
                                                    padding: '2px 8px', borderRadius: '4px',
                                                    background: code.isUsed ? '#ef4444' : (code.expiryDate && code.expiryDate.toDate() < new Date() ? '#64748b' : '#10b981'),
                                                    color: '#fff', fontSize: '12px'
                                                }}>
                                                    {code.isUsed ? '已使用' : (code.expiryDate && code.expiryDate.toDate() < new Date() ? '已过期' : '未使用')}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px' }}>{code.expiryDate?.toDate ? code.expiryDate.toDate().toLocaleDateString() : '-'}</td>
                                            <td style={{ padding: '12px', fontSize: '12px', color: '#94a3b8' }}>{code.usedBy || '-'}</td>
                                            <td style={{ padding: '12px' }}>{code.createdAt?.toDate ? code.createdAt.toDate().toLocaleDateString() : '-'}</td>
                                            <td style={{ padding: '12px', display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={() => handleEditExpiry(code)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7 }}
                                                    title="修改过期时间"
                                                >📅</button>
                                                <button
                                                    onClick={() => handleDeleteCode(code.id)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7 }}
                                                    title="删除"
                                                >🗑️</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
            <Toast message={toastMsg} type={toastType} onClose={dismissNotice} />
        </div>
    )
}
