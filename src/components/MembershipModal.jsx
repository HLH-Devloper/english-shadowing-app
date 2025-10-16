import React from 'react'

export default function MembershipModal({ isOpen, onClose }) {
  if (!isOpen) return null
  const xhsUrl = 'https://www.xiaohongshu.com/search/result?keyword=%E8%B7%9F%E8%AF%BB%E9%B8%AD%20%E8%8B%B1%E8%AF%AD%E5%8F%A3%E8%AF%AD%E5%AD%A6%E4%B9%A0'
  const handleBackdropClick = (e) => {
    if (e.target.classList.contains('app-modal-backdrop')) onClose?.()
  }
  return (
    <div className="app-modal-backdrop" role="dialog" aria-modal="true" aria-label="会员开通引导" onClick={handleBackdropClick}>
      <div className="app-modal" style={{ maxWidth: 520 }}>
        <div className="app-modal-title">💎 会员即将上线，敬请期待</div>
        <div className="app-modal-message" style={{ whiteSpace: 'pre-line' }}>
{`我们正在为您打磨更强大的学习体验：
✅ 无限制视频观看
✅ 专属学习内容
✅ 高级发音评分
✅ 离线下载功能

现在可抢先了解并获得上线提醒：
👉 在小红书搜索「跟读鸭（英语口语学习）」
👉 关注获取最新上线通知和早期优惠`}
        </div>
        <div className="app-modal-actions">
          <a className="link-btn" href="/register" style={{ marginRight: 'auto' }}>我有兑换码</a>
          <button className="secondary-btn" onClick={onClose}>好的，期待！</button>
          <a className="primary-btn" href={xhsUrl} target="_blank" rel="noreferrer">去小红书关注</a>
        </div>
      </div>
    </div>
  )
}