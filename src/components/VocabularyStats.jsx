import React, { useMemo, useState, useRef } from 'react'
import html2canvas from 'html2canvas'

export default function VocabularyStats({ words, onClose }) {
    const [activeTab, setActiveTab] = useState('forecast') // 'forecast' | 'mastery' | 'activity'
    const [showSharePreview, setShowSharePreview] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const shareCardRef = useRef(null)

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

    // Calculate activity heatmap data (last 20 weeks, GitHub style)
    const activityData = useMemo(() => {
        const weeks = 20
        const totalDays = weeks * 7
        const data = []
        const now = new Date()
        now.setHours(0, 0, 0, 0)

        // Align start date to the Monday of 20 weeks ago
        // 1. Find current day of week (0=Sun, 1=Mon... 6=Sat)
        // 2. We want the grid to end on Today (or close to it), but aligned to weeks.
        // GitHub heatmap usually ends on the current day, but fills columns.
        // Let's make the last column contain Today.
        // So we go back 19 weeks + current week days.
        // Actually, simpler: Just go back exactly 20 weeks from the *coming Sunday*?
        // Let's align to Monday for the start.

        // Find the most recent Sunday (end of a week)
        const dayOfWeek = now.getDay() // 0-6
        const daysSinceSunday = dayOfWeek // 0 if Sunday, 1 if Mon...
        // We want to end on Today.
        // But to make the grid nice, let's fill 20 full columns (140 days).
        // So start date = Today - 139 days?
        // If we do that, Day 1 might be a Wednesday. Then Row 1 is Wed.
        // We want Row 1 to be Sunday (or Monday).
        // Let's say Row 1 is Monday.
        // So Start Date must be a Monday.

        // Find the Monday that is >= 140 days ago.
        const endDate = new Date(now)
        // Adjust endDate to be the coming Sunday (so we have full columns)?
        // Or just let the last column be partial.
        // Let's let the last column be partial (GitHub style).
        // So we need to find the Monday of the week 20 weeks ago.

        // Current week's Monday:
        const currentMonday = new Date(now)
        const distToMon = (dayOfWeek + 6) % 7 // Mon=0, Tue=1, ... Sun=6
        currentMonday.setDate(now.getDate() - distToMon)

        // Start date = Current Monday - 19 weeks
        const startDate = new Date(currentMonday)
        startDate.setDate(currentMonday.getDate() - (19 * 7))

        // Now generate 20 weeks * 7 days = 140 days starting from startDate
        // This ensures Day 0 is a Monday.

        // Create map of date -> count
        const dateCountMap = {}
        words.forEach(word => {
            if (word.createdAt) {
                const date = word.createdAt.toDate ? word.createdAt.toDate() : new Date(word.createdAt)
                const dateStr = date.toDateString()
                dateCountMap[dateStr] = (dateCountMap[dateStr] || 0) + 1
            }
        })

        for (let i = 0; i < totalDays; i++) {
            const date = new Date(startDate)
            date.setDate(startDate.getDate() + i)
            const dateStr = date.toDateString()
            const count = dateCountMap[dateStr] || 0

            // Determine intensity (0-4)
            let intensity = 0
            if (count > 0) intensity = 1
            if (count > 2) intensity = 2
            if (count > 5) intensity = 3
            if (count > 10) intensity = 4

            data.push({
                date: date,
                count: count,
                intensity: intensity,
                dateLabel: date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
                isFuture: date > now // Mark future days as empty/invisible
            })
        }

        return data
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

    const getIntensityColor = (intensity, isFuture) => {
        if (isFuture) return 'transparent'
        switch (intensity) {
            case 0: return '#1e293b' // Dark (empty)
            case 1: return '#064e3b' // Very dark green
            case 2: return '#065f46' // Dark green
            case 3: return '#10b981' // Green
            case 4: return '#34d399' // Bright green
            default: return '#1e293b'
        }
    }

    const handleShareClick = () => {
        setShowSharePreview(true)
    }

    const handleDownload = async () => {
        if (!shareCardRef.current) return
        setIsGenerating(true)
        try {
            const canvas = await html2canvas(shareCardRef.current, {
                backgroundColor: '#0f172a',
                scale: 2 // High resolution
            })
            const link = document.createElement('a')
            link.download = `speakduck-stats-${new Date().toISOString().slice(0, 10)}.png`
            link.href = canvas.toDataURL('image/png')
            link.click()
            setShowSharePreview(false) // Close after download
        } catch (error) {
            console.error('Failed to generate image:', error)
            alert('生成图片失败，请重试')
        } finally {
            setIsGenerating(false)
        }
    }

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.8)', zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(5px)'
        }} onClick={onClose}>

            {/* Main Stats Modal */}
            {!showSharePreview && (
                <div style={{
                    background: '#0f172a',
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
                    minHeight: '450px'
                }} onClick={e => e.stopPropagation()}>
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        style={{
                            position: 'absolute', top: '15px', right: '15px',
                            background: 'none', border: 'none',
                            color: '#94a3b8', fontSize: '20px', cursor: 'pointer', zIndex: 10
                        }}
                    >×</button>

                    {/* Share Button */}
                    <button
                        onClick={handleShareClick}
                        style={{
                            position: 'absolute', top: '15px', right: '50px',
                            background: 'none', border: '1px solid #334155', borderRadius: '8px',
                            color: '#38bdf8', fontSize: '14px', cursor: 'pointer', zIndex: 10,
                            padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '5px'
                        }}
                    >
                        📷 分享
                    </button>

                    <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', overflowX: 'auto', paddingBottom: '5px' }}>
                        <h2
                            onClick={() => setActiveTab('forecast')}
                            style={{
                                marginTop: 0, marginBottom: 0,
                                color: activeTab === 'forecast' ? '#38bdf8' : '#64748b',
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '8px',
                                borderBottom: activeTab === 'forecast' ? '2px solid #38bdf8' : 'none',
                                paddingBottom: '5px',
                                fontSize: '18px',
                                whiteSpace: 'nowrap'
                            }}>
                            📊 预测
                        </h2>
                        <h2
                            onClick={() => setActiveTab('mastery')}
                            style={{
                                marginTop: 0, marginBottom: 0,
                                color: activeTab === 'mastery' ? '#8b5cf6' : '#64748b',
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '8px',
                                borderBottom: activeTab === 'mastery' ? '2px solid #8b5cf6' : 'none',
                                paddingBottom: '5px',
                                fontSize: '18px',
                                whiteSpace: 'nowrap'
                            }}>
                            🍩 分布
                        </h2>
                        <h2
                            onClick={() => setActiveTab('activity')}
                            style={{
                                marginTop: 0, marginBottom: 0,
                                color: activeTab === 'activity' ? '#10b981' : '#64748b',
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '8px',
                                borderBottom: activeTab === 'activity' ? '2px solid #10b981' : 'none',
                                paddingBottom: '5px',
                                fontSize: '18px',
                                whiteSpace: 'nowrap'
                            }}>
                            📅 热力
                        </h2>
                    </div>

                    {activeTab === 'forecast' && (
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
                    )}

                    {activeTab === 'mastery' && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '40px', marginTop: '20px', flexWrap: 'wrap' }}>
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
                                    background: '#0f172a',
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

                    {activeTab === 'activity' && (
                        <div style={{ marginTop: '10px' }}>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(20, 1fr)', // 20 weeks
                                gridTemplateRows: 'repeat(7, 1fr)', // 7 days
                                gridAutoFlow: 'column', // Fill columns first (GitHub style)
                                gap: '4px',
                                justifyContent: 'center',
                                height: '140px' // Fixed height for grid
                            }}>
                                {activityData.map((day, index) => (
                                    <div
                                        key={index}
                                        title={`${day.dateLabel}: ${day.count} 个单词`}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            background: getIntensityColor(day.intensity, day.isFuture),
                                            borderRadius: '2px',
                                            cursor: day.isFuture ? 'default' : 'pointer',
                                            opacity: day.isFuture ? 0 : 1
                                        }}
                                    >
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '5px', marginTop: '15px', fontSize: '12px', color: '#94a3b8' }}>
                                <span>少</span>
                                <div style={{ width: '10px', height: '10px', background: '#1e293b', borderRadius: '2px' }}></div>
                                <div style={{ width: '10px', height: '10px', background: '#064e3b', borderRadius: '2px' }}></div>
                                <div style={{ width: '10px', height: '10px', background: '#065f46', borderRadius: '2px' }}></div>
                                <div style={{ width: '10px', height: '10px', background: '#10b981', borderRadius: '2px' }}></div>
                                <div style={{ width: '10px', height: '10px', background: '#34d399', borderRadius: '2px' }}></div>
                                <span>多</span>
                            </div>
                            <p style={{ textAlign: 'center', color: '#64748b', fontSize: '12px', marginTop: '20px' }}>
                                展示最近 20 周的学习活跃度 (GitHub 风格)
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Share Preview Modal */}
            {showSharePreview && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.9)', zIndex: 210,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                }} onClick={() => setShowSharePreview(false)}>

                    {/* The Card (Visible for Preview) */}
                    <div
                        ref={shareCardRef}
                        style={{
                            width: '375px', // Mobile width
                            height: '667px', // Mobile height
                            background: '#0f172a',
                            padding: '30px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontFamily: 'sans-serif',
                            color: '#fff',
                            backgroundImage: 'radial-gradient(circle at 50% 0%, #1e293b 0%, #0f172a 70%)',
                            boxShadow: '0 0 50px rgba(0,0,0,0.5)',
                            transform: 'scale(0.8)', // Scale down slightly for desktop view
                            transformOrigin: 'center center'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div style={{ textAlign: 'center', width: '100%' }}>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#38bdf8', marginBottom: '10px' }}>
                                SpeakDuck
                            </div>
                            <div style={{ fontSize: '14px', color: '#94a3b8', letterSpacing: '2px' }}>
                                MY VOCABULARY JOURNEY
                            </div>
                            <div style={{ width: '50px', height: '2px', background: '#38bdf8', margin: '20px auto' }}></div>
                        </div>

                        {/* Main Stats */}
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '12px' }}>
                                <div style={{ fontSize: '14px', color: '#cbd5e1' }}>总词汇量</div>
                                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#fff' }}>{words.length}</div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '12px' }}>
                                <div style={{ fontSize: '14px', color: '#cbd5e1' }}>已掌握 (Lv.5)</div>
                                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#10b981' }}>
                                    {masteryData.find(d => d.level === 5)?.count || 0}
                                </div>
                            </div>
                        </div>

                        {/* Mini Heatmap (Last 10 weeks) */}
                        <div style={{ width: '100%' }}>
                            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '10px', textAlign: 'center' }}>
                                最近学习热力
                            </div>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(10, 1fr)', // 10 weeks
                                gridTemplateRows: 'repeat(7, 1fr)', // 7 days
                                gridAutoFlow: 'column',
                                gap: '4px',
                                justifyContent: 'center',
                                height: '140px'
                            }}>
                                {activityData.slice(-70).map((day, index) => ( // Show last 70 days (10 weeks)
                                    <div
                                        key={index}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            background: getIntensityColor(day.intensity, day.isFuture),
                                            borderRadius: '2px',
                                            opacity: day.isFuture ? 0 : 1
                                        }}
                                    >
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{ textAlign: 'center', width: '100%' }}>

                            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', marginTop: '5px' }}>
                                SpeakDuck 英语跟读
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
                        <button
                            onClick={() => setShowSharePreview(false)}
                            style={{
                                padding: '10px 24px',
                                borderRadius: '8px',
                                border: '1px solid #475569',
                                background: 'transparent',
                                color: '#cbd5e1',
                                cursor: 'pointer',
                                fontSize: '16px'
                            }}
                        >取消</button>
                        <button
                            onClick={handleDownload}
                            disabled={isGenerating}
                            style={{
                                padding: '10px 24px',
                                borderRadius: '8px',
                                border: 'none',
                                background: '#38bdf8',
                                color: '#fff',
                                cursor: 'pointer',
                                fontSize: '16px',
                                fontWeight: 'bold',
                                boxShadow: '0 4px 12px rgba(56, 189, 248, 0.4)'
                            }}
                        >
                            {isGenerating ? '生成中...' : '保存图片'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
