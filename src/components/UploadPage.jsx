import React, { useEffect, useRef, useState } from 'react'
import BrandDuck from './BrandDuck'
import { useNavigate } from 'react-router-dom'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth, db } from '../firebase'
import { doc, getDoc } from 'firebase/firestore'
import Toast from './Toast'
import ConfirmDialog from './ConfirmDialog'
import MembershipModal from './MembershipModal'

export default function UploadPage() {
  // 使用本地状态记录上传的文件与是否可开始学习
  const [videoFile, setVideoFile] = useState(null) // 视频文件对象
  const [subtitleFile, setSubtitleFile] = useState(null) // 字幕文件对象
  const [isReady, setIsReady] = useState(false) // 就绪：仅需要视频
  const videoInputRef = useRef(null)
  const subtitleInputRef = useRef(null)
  const navigate = useNavigate()
  // App 内提示
  const [toastMsg, setToastMsg] = useState('')
  const [toastType, setToastType] = useState('info')
  const showNotice = (msg, type = 'info') => { setToastMsg(msg); setToastType(type) }
  const dismissNotice = () => setToastMsg('')
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false)
  const [confirmStartOpen, setConfirmStartOpen] = useState(false)
  const [membershipOpen, setMembershipOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  // 新增：分区选项卡与 TED 链接输入状态（各分区互不影响）
  const [activeTab, setActiveTab] = useState('local') // local | ted | movie
  // 登录用户信息
  const [currentUser, setCurrentUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [tedUrl, setTedUrl] = useState('')
  // 主题下拉已移除：保留页面加载时的默认主题或本地保存主题，由 main.jsx 负责初始化

  // TED：提取嵌入 talkId（官方嵌入用）
  const extractTEDEmbedId = (url) => {
    if (!url) return null
    try {
      const match = String(url).match(/ted\.com\/talks\/([^?/#]+)/)
      return match ? match[1] : null
    } catch {
      return null
    }
  }

  const openTedInPlayer = (urlOrId) => {
    const talkId = (urlOrId && urlOrId.includes('ted.com')) ? extractTEDEmbedId(urlOrId) : urlOrId
    if (!talkId) return
    navigate('/player', { state: { useTedEmbed: true, tedTalkId: talkId } })
  }

  // 超长文件名中间省略，避免撑乱布局
  const truncateMiddle = (str, maxLen = 60) => {
    if (!str || typeof str !== 'string') return ''
    if (str.length <= maxLen) return str
    const keep = Math.max(8, Math.floor((maxLen - 3) / 2))
    return `${str.slice(0, keep)}...${str.slice(-keep)}`
  }

  // 当视频或字幕文件变化时，更新是否可开始学习的状态
  useEffect(() => {
    // 仅视频即可开始学习；字幕在播放器内再提示上传
    setIsReady(Boolean(videoFile))
  }, [videoFile, subtitleFile])

  // 处理视频文件选择
  function handleVideoUpload(event) {
    const file = event?.target?.files?.[0] || null
    setVideoFile(file)
  }

  function handleVideoAreaClick() {
    videoInputRef.current?.click()
  }

  // 处理字幕文件选择
  function handleSubtitleUpload(event) {
    const file = event?.target?.files?.[0] || null
    setSubtitleFile(file)
  }

  function handleSubtitleAreaClick() {
    subtitleInputRef.current?.click()
  }

  // 点击开始学习：通过路由 state 传递文件对象
  function handleStartLearning() {
    if (!videoFile) return
    if (!currentUser) {
      // 未登录：先弹确认，说明试看与建议登录
      setConfirmStartOpen(true)
      return
    }
    navigate('/player', { state: { videoFile: videoFile, subtitleFile: subtitleFile || null } })
  }

  // 监听登录态，并读取 Firestore 用户基本信息
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)
      if (user) {
        try {
          const snap = await getDoc(doc(db, 'users', user.uid))
          setUserProfile(snap.exists() ? snap.data() : null)
        } catch (e) {
          console.warn('读取用户信息失败', e)
        }
      } else {
        setUserProfile(null)
      }
    })
    return () => unsub()
  }, [])

  const confirmLogout = async () => {
    setConfirmLogoutOpen(false)
    try { await signOut(auth); showNotice('👋 已退出登录', 'success') } catch (e) { showNotice('⚠️ 操作失败，请稍后重试', 'error') }
  }

  return (
    <section className="upload-page">
      {/* Neo-Pop Header */}
      <header className="pop-header">
        <div className="pop-brand">
          <div className="pop-logo-img">
            <BrandDuck src="/duck-follow-me.png" fallbackSrc="/duck-follow-me2.png" />
          </div>
          <span className="pop-title">跟读鸭</span>
        </div>

        <div className="pop-actions">
          {currentUser ? (
            <div className="user-badge" onClick={() => setUserMenuOpen(!userMenuOpen)}>
              <span className="user-name">{truncateMiddle(currentUser.email, 20)}</span>
              <span className={`membership-tag ${userProfile?.membership === 'member' ? 'pro' : 'free'}`}>
                {userProfile?.membership === 'member' ? '会员' : '免费'}
              </span>
              {userMenuOpen && (
                <div className="pop-menu">
                  {userProfile?.membership !== 'member' && (
                    <button onClick={() => setMembershipOpen(true)}>💎 开通会员</button>
                  )}
                  <button onClick={() => navigate('/password')}>🔐 账户安全</button>
                  <button onClick={() => setConfirmLogoutOpen(true)}>🚪 退出登录</button>
                </div>
              )}
            </div>
          ) : (
            <button className="primary-btn small" onClick={() => navigate('/register', { state: { mode: 'login' } })}>
              登录 / 注册
            </button>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <div className="pop-hero">
        <h1 className="hero-title">
          英语口语<br />
          <span className="highlight">开口即大神</span>
        </h1>
        <p className="hero-subtitle">
          导入视频跟读，与 AI 实时对话，让你的英语脱口而出。
        </p>
      </div>

      {/* Main Navigation Cards */}
      <div className="pop-grid">
        {/* Local Upload Card */}
        <div className={`pop-card ${activeTab === 'local' ? 'active' : ''}`} onClick={() => setActiveTab('local')}>
          <div className="card-icon">📂</div>
          <div className="card-content">
            <h3>本地上传</h3>
            <p>上传本地视频与字幕文件进行练习</p>
          </div>
        </div>

        {/* AI Talk Card */}
        <div className={`pop-card ${activeTab === 'ai' ? 'active' : ''}`} onClick={() => setActiveTab('ai')}>
          <div className="card-icon">🤖</div>
          <div className="card-content">
            <h3>AI 口语陪练</h3>
            <p>选择话题，与 AI 进行一对一实时对话</p>
          </div>
        </div>

        {/* TED Card (Coming Soon) */}
        <div className={`pop-card ${activeTab === 'ted' ? 'active' : ''}`} onClick={() => setActiveTab('ted')}>
          <div className="card-icon">🎤</div>
          <div className="card-content">
            <h3>TED 演讲</h3>
            <p>跟读经典演讲，学习地道表达 (开发中)</p>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="pop-content-area">
        {activeTab === 'local' && (
          <div className="upload-zone">
            <div className="file-inputs">
              <label className="file-drop-card">
                <input type="file" accept=".mp4,.webm,.mkv" onChange={handleVideoUpload} />
                <div className="drop-icon">🎬</div>
                <div className="drop-text">
                  {videoFile ? videoFile.name : "点击或拖入视频文件"}
                </div>
                {!videoFile && <div className="drop-sub">支持 .mp4, .webm, .mkv</div>}
              </label>

              <label className="file-drop-card">
                <input type="file" accept=".srt,.vtt,.ass" onChange={handleSubtitleUpload} />
                <div className="drop-icon">📝</div>
                <div className="drop-text">
                  {subtitleFile ? subtitleFile.name : "点击或拖入字幕文件"}
                </div>
                {!subtitleFile && <div className="drop-sub">支持 .srt, .vtt (可选)</div>}
              </label>
            </div>

            <button
              className="primary-btn large"
              onClick={handleStartLearning}
              disabled={!isReady}
            >
              开始学习 🚀
            </button>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="ai-modes-grid">
            {[
              { id: 'free', title: 'Free Talk', icon: '☕', desc: '自由对话，聊聊任何你想说的话题' },
              { id: 'daily', title: 'Daily Life', icon: '🏠', desc: '日常生活，讨论天气、食物、爱好等' },
              { id: 'travel', title: 'Travel', icon: '✈️', desc: '旅行场景，问路、预订酒店、机场对话' },
              { id: 'business', title: 'Business', icon: '💼', desc: '职场英语，面试、会议、商务谈判' },
            ].map(topic => (
              <div key={topic.id} className="mode-card" onClick={() => navigate('/conversation', { state: { scenario: topic.title } })}>
                <div className="mode-icon">{topic.icon}</div>
                <div className="mode-info">
                  <h4>{topic.title}</h4>
                  <p>{topic.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {(activeTab === 'ted' || activeTab === 'movie') && (
          <div className="coming-soon-state">
            <div className="lock-icon">🔒</div>
            <h3>功能开发中</h3>
            <p>我们正在努力适配该功能，敬请期待！</p>
          </div>
        )}
      </div>

      {/* Modals */}
      <ConfirmDialog
        isOpen={confirmLogoutOpen}
        title="确认退出登录？"
        message="退出后将无法继续观看会员内容"
        confirmText="退出登录"
        cancelText="取消"
        onConfirm={confirmLogout}
        onCancel={() => setConfirmLogoutOpen(false)}
      />
      <MembershipModal isOpen={membershipOpen} onClose={() => setMembershipOpen(false)} />
      <ConfirmDialog
        isOpen={confirmStartOpen}
        title="开始学习？"
        message="你尚未登录，学习进度将无法保存。"
        confirmText="直接开始"
        cancelText="取消"
        onConfirm={() => { setConfirmStartOpen(false); navigate('/player', { state: { videoFile, subtitleFile: subtitleFile || null } }) }}
        onCancel={() => setConfirmStartOpen(false)}
      />
      <Toast message={toastMsg} type={toastType} onClose={dismissNotice} />
    </section>
  )
}


