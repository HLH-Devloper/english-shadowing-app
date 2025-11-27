import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase'
import { VocabularyService } from '../services/VocabularyService'
import VocabularyStats from './VocabularyStats'
import Toast from './Toast'

export default function VocabularyPage() {
    const navigate = useNavigate()
    const [currentUser, setCurrentUser] = useState(null)
    const [words, setWords] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('list') // list | flashcard
    const [filterType, setFilterType] = useState('all') // all | word | sentence | starred
    const [filterLevel, setFilterLevel] = useState('all') // all | 0 | 1 | 2 | 3 | 4 | 5
    const [viewMode, setViewMode] = useState('card') // card | compact
    const [visibleCount, setVisibleCount] = useState(20)
    const [showRules, setShowRules] = useState(false)
    const [showStats, setShowStats] = useState(false)
    const [showClearModal, setShowClearModal] = useState(false)
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

    const handleToggleStar = async (wordId, currentStatus) => {
        if (!currentUser) return
        try {
            const newStatus = !currentStatus
            await VocabularyService.toggleStar(currentUser.uid, wordId, newStatus)
            setWords(prev => prev.map(w => w.id === wordId ? { ...w, isStarred: newStatus } : w))
        } catch (error) {
            showNotice('操作失败', 'error')
        }
    }

    const handleClearAll = () => {
        if (!currentUser) return
        setShowClearModal(true)
    }

    const confirmClearAll = async () => {
        try {
            await VocabularyService.clearVocabulary(currentUser.uid)
            setWords([])
            showNotice('生词本已清空', 'success')
            setShowClearModal(false)
        } catch (error) {
            showNotice('清空失败', 'error')
        }
    }

    // --- Flashcard Logic ---
    const [currentCardIndex, setCurrentCardIndex] = useState(0)
    const [isFlipped, setIsFlipped] = useState(false)
    const [reviewQueue, setReviewQueue] = useState([])
    const [reviewMode, setReviewMode] = useState('due') // 'due' | 'all'

    useEffect(() => {
        if (activeTab === 'flashcard') {
            let queue = []
            if (reviewMode === 'all') {
                // Review All: Shuffle all words
                queue = [...words].sort(() => Math.random() - 0.5)
            } else {
                // Review Due: Filter by date
                const now = new Date()
                const dueWords = words.filter(w => {
                    if (!w.nextReview) return true // 兼容旧数据
                    // Firestore Timestamp 转 Date
                    const reviewDate = w.nextReview.toDate ? w.nextReview.toDate() : new Date(w.nextReview)
                    return reviewDate <= now
                })

                // 按复习时间排序（越早过期的越先复习）
                queue = dueWords.sort((a, b) => {
                    const dateA = a.nextReview?.toDate ? a.nextReview.toDate() : new Date(a.nextReview || 0)
                    const dateB = b.nextReview?.toDate ? b.nextReview.toDate() : new Date(b.nextReview || 0)
                    return dateA - dateB
                })
            }

            setReviewQueue(queue)
            setCurrentCardIndex(0)
            setIsFlipped(false)
        }
    }, [activeTab, reviewMode])

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

    const speakWord = (text, e) => {
        if (e) e.stopPropagation()
        if ('speechSynthesis' in window) {
            const utter = new SpeechSynthesisUtterance(text)
            utter.lang = 'en-US'
            window.speechSynthesis.speak(utter)
        }
    }

    const allFilteredWords = words.filter(w => {
        // 1. Filter by Type/Starred
        let typeMatch = true
        if (filterType === 'starred') {
            typeMatch = w.isStarred === true
        } else if (filterType !== 'all') {
            const type = w.type || 'word'
            typeMatch = type === filterType
        }

        // 2. Filter by Level
        let levelMatch = true
        if (filterLevel !== 'all') {
            const level = w.masteryLevel || 0
            levelMatch = level === parseInt(filterLevel)
        }

        return typeMatch && levelMatch
    })

    const renderLevelStars = (level = 0) => {
        const stars = []
        for (let i = 0; i < 5; i++) {
            stars.push(
                <span key={i} style={{ color: i < level ? '#10b981' : '#334155', fontSize: '12px' }}>
                    ★
                </span>
            )
        }
        return <div style={{ display: 'flex', gap: '1px' }} title={`熟练度 Lv.${level}`}>{stars}</div>
    }

    const displayedWords = allFilteredWords.slice(0, visibleCount)
    const hasMore = displayedWords.length < allFilteredWords.length

    const handleLoadMore = () => {
        setVisibleCount(prev => prev + 20)
    }

    // Reset visible count when filter changes
    useEffect(() => {
        setVisibleCount(20)
    }, [filterType, activeTab])

    return (
        <section className="cyber-page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <header className="cyber-header" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, display: 'flex', alignItems: 'center', gap: '24px' }}>
                <div className="back-btn" onClick={() => navigate('/')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '1.1rem', fontWeight: 'bold' }}>
                    <span style={{ marginRight: '8px' }}>⬅</span> 返回首页
                </div>
                <div className="cyber-nav">
                    <div className={`cyber-nav-item ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}>单词列表</div>
                    <div className={`cyber-nav-item ${activeTab === 'flashcard' ? 'active' : ''}`} onClick={() => setActiveTab('flashcard')}>卡片复习</div>
                </div>
                <div className="cyber-actions" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    {words.length > 0 && (
                        <button
                            onClick={handleClearAll}
                            style={{ background: 'none', border: '1px solid rgba(239, 68, 68, 0.5)', borderRadius: '50%', width: '24px', height: '24px', color: '#ef4444', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="清空生词本"
                        >🗑️</button>
                    )}
                    <button
                        onClick={() => setShowStats(true)}
                        style={{ background: 'none', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: '24px', height: '24px', color: '#fff', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="统计数据"
                    >📊</button>
                    <button
                        onClick={() => setShowRules(true)}
                        style={{ background: 'none', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: '24px', height: '24px', color: '#fff', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="复习规则"
                    >?</button>
                    <span className="cyber-guest">共 {words.length} 个生词</span>
                </div>
            </header>

            <div className="cyber-content" style={{ padding: '120px 20px 40px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
                {loading ? (
                    <div style={{ color: '#fff', textAlign: 'center', marginTop: '50px' }}>加载中...</div>
                ) : (
                    <>
                        {activeTab === 'list' && (
                            <div className="vocab-list">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                                    {/* Left: Filters */}
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <button
                                            onClick={() => setFilterType('all')}
                                            style={{
                                                padding: '6px 16px',
                                                borderRadius: '20px',
                                                border: '1px solid #334155',
                                                background: filterType === 'all' ? '#3b82f6' : 'rgba(30, 41, 59, 0.5)',
                                                color: '#fff',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >全部</button>
                                        <button
                                            onClick={() => setFilterType('word')}
                                            style={{
                                                padding: '6px 16px',
                                                borderRadius: '20px',
                                                border: '1px solid #334155',
                                                background: filterType === 'word' ? '#06b6d4' : 'rgba(30, 41, 59, 0.5)',
                                                color: '#fff',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >单词</button>
                                        <button
                                            onClick={() => setFilterType('sentence')}
                                            style={{
                                                padding: '6px 16px',
                                                borderRadius: '20px',
                                                border: '1px solid #334155',
                                                background: filterType === 'sentence' ? '#8b5cf6' : 'rgba(30, 41, 59, 0.5)',
                                                color: '#fff',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >句子</button>
                                        <button
                                            onClick={() => setFilterType('starred')}
                                            style={{
                                                padding: '6px 16px',
                                                borderRadius: '20px',
                                                border: '1px solid #334155',
                                                background: filterType === 'starred' ? '#f59e0b' : 'rgba(30, 41, 59, 0.5)',
                                                color: '#fff',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >⭐ 收藏</button>

                                        {/* Level Filter (Styled) */}
                                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                            <select
                                                value={filterLevel}
                                                onChange={(e) => setFilterLevel(e.target.value)}
                                                style={{
                                                    appearance: 'none',
                                                    padding: '6px 32px 6px 16px',
                                                    borderRadius: '20px',
                                                    border: '1px solid #334155',
                                                    background: filterLevel !== 'all' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(30, 41, 59, 0.5)',
                                                    color: '#fff',
                                                    cursor: 'pointer',
                                                    outline: 'none',
                                                    fontSize: '13.33px',
                                                    fontFamily: 'inherit'
                                                }}
                                            >
                                                <option value="all" style={{ background: '#1e293b' }}>全部等级</option>
                                                <option value="0" style={{ background: '#1e293b' }}>Lv.0 陌生</option>
                                                <option value="1" style={{ background: '#1e293b' }}>Lv.1 认识</option>
                                                <option value="2" style={{ background: '#1e293b' }}>Lv.2 熟悉</option>
                                                <option value="3" style={{ background: '#1e293b' }}>Lv.3 掌握</option>
                                                <option value="4" style={{ background: '#1e293b' }}>Lv.4 牢记</option>
                                                <option value="5" style={{ background: '#1e293b' }}>Lv.5 永久</option>
                                            </select>
                                            <span style={{ position: 'absolute', right: '12px', pointerEvents: 'none', fontSize: '10px', color: '#94a3b8' }}>▼</span>
                                        </div>
                                    </div>

                                    {/* Right: View Mode Toggle */}
                                    <div style={{ display: 'flex', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '8px', padding: '2px', border: '1px solid #334155' }}>
                                        <button
                                            onClick={() => setViewMode('card')}
                                            title="卡片视图"
                                            style={{
                                                background: viewMode === 'card' ? 'rgba(255,255,255,0.1)' : 'transparent',
                                                border: 'none',
                                                borderRadius: '6px',
                                                padding: '4px 8px',
                                                cursor: 'pointer',
                                                fontSize: '16px',
                                                color: viewMode === 'card' ? '#fff' : '#64748b'
                                            }}
                                        >🗂️</button>
                                        <button
                                            onClick={() => setViewMode('compact')}
                                            title="紧凑视图"
                                            style={{
                                                background: viewMode === 'compact' ? 'rgba(255,255,255,0.1)' : 'transparent',
                                                border: 'none',
                                                borderRadius: '6px',
                                                padding: '4px 8px',
                                                cursor: 'pointer',
                                                fontSize: '16px',
                                                color: viewMode === 'compact' ? '#fff' : '#64748b'
                                            }}
                                        >☰</button>
                                    </div>
                                </div>

                                {displayedWords.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '50px' }}>
                                        <div style={{ fontSize: '48px', marginBottom: '20px' }}>📚</div>
                                        <p>没有找到相关内容</p>
                                    </div>
                                ) : (
                                    <>
                                        {displayedWords.map(word => (
                                            viewMode === 'card' ? (
                                                // Card View
                                                <div key={word.id} className="bento-card" style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                        <div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                                                <h3 style={{ margin: 0, fontSize: '20px', color: '#fff', wordBreak: 'break-word' }}>{word.word}</h3>
                                                                <span style={{
                                                                    fontSize: '10px',
                                                                    padding: '2px 6px',
                                                                    borderRadius: '4px',
                                                                    background: word.type === 'sentence' ? '#8b5cf6' : '#06b6d4',
                                                                    color: '#fff',
                                                                    marginLeft: '8px',
                                                                    verticalAlign: 'middle',
                                                                    flexShrink: 0
                                                                }}>
                                                                    {word.type === 'sentence' ? '句子' : '单词'}
                                                                </span>
                                                                {renderLevelStars(word.masteryLevel)}
                                                                <span style={{ color: '#94a3b8', fontSize: '14px' }}>{word.phonetic}</span>
                                                                <button
                                                                    onClick={(e) => speakWord(word.word, e)}
                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#06b6d4' }}
                                                                >🔊</button>
                                                            </div>
                                                            <p style={{ color: '#cbd5e1', margin: '4px 0' }}>{word.definition}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => handleToggleStar(word.id, word.isStarred)}
                                                            style={{
                                                                background: 'none',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                fontSize: '20px',
                                                                color: word.isStarred ? '#f59e0b' : '#475569',
                                                                marginRight: '10px'
                                                            }}
                                                            title={word.isStarred ? "取消收藏" : "收藏"}
                                                        >
                                                            {word.isStarred ? '★' : '☆'}
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(word.id)}
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, fontSize: '18px' }}
                                                            title="移除"
                                                        >🗑️</button>
                                                    </div>

                                                    {word.context && (word.type !== 'sentence' || word.context.original !== word.word) && (
                                                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px', fontSize: '14px' }}>
                                                            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                                                                {word.source === 'AI Chat' ? '对话原句' : '视频原句'}
                                                            </div>
                                                            <div style={{ color: '#e2e8f0' }}>"{word.context.original}"</div>
                                                            <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '2px' }}>{word.context.translation}</div>
                                                        </div>
                                                    )}

                                                    {word.example && (
                                                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px', fontSize: '14px', marginTop: '4px' }}>
                                                            <div style={{ color: '#e2e8f0', fontStyle: 'italic' }}>Example: {word.example.en}</div>
                                                            <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '2px' }}>{word.example.zh || word.example.cn}</div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                // Compact View
                                                <div key={word.id} style={{
                                                    background: 'rgba(30, 41, 59, 0.5)',
                                                    border: '1px solid #334155',
                                                    borderRadius: '8px',
                                                    padding: '12px 16px',
                                                    marginBottom: '8px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    gap: '10px'
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                                                        <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '16px', whiteSpace: 'nowrap' }}>{word.word}</div>
                                                        {renderLevelStars(word.masteryLevel)}
                                                        <div style={{ color: '#94a3b8', fontSize: '12px', whiteSpace: 'nowrap' }}>{word.phonetic}</div>
                                                        <div style={{ color: '#cbd5e1', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                                                            {word.definition}
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                                                        <button
                                                            onClick={(e) => speakWord(word.word, e)}
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#06b6d4', fontSize: '14px' }}
                                                        >🔊</button>
                                                        <button
                                                            onClick={() => handleToggleStar(word.id, word.isStarred)}
                                                            style={{
                                                                background: 'none',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                fontSize: '18px',
                                                                color: word.isStarred ? '#f59e0b' : '#475569'
                                                            }}
                                                            title={word.isStarred ? "取消收藏" : "收藏"}
                                                        >
                                                            {word.isStarred ? '★' : '☆'}
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(word.id)}
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, fontSize: '14px' }}
                                                            title="移除"
                                                        >🗑️</button>
                                                    </div>
                                                </div>
                                            )
                                        ))}

                                        {hasMore && (
                                            <div style={{ textAlign: 'center', marginTop: '20px' }}>
                                                <button
                                                    onClick={handleLoadMore}
                                                    style={{
                                                        background: 'rgba(255,255,255,0.1)',
                                                        border: '1px solid #334155',
                                                        color: '#fff',
                                                        padding: '10px 30px',
                                                        borderRadius: '20px',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseOver={e => e.target.style.background = 'rgba(255,255,255,0.2)'}
                                                    onMouseOut={e => e.target.style.background = 'rgba(255,255,255,0.1)'}
                                                >
                                                    加载更多 ({allFilteredWords.length - displayedWords.length})
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        {activeTab === 'flashcard' && (
                            <div className="flashcard-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
                                <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
                                    <button
                                        onClick={() => setReviewMode('due')}
                                        style={{
                                            padding: '6px 16px',
                                            borderRadius: '20px',
                                            border: '1px solid #334155',
                                            background: reviewMode === 'due' ? '#10b981' : 'rgba(30, 41, 59, 0.5)',
                                            color: '#fff',
                                            cursor: 'pointer'
                                        }}
                                    >复习到期 ({words.filter(w => {
                                        if (!w.nextReview) return true
                                        const reviewDate = w.nextReview.toDate ? w.nextReview.toDate() : new Date(w.nextReview)
                                        return reviewDate <= new Date()
                                    }).length})</button>
                                    <button
                                        onClick={() => setReviewMode('all')}
                                        style={{
                                            padding: '6px 16px',
                                            borderRadius: '20px',
                                            border: '1px solid #334155',
                                            background: reviewMode === 'all' ? '#f59e0b' : 'rgba(30, 41, 59, 0.5)',
                                            color: '#fff',
                                            cursor: 'pointer'
                                        }}
                                    >随机复习</button>
                                </div>

                                {reviewQueue.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '50px' }}>
                                        <div style={{ fontSize: '48px', marginBottom: '20px' }}>🎉</div>
                                        <p>当前没有需要复习的单词</p>
                                        <p style={{ fontSize: '14px', marginTop: '10px' }}>去添加新词或者试试“随机复习”模式吧</p>
                                    </div>
                                ) : (
                                    <div style={{ width: '100%', maxWidth: '400px', perspective: '1000px' }}>
                                        <div
                                            className="flashcard"
                                            onClick={() => setIsFlipped(!isFlipped)}
                                            style={{
                                                position: 'relative',
                                                width: '100%',
                                                minHeight: '300px',
                                                height: '60vh', // Fixed height for 3D container
                                                transformStyle: 'preserve-3d',
                                                transition: 'transform 0.6s',
                                                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                                                cursor: 'pointer',
                                                borderRadius: '16px',
                                                boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                                            }}
                                        >
                                            {/* Front */}
                                            <div style={{
                                                position: 'absolute', width: '100%', height: '100%',
                                                backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                                                background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                                padding: '20px', borderRadius: '16px', border: '1px solid #334155',
                                                zIndex: isFlipped ? 0 : 1,
                                                overflowY: 'auto' // Move scroll here
                                            }}>
                                                <h2 style={{ fontSize: '32px', color: '#fff', textAlign: 'center', marginBottom: '10px' }}>
                                                    {reviewQueue[currentCardIndex].word}
                                                </h2>
                                                <div style={{ color: '#94a3b8', fontSize: '18px' }}>
                                                    {reviewQueue[currentCardIndex].phonetic}
                                                </div>
                                                <div style={{ marginTop: '20px', color: '#64748b', fontSize: '14px' }}>点击查看释义</div>
                                            </div>

                                            {/* Back */}
                                            <div style={{
                                                position: 'absolute', width: '100%', height: '100%',
                                                backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                                                background: 'linear-gradient(135deg, #334155, #1e293b)',
                                                transform: 'rotateY(180deg)',
                                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                                padding: '20px', borderRadius: '16px', border: '1px solid #475569',
                                                zIndex: isFlipped ? 1 : 0,
                                                overflowY: 'auto' // Move scroll here
                                            }}>
                                                <h3 style={{ color: '#38bdf8', marginBottom: '10px' }}>{reviewQueue[currentCardIndex].definition}</h3>

                                                {/* Context Sentence (Conditional) */}
                                                {reviewQueue[currentCardIndex].context &&
                                                    (reviewQueue[currentCardIndex].type !== 'sentence' || reviewQueue[currentCardIndex].context.original !== reviewQueue[currentCardIndex].word) && (
                                                        <div style={{ marginTop: '15px', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', width: '100%', fontSize: '14px' }}>
                                                            <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>
                                                                {reviewQueue[currentCardIndex].source === 'AI Chat' ? '对话原句' : '视频原句'}
                                                            </div>
                                                            <div style={{ color: '#e2e8f0', fontStyle: 'italic' }}>"{reviewQueue[currentCardIndex].context.original}"</div>
                                                            <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '2px' }}>{reviewQueue[currentCardIndex].context.translation}</div>
                                                        </div>
                                                    )}

                                                {reviewQueue[currentCardIndex].example && (
                                                    <div style={{ marginTop: '10px', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', width: '100%', fontSize: '14px' }}>
                                                        <div style={{ color: '#e2e8f0' }}>{reviewQueue[currentCardIndex].example.en}</div>
                                                        <div style={{ color: '#94a3b8', fontSize: '12px' }}>{reviewQueue[currentCardIndex].example.zh || reviewQueue[currentCardIndex].example.cn}</div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {isFlipped && (
                                            <div style={{ display: 'flex', gap: '20px', marginTop: '30px', justifyContent: 'center' }}>
                                                <button
                                                    onClick={() => handleMasteryUpdate(false)}
                                                    style={{
                                                        padding: '12px 30px', borderRadius: '12px', border: 'none',
                                                        background: '#ef4444', color: '#fff', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer',
                                                        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)'
                                                    }}
                                                >忘记了</button>
                                                <button
                                                    onClick={() => handleMasteryUpdate(true)}
                                                    style={{
                                                        padding: '12px 30px', borderRadius: '12px', border: 'none',
                                                        background: '#10b981', color: '#fff', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer',
                                                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)'
                                                    }}
                                                >记住了</button>
                                            </div>
                                        )}
                                        <div style={{ textAlign: 'center', marginTop: '20px', color: '#94a3b8' }}>
                                            进度: {currentCardIndex + 1} / {reviewQueue.length}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Clear Confirmation Modal */}
            {showClearModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)', zIndex: 200,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backdropFilter: 'blur(5px)'
                }} onClick={() => setShowClearModal(false)}>
                    <div style={{
                        background: '#0f172a',
                        border: '1px solid #ef4444',
                        borderRadius: '16px',
                        padding: '30px',
                        maxWidth: '400px',
                        width: '90%',
                        color: '#fff',
                        boxShadow: '0 0 50px rgba(239, 68, 68, 0.2)',
                        textAlign: 'center'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
                        <h2 style={{ color: '#ef4444', marginTop: 0 }}>危险操作</h2>
                        <p style={{ color: '#cbd5e1', marginBottom: '30px' }}>
                            确定要清空所有生词吗？<br />
                            此操作<strong style={{ color: '#fff' }}>不可恢复</strong>，所有学习进度都将丢失。
                        </p>
                        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                            <button
                                onClick={() => setShowClearModal(false)}
                                style={{
                                    padding: '10px 24px',
                                    borderRadius: '8px',
                                    border: '1px solid #475569',
                                    background: 'transparent',
                                    color: '#cbd5e1',
                                    cursor: 'pointer'
                                }}
                            >取消</button>
                            <button
                                onClick={confirmClearAll}
                                style={{
                                    padding: '10px 24px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: '#ef4444',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)'
                                }}
                            >确认清空</button>
                        </div>
                    </div>
                </div>
            )}

            {showStats && <VocabularyStats words={words} onClose={() => setShowStats(false)} />}

            {showRules && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)', zIndex: 200,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backdropFilter: 'blur(5px)'
                }} onClick={() => setShowRules(false)}>
                    <div style={{
                        background: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '16px',
                        padding: '30px',
                        maxWidth: '500px',
                        width: '90%',
                        color: '#fff',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                        position: 'relative'
                    }} onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setShowRules(false)}
                            style={{
                                position: 'absolute', top: '15px', right: '15px',
                                background: 'none', border: 'none',
                                color: '#94a3b8', fontSize: '20px', cursor: 'pointer'
                            }}
                        >×</button>
                        <h2 style={{ marginTop: 0, color: '#38bdf8' }}>艾宾浩斯复习规则</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '10px' }}>
                                <span>Lv.1 陌生</span>
                                <span style={{ color: '#94a3b8' }}>1 天后复习</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '10px' }}>
                                <span>Lv.2 认识</span>
                                <span style={{ color: '#94a3b8' }}>3 天后复习</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '10px' }}>
                                <span>Lv.3 熟悉</span>
                                <span style={{ color: '#94a3b8' }}>7 天后复习</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '10px' }}>
                                <span>Lv.4 牢记</span>
                                <span style={{ color: '#94a3b8' }}>15 天后复习</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px' }}>
                                <span>Lv.5 掌握</span>
                                <span style={{ color: '#10b981' }}>30 天后复习</span>
                            </div>
                        </div>
                        <p style={{ marginTop: '20px', color: '#64748b', fontSize: '14px' }}>
                            * 每次复习选择“记住了”会提升等级，选择“忘记了”会重置为 Lv.1
                        </p>
                    </div>
                </div>
            )}

            <Toast message={toastMsg} type={toastType} onClose={dismissNotice} />
        </section>
    )
}
