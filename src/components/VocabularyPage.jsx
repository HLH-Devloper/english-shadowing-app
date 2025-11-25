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
    const [filterType, setFilterType] = useState('all') // all | word | sentence
    const [showRules, setShowRules] = useState(false)
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

    const handleClearAll = async () => {
        if (!currentUser) return
        if (!window.confirm('确定要清空所有生词吗？此操作不可恢复！')) return
        try {
            await VocabularyService.clearVocabulary(currentUser.uid)
            setWords([])
            showNotice('生词本已清空', 'success')
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
    }, [activeTab, reviewMode]) // words is in closure, but adding it to deps might cause loops if not careful. words only changes on load/delete/update. update changes words, which triggers this.
    // If update changes words, we might reset the queue mid-review if we include words in deps.
    // Actually, we WANT to update the queue if a word is updated (e.g. mastery level changes).
    // BUT, if we reset the queue, we lose progress?
    // No, `loadWords` sets `words`. `handleMasteryUpdate` sets `words`.
    // If `handleMasteryUpdate` runs, `words` changes. `useEffect` runs. `reviewQueue` is re-calculated. `currentCardIndex` resets to 0.
    // THIS IS BAD. We shouldn't reset `currentCardIndex` when `words` updates during a review session.
    // The previous code didn't have `words` in deps. It only ran on `activeTab` change.
    // So `reviewQueue` was static during the session.
    // I should keep it that way. `reviewQueue` is initialized when entering the tab or changing mode.
    // So I will NOT include `words` in deps.


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

    const filteredWords = words.filter(w => {
        if (filterType === 'all') return true
        const type = w.type || 'word'
        return type === filterType
    })

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
                            style={{ background: 'none', border: '1px solid rgba(239, 68, 68, 0.5)', borderRadius: '4px', padding: '2px 8px', color: '#ef4444', cursor: 'pointer', fontSize: '12px' }}
                        >清空</button>
                    )}
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
                                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
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
                                </div>

                                {filteredWords.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '50px' }}>
                                        <div style={{ fontSize: '48px', marginBottom: '20px' }}>📚</div>
                                        <p>没有找到相关内容</p>
                                    </div>
                                ) : (
                                    filteredWords.map(word => (
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
                                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                                    <button
                                        onClick={() => setReviewMode('due')}
                                        style={{
                                            padding: '6px 16px',
                                            borderRadius: '20px',
                                            border: '1px solid #334155',
                                            background: reviewMode === 'due' ? '#3b82f6' : 'rgba(30, 41, 59, 0.5)',
                                            color: '#fff',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >智能复习</button>
                                    <button
                                        onClick={() => setReviewMode('all')}
                                        style={{
                                            padding: '6px 16px',
                                            borderRadius: '20px',
                                            border: '1px solid #334155',
                                            background: reviewMode === 'all' ? '#06b6d4' : 'rgba(30, 41, 59, 0.5)',
                                            color: '#fff',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >复习全部</button>
                                </div>

                                {reviewQueue.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: '#fff' }}>
                                        {reviewMode === 'due' ? (
                                            <>
                                                <h3>🎉 现在没有需要复习的单词</h3>
                                                <p style={{ color: '#94a3b8', marginBottom: '20px' }}>休息一下，或者...</p>
                                                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                                                    <button className="secondary-btn" onClick={() => setActiveTab('list')}>查看列表</button>
                                                    <button className="primary-btn" onClick={() => setReviewMode('all')}>复习所有 ({words.length})</button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <h3>📚 生词本是空的</h3>
                                                <p style={{ color: '#94a3b8', marginBottom: '20px' }}>快去添加一些生词吧！</p>
                                                <button className="secondary-btn" onClick={() => setActiveTab('list')}>查看列表</button>
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        <div
                                            className="flashcard"
                                            onClick={() => setIsFlipped(!isFlipped)}
                                            style={{
                                                width: '100%',
                                                maxWidth: '400px',
                                                minHeight: '300px',
                                                maxHeight: '60vh',
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
                                            <div style={{
                                                textAlign: 'center',
                                                padding: '20px',
                                                width: '100%',
                                                height: '100%',
                                                overflowY: 'auto',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'center',
                                                alignItems: 'center'
                                            }}>
                                                {!isFlipped ? (
                                                    <>
                                                        <h2 style={{
                                                            fontSize: reviewQueue[currentCardIndex].word.length > 50 ? '18px' : '32px',
                                                            marginBottom: '10px',
                                                            color: '#fff',
                                                            wordBreak: 'break-word',
                                                            lineHeight: 1.4
                                                        }}>
                                                            {reviewQueue[currentCardIndex].word}
                                                        </h2>
                                                        <div style={{ color: '#94a3b8', fontSize: '18px' }}>{reviewQueue[currentCardIndex].phonetic}</div>
                                                        <div style={{ marginTop: '20px', color: '#64748b', fontSize: '14px' }}>(点击翻转)</div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <h3 style={{ color: '#fff', marginBottom: '10px' }}>{reviewQueue[currentCardIndex].definition}</h3>

                                                        {/* Subtitle Context */}
                                                        {reviewQueue[currentCardIndex].context && (reviewQueue[currentCardIndex].type !== 'sentence' || reviewQueue[currentCardIndex].context.original !== reviewQueue[currentCardIndex].word) && (
                                                            <div style={{ marginTop: '15px', width: '100%', padding: '0 10px' }}>
                                                                <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                                                                    {reviewQueue[currentCardIndex].source === 'AI Chat' ? '对话原句' : '视频原句'}
                                                                </div>
                                                                <div style={{ fontStyle: 'italic', color: '#cbd5e1', marginBottom: '4px' }}>
                                                                    "{reviewQueue[currentCardIndex].context.original}"
                                                                </div>
                                                                {reviewQueue[currentCardIndex].context.translation && (
                                                                    <div style={{ fontSize: '14px', color: '#94a3b8' }}>
                                                                        {reviewQueue[currentCardIndex].context.translation}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Dictionary Example */}
                                                        {reviewQueue[currentCardIndex].example && (
                                                            <div style={{ marginTop: '15px', width: '100%', padding: '0 10px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px' }}>
                                                                <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>词典例句</div>
                                                                <div style={{ fontStyle: 'italic', color: '#cbd5e1', marginBottom: '4px' }}>
                                                                    {reviewQueue[currentCardIndex].example.en}
                                                                </div>
                                                                <div style={{ fontSize: '14px', color: '#94a3b8' }}>
                                                                    {reviewQueue[currentCardIndex].example.zh || reviewQueue[currentCardIndex].example.cn}
                                                                </div>
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
            {showRules && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)', zIndex: 200,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backdropFilter: 'blur(5px)'
                }} onClick={() => setShowRules(false)}>
                    <div style={{
                        background: '#1e293b', border: '1px solid #334155', borderRadius: '16px',
                        padding: '30px', maxWidth: '500px', width: '90%', color: '#fff',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                        position: 'relative'
                    }} onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setShowRules(false)}
                            style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
                        >×</button>

                        <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            🧠 记忆法则说明
                        </h2>

                        <p style={{ color: '#cbd5e1', lineHeight: '1.6' }}>
                            我们使用<b>间隔重复系统 (SRS)</b> 来帮助你高效记忆。系统会根据你的掌握程度，智能安排下次复习时间：
                        </p>

                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px', margin: '20px 0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                                <span style={{ color: '#94a3b8' }}>Level 0 (新词)</span>
                                <span style={{ color: '#fff' }}>立即复习</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                                <span style={{ color: '#94a3b8' }}>Level 1 (初识)</span>
                                <span style={{ color: '#fff' }}>1天后</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                                <span style={{ color: '#94a3b8' }}>Level 2 (熟悉)</span>
                                <span style={{ color: '#fff' }}>3天后</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                                <span style={{ color: '#94a3b8' }}>Level 3 (掌握)</span>
                                <span style={{ color: '#fff' }}>7天后</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                                <span style={{ color: '#94a3b8' }}>Level 4 (牢记)</span>
                                <span style={{ color: '#fff' }}>14天后</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                                <span style={{ color: '#94a3b8' }}>Level 5 (永久)</span>
                                <span style={{ color: '#fff' }}>30天后</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', fontSize: '13px', color: '#94a3b8' }}>
                            <div style={{ flex: 1, padding: '10px', border: '1px solid #334155', borderRadius: '8px' }}>
                                <strong style={{ color: '#22c55e', display: 'block', marginBottom: '5px' }}>😎 记住了</strong>
                                等级 +1，复习间隔变长
                            </div>
                            <div style={{ flex: 1, padding: '10px', border: '1px solid #334155', borderRadius: '8px' }}>
                                <strong style={{ color: '#ef4444', display: 'block', marginBottom: '5px' }}>😵 模糊</strong>
                                等级 -1，复习间隔变短
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <Toast message={toastMsg} type={toastType} onClose={dismissNotice} />
        </section >
    )
}
