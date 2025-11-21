import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase'
import { VocabularyService } from '../services/VocabularyService'
import Toast from './Toast'

export default function VocabularyPage() {
    const navigate = useNavigate()
    const [currentUser, setCurrentUser] = useState(null)
    const [words, setWords] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('list') // list | flashcard
    const [toastMsg, setToastMsg] = useState('')
    const [toastType, setToastType] = useState('info')

    const showNotice = (msg, type = 'info') => { setToastMsg(msg); setToastType(type) }
    const dismissNotice = () => setToastMsg('')

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user)
            if (user) {
                loadWords(user.uid)
            } else {
                setLoading(false)
                // 未登录引导去登录
                navigate('/register', { state: { mode: 'login' } })
            }
        })
        return () => unsub()
    }, [])

    const loadWords = async (userId) => {
        setLoading(true)
        try {
            const list = await VocabularyService.getWords(userId)
            setWords(list)
        } catch (error) {
            showNotice('加载生词本失败', 'error')
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (wordId) => {
        if (!currentUser) return
        if (!window.confirm('确定要移除这个单词吗？')) return
        try {
            await VocabularyService.deleteWord(currentUser.uid, wordId)
            setWords(prev => prev.filter(w => w.id !== wordId))
            showNotice('已移除', 'success')
        } catch (error) {
            showNotice('删除失败', 'error')
        }
    }

    // --- Flashcard Logic ---
    const [currentCardIndex, setCurrentCardIndex] = useState(0)
    const [isFlipped, setIsFlipped] = useState(false)
    const [reviewQueue, setReviewQueue] = useState([])

    useEffect(() => {
        if (activeTab === 'flashcard') {
            // 简单的复习队列：优先复习 masteryLevel 低的，或者 nextReview 时间到的（这里简化为所有词随机乱序）
            // 实际生产环境应使用更复杂的算法
            const queue = [...words].sort(() => Math.random() - 0.5)
            setReviewQueue(queue)
            setCurrentCardIndex(0)
            setIsFlipped(false)
        }
    }, [activeTab, words])

    const handleMasteryUpdate = async (isRemembered) => {
        if (!currentUser || reviewQueue.length === 0) return

        const currentWord = reviewQueue[currentCardIndex]
        try {
            const newLevel = await VocabularyService.updateMastery(
                currentUser.uid,
                currentWord.id,
                currentWord.masteryLevel || 0,
                isRemembered
            )

            // 更新本地状态
            setWords(prev => prev.map(w => w.id === currentWord.id ? { ...w, masteryLevel: newLevel } : w))

            // 下一张
            setIsFlipped(false)
            if (currentCardIndex < reviewQueue.length - 1) {
                setCurrentCardIndex(prev => prev + 1)
            } else {
                showNotice('🎉 太棒了！本轮复习完成！', 'success')
                setActiveTab('list')
            }
        } catch (error) {
            showNotice('更新进度失败', 'error')
        }
    }

    const speakWord = (text) => {
        if ('speechSynthesis' in window) {
            const utter = new SpeechSynthesisUtterance(text)
            utter.lang = 'en-US'
            window.speechSynthesis.speak(utter)
        }
    }

    return (
        <section className="cyber-page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <header className="cyber-header">
                <div className="cyber-brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
                    <span className="cyber-brand-text">⬅ 返回首页</span>
                </div>
                <div className="cyber-nav">
                    <div className={`cyber-nav-item ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}>单词列表</div>
                    <div className={`cyber-nav-item ${activeTab === 'flashcard' ? 'active' : ''}`} onClick={() => setActiveTab('flashcard')}>卡片复习</div>
                </div>
                <div className="cyber-actions">
                    <span className="cyber-guest">共 {words.length} 个生词</span>
                </div>
            </header>

            <div className="cyber-content" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
                {loading ? (
                    <div style={{ color: '#fff', textAlign: 'center', marginTop: '50px' }}>加载中...</div>
                ) : (
                    <>
                        {activeTab === 'list' && (
                            <div className="vocab-list">
                                {words.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '50px' }}>
                                        <div style={{ fontSize: '48px', marginBottom: '20px' }}>📚</div>
                                        <p>生词本还是空的哦</p>
                                        <p>快去视频里点击字幕收藏生词吧！</p>
                                    </div>
                                ) : (
                                    words.map(word => (
                                        <div key={word.id} className="bento-card" style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <h3 style={{ margin: 0, fontSize: '20px', color: '#fff' }}>{word.word}</h3>
                                                        <span style={{ color: '#94a3b8', fontSize: '14px' }}>{word.phonetic}</span>
                                                        <button
                                                            onClick={() => speakWord(word.word)}
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#06b6d4' }}
                                                        >🔊</button>
                                                    </div>
                                                    <p style={{ color: '#cbd5e1', margin: '4px 0' }}>{word.definition}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleDelete(word.id)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, fontSize: '18px' }}
                                                    title="移除"
                                                >🗑️</button>
                                            </div>

                                            {word.context && (
                                                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px', fontSize: '14px' }}>
                                                    <div style={{ color: '#e2e8f0' }}>"{word.context.original}"</div>
                                                    <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '2px' }}>{word.context.translation}</div>
                                                </div>
                                            )}

                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                                                <span>来源: {word.source}</span>
                                                <span>掌握度: {'⭐'.repeat(word.masteryLevel || 0)}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {activeTab === 'flashcard' && (
                            <div className="flashcard-container" style={{ height: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                {reviewQueue.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: '#fff' }}>
                                        <h3>没有需要复习的单词</h3>
                                        <button className="primary-btn" onClick={() => setActiveTab('list')} style={{ marginTop: '20px' }}>查看列表</button>
                                    </div>
                                ) : (
                                    <>
                                        <div
                                            className="flashcard"
                                            onClick={() => setIsFlipped(!isFlipped)}
                                            style={{
                                                width: '100%',
                                                maxWidth: '400px',
                                                height: '300px',
                                                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                                                border: '1px solid #334155',
                                                borderRadius: '16px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                position: 'relative',
                                                perspective: '1000px',
                                                transition: 'transform 0.6s',
                                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
                                            }}
                                        >
                                            <div style={{ textAlign: 'center', padding: '20px' }}>
                                                {!isFlipped ? (
                                                    <>
                                                        <h2 style={{ fontSize: '32px', marginBottom: '10px', color: '#fff' }}>{reviewQueue[currentCardIndex].word}</h2>
                                                        <div style={{ color: '#94a3b8', fontSize: '18px' }}>{reviewQueue[currentCardIndex].phonetic}</div>
                                                        <div style={{ marginTop: '20px', color: '#64748b', fontSize: '14px' }}>(点击翻转)</div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <h3 style={{ color: '#fff', marginBottom: '10px' }}>{reviewQueue[currentCardIndex].definition}</h3>
                                                        {reviewQueue[currentCardIndex].context && (
                                                            <div style={{ marginTop: '20px', fontStyle: 'italic', color: '#cbd5e1' }}>
                                                                "{reviewQueue[currentCardIndex].context.original}"
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {isFlipped && (
                                            <div style={{ display: 'flex', gap: '20px', marginTop: '30px' }}>
                                                <button
                                                    className="secondary-btn"
                                                    style={{ padding: '10px 30px', fontSize: '16px', background: '#ef4444', border: 'none', color: 'white' }}
                                                    onClick={() => handleMasteryUpdate(false)}
                                                >
                                                    模糊 😵
                                                </button>
                                                <button
                                                    className="primary-btn"
                                                    style={{ padding: '10px 30px', fontSize: '16px', background: '#22c55e', border: 'none', color: 'white' }}
                                                    onClick={() => handleMasteryUpdate(true)}
                                                >
                                                    记住了 😎
                                                </button>
                                            </div>
                                        )}

                                        <div style={{ marginTop: '20px', color: '#64748b' }}>
                                            进度: {currentCardIndex + 1} / {reviewQueue.length}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
            <Toast message={toastMsg} type={toastType} onClose={dismissNotice} />
        </section>
    )
}
