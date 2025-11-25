import React, { useMemo } from 'react'

export default function VocabularyStats({ words, onClose }) {
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

    const maxCount = Math.max(...chartData.map(d => d.count), 1) // Avoid divide by zero

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
                flexDirection: 'column'
            }} onClick={e => e.stopPropagation()}>
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute', top: '15px', right: '15px',
                        background: 'none', border: 'none',
                        color: '#94a3b8', fontSize: '20px', cursor: 'pointer'
                    }}
                >×</button>

                <h2 style={{ marginTop: 0, marginBottom: '30px', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    📊 复习预测
                </h2>

                <div style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'space-between',
                    height: '200px',
                    paddingBottom: '30px',
                    borderBottom: '1px solid #334155',
                    position: 'relative'
                }}>
                    {/* Y-axis lines (optional, simplified) */}
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
            </div>
        </div>
    )
}
