import React, { useMemo, useState } from 'react'

export default function VocabularyStats({ words, onClose }) {
    const [activeTab, setActiveTab] = useState('forecast') // 'forecast' | 'mastery'

    // Calculate forecast data
    const chartData = useMemo(() => {
        const days = []
        const now = new Date()
        now.setHours(0, 0, 0, 0)

        // Initialize next 7 days
        for (let i = 0; i < 7; i++) {
            const date = new Date(now)
            date.setDate(now.getDate() + i)
            days.push({
                date: date,
                label: i === 0 ? '今天' : date.toLocaleDateString('zh-CN', { weekday: 'short' }).replace('周', '周'),
                count: 0
            })
        }

        // Count words
        words.forEach(word => {
            if (!word.nextReview) {
                // New words (no nextReview) count as Today (due immediately)
                days[0].count++
                return
            }

            const reviewDate = word.nextReview.toDate ? word.nextReview.toDate() : new Date(word.nextReview)
            reviewDate.setHours(0, 0, 0, 0)

            // If due in the past or today, count as Today
            if (reviewDate <= now) {
                days[0].count++
            } else {
                // Check if it falls in the next 6 days
                const diffTime = Math.abs(reviewDate - now)
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                if (diffDays < 7) {
                    days[diffDays].count++
                }
            }
        })

        return days
    }, [words])

    // Calculate mastery distribution
    const masteryData = useMemo(() => {
        const distribution = [
            { level: 0, label: '新词 (Lv.0)', count: 0, color: '#94a3b8' },
            { level: '1-2', label: '学习中 (Lv.1-2)', count: 0, color: '#3b82f6' },
            { level: '3-4', label: '熟练 (Lv.3-4)', count: 0, color: '#8b5cf6' },
            { level: 5, label: '已掌握 (Lv.5)', count: 0, color: '#10b981' }
        ]

        words.forEach(word => {
            const level = word.masteryLevel || 0
            if (level === 0) distribution[0].count++
            else if (level <= 2) distribution[1].count++
            else if (level <= 4) distribution[2].count++
            else distribution[3].count++
        })

        return distribution
    }, [words])

    const maxCount = Math.max(...chartData.map(d => d.count), 1) // Avoid divide by zero

    // Calculate conic gradient for donut chart
    const getConicGradient = () => {
        let currentAngle = 0
        const total = words.length || 1
        const gradients = masteryData.map(d => {
            const angle = (d.count / total) * 360
            const start = currentAngle
            const end = currentAngle + angle
            currentAngle = end
            return `${d.color} ${start}deg ${end}deg`
        })
        return `conic-gradient(${gradients.join(', ')})`
    }

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.8)', zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(5px)'
        }} onClick={onClose}>
            <div style={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '16px',
                padding: '30px',
                maxWidth: '600px',
                width: '90%',
                color: '#fff',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                minHeight: '400px'
            }} onClick={e => e.stopPropagation()}>
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute', top: '15px', right: '15px',
                        background: 'none', border: 'none',
                        color: '#94a3b8', fontSize: '20px', cursor: 'pointer', zIndex: 10
                    }}
                >×</button>

                <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
                    <h2
                        onClick={() => setActiveTab('forecast')}
                        style={{
                            marginTop: 0, marginBottom: 0,
                            color: activeTab === 'forecast' ? '#38bdf8' : '#64748b',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '10px',
                            borderBottom: activeTab === 'forecast' ? '2px solid #38bdf8' : 'none',
                            paddingBottom: '5px'
                        }}>
                        📊 复习预测
                    </h2>
                    <h2
                        onClick={() => setActiveTab('mastery')}
                        style={{
                            marginTop: 0, marginBottom: 0,
                            color: activeTab === 'mastery' ? '#10b981' : '#64748b',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '10px',
                            borderBottom: activeTab === 'mastery' ? '2px solid #10b981' : 'none',
                            paddingBottom: '5px'
                        }}>
                        🍩 掌握分布
                    </h2>
                </div>

                {activeTab === 'forecast' ? (
                    <>
                        <div style={{
                            display: 'flex',
                            alignItems: 'flex-end',
                            justifyContent: 'space-between',
                            height: '200px',
                            paddingBottom: '30px',
                            borderBottom: '1px solid #334155',
                            position: 'relative',
                            marginTop: '20px'
                        }}>
                            {/* Y-axis lines */}
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, borderTop: '1px dashed rgba(255,255,255,0.1)' }}></div>
                            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderTop: '1px dashed rgba(255,255,255,0.1)' }}></div>

                            {chartData.map((day, index) => {
                                const heightPercent = (day.count / maxCount) * 100
                                const isToday = index === 0
                                return (
                                    <div key={index} style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        flex: 1,
                                        height: '100%',
                                        justifyContent: 'flex-end',
                                        position: 'relative'
                                    }}>
                                        {/* Bar */}
                                        <div style={{
                                            width: '60%',
                                            height: `${heightPercent}%`,
                                            background: isToday ? 'linear-gradient(to top, #3b82f6, #60a5fa)' : 'linear-gradient(to top, #475569, #94a3b8)',
                                            borderRadius: '4px 4px 0 0',
                                            transition: 'height 0.5s ease-out',
                                            minHeight: day.count > 0 ? '4px' : '0',
                                            position: 'relative',
                                            boxShadow: isToday ? '0 0 15px rgba(59, 130, 246, 0.5)' : 'none'
                                        }}>
                                            {/* Tooltip / Value */}
                                            <div style={{
                                                position: 'absolute',
                                                top: '-25px',
                                                left: '50%',
                                                transform: 'translateX(-50%)',
                                                color: isToday ? '#60a5fa' : '#cbd5e1',
                                                fontSize: '12px',
                                                fontWeight: 'bold'
                                            }}>
                                                {day.count > 0 ? day.count : ''}
                                            </div>
                                        </div>
                                        {/* Label */}
                                        <div style={{
                                            marginTop: '10px',
                                            fontSize: '12px',
                                            color: isToday ? '#fff' : '#94a3b8',
                                            fontWeight: isToday ? 'bold' : 'normal'
                                        }}>
                                            {day.label}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        <div style={{ marginTop: '20px', fontSize: '14px', color: '#94a3b8', textAlign: 'center' }}>
                            未来 7 天需复习总数: <strong style={{ color: '#fff' }}>{chartData.reduce((a, b) => a + b.count, 0)}</strong>
                        </div>
                    </>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '40px', marginTop: '20px' }}>
                        {/* Donut Chart */}
                        <div style={{
                            width: '200px',
                            height: '200px',
                            borderRadius: '50%',
                            background: getConicGradient(),
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 0 30px rgba(0,0,0,0.3)'
                        }}>
                            {/* Inner Circle */}
                            <div style={{
                                width: '140px',
                                height: '140px',
                                borderRadius: '50%',
                                background: '#1e293b',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff'
                            }}>
                                <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{words.length}</div>
                                <div style={{ fontSize: '12px', color: '#94a3b8' }}>总词汇量</div>
                            </div>
                        </div>

                        {/* Legend */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {masteryData.map((item, index) => (
                                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: item.color }}></div>
                                    <div style={{ fontSize: '14px', color: '#cbd5e1', width: '100px' }}>{item.label}</div>
                                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>{item.count}</div>
                                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                                        {words.length > 0 ? Math.round((item.count / words.length) * 100) : 0}%
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
