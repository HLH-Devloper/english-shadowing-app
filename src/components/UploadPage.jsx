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
    <section className="cyber-page">
      {/* Cyber Header */}
      <header className="cyber-header">
        <div className="cyber-brand">
          <div className="cyber-logo">
            <img src="/duck-follow-me.png" alt="Logo" onError={(e) => e.target.src = '/duck-follow-me2.png'} />
          </div>
          <span className="cyber-brand-text">跟读鸭</span>
        </div>

        <nav className="cyber-nav">
          <div className={`cyber-nav-item ${activeTab === 'movie' ? 'active' : ''}`} onClick={() => setActiveTab('movie')}>影视</div>
          <div className={`cyber-nav-item ${activeTab === 'ted' ? 'active' : ''}`} onClick={() => setActiveTab('ted')}>网络视频</div>
          <div className={`cyber-nav-item ${activeTab === 'local' ? 'active' : ''}`} onClick={() => setActiveTab('local')}>本地</div>
          <div className={`cyber-nav-item ${activeTab === 'ai' ? 'active' : ''}`} onClick={() => setActiveTab('ai')}>AI陪练</div>
        </nav>

        <div className="cyber-actions">
          {currentUser ? (
            <div className="user-badge" onClick={() => setUserMenuOpen(!userMenuOpen)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="cyber-guest">{truncateMiddle(currentUser.email, 12)}</span>
              <div className="cyber-logo" style={{ width: '32px', height: '32px' }}>
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="User" />
              </div>
              {userMenuOpen && (
                <div className="pop-menu" style={{ top: '60px', right: '40px' }}>
                  {userProfile?.membership !== 'member' && (
                    <button onClick={() => setMembershipOpen(true)}>💎 开通会员</button>
                  )}
                  <button onClick={() => navigate('/password')}>🔐 账户安全</button>
                  <button onClick={() => setConfirmLogoutOpen(true)}>🚪 退出登录</button>
                </div>
              )}
            </div>
          ) : (
            <>
              <span className="cyber-guest">游客模式</span>
              <button className="cyber-login-btn" onClick={() => navigate('/register', { state: { mode: 'login' } })}>
                登录
              </button>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <div className="cyber-hero">
        <h1 className="cyber-hero-title">
          你的专属英语陪练
        </h1>
        <p className="cyber-hero-subtitle">
          不再是枯燥的学习工具，导入你最爱的 <span className="highlight">美剧</span> 或 <span className="highlight">TED演讲</span>，配合双语字幕，开启沉浸式跟读之旅。
        </p>
      </div>

      {/* Main Content Area */}
      <div className="cyber-content">
        {activeTab === 'local' && (
          <>
            <div className="bento-grid">
              {/* Feature Card */}
              <div className="bento-card bento-feature">
                <div>
                  <div className="feature-tag">
                    <span>✦</span> AI DRIVEN
                  </div>
                  <h3 className="feature-title">沉浸式双语环境</h3>
                  <p className="feature-desc">系统自动对齐时间轴，智能打分，就像把外教请回家。</p>
                </div>
                <div className="feature-visual">
                  <div style={{ width: '24px', height: '24px', background: '#06b6d4', borderRadius: '50%' }}></div>
                  <div className="progress-bar">
                    <div className="progress-fill"></div>
                  </div>
                  <span style={{ fontSize: '12px', color: '#06b6d4' }}>95%</span>
                </div>
              </div>

              {/* Member Card */}
              <div className={`bento-card bento-member ${userProfile?.membership === 'member' ? 'active-member' : ''}`} style={userProfile?.membership === 'member' ? { background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)', border: '1px solid #475569' } : {}}>
                <div className="member-content">
                  {userProfile?.membership === 'member' ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h3 style={{ margin: 0 }}>尊享会员特权</h3>
                        <span style={{ background: '#fbbf24', color: '#000', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '800' }}>PRO</span>
                      </div>
                      <p style={{ marginBottom: '20px', opacity: 0.9 }}>您已解锁无限时长与 AI 高级纠音权益。</p>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>🚀 无限畅聊</div>
                        <div style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>✨ 精准纠音</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <h3>解锁会员特权</h3>
                      <p>无限时长，AI纠音，多端同步。</p>
                      <button className="member-btn" onClick={() => setMembershipOpen(true)}>
                        立即升级 <span>→</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Upload Video Card */}
              <label className="bento-card bento-upload">
                <input type="file" accept=".mp4,.webm,.mkv" onChange={handleVideoUpload} />
                <div className="upload-icon-circle">
                  📹
                </div>
                <h3 className="upload-title">{videoFile ? videoFile.name : "上传视频文件"}</h3>
                <p className="upload-desc">支持 mp4, webm, mkv 格式</p>
              </label>

              {/* Upload Subtitle Card */}
              <label className="bento-card bento-upload">
                <input type="file" accept=".srt,.vtt,.ass" onChange={handleSubtitleUpload} />
                <div className="upload-icon-circle">
                  📄
                </div>
                <h3 className="upload-title">{subtitleFile ? subtitleFile.name : "上传字幕文件"}</h3>
                <p className="upload-desc">支持 srt, vtt, ass 格式</p>
              </label>
            </div>

            <div className="start-learning-container">
              <button
                className="start-learning-btn"
                onClick={handleStartLearning}
                disabled={!isReady}
              >
                ▶ 开始学习之旅
              </button>
            </div>
          </>
        )}

        {activeTab === 'ai' && (
          <div className="bento-grid">
            {[
              { id: 'free', title: 'Free Talk', icon: '☕', desc: '自由对话，聊聊任何你想说的话题' },
              { id: 'daily', title: 'Daily Life', icon: '🏠', desc: '日常生活，讨论天气、食物、爱好等' },
              { id: 'travel', title: 'Travel', icon: '✈️', desc: '旅行场景，问路、预订酒店、机场对话' },
              { id: 'business', title: 'Business', icon: '💼', desc: '职场英语，面试、会议、商务谈判' },
            ].map(topic => (
              <div key={topic.id} className="bento-card bento-upload" onClick={() => navigate('/conversation', { state: { scenario: topic.title } })}>
                <div className="upload-icon-circle">{topic.icon}</div>
                <h3 className="upload-title">{topic.title}</h3>
                <p className="upload-desc">{topic.desc}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'ted' && (
          <div className="bento-grid">
            <div className="bento-card bento-upload" style={{ cursor: 'default' }}>
              <div className="upload-icon-circle">📺</div>
              <h3 className="upload-title">在线视频跟读</h3>
              <p className="upload-desc">支持 YouTube / TED 链接</p>

              <div style={{ marginTop: '20px', width: '100%' }}>
                <input
                  type="text"
                  placeholder="粘贴 YouTube 或 TED 视频链接..."
                  value={tedUrl}
                  onChange={(e) => setTedUrl(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #475569',
                    background: 'rgba(0,0,0,0.2)',
                    color: '#fff',
                    marginBottom: '12px'
                  }}
                />
                <button
                  className="start-learning-btn"
                  style={{ width: '100%', marginTop: '0' }}
                  onClick={() => {
                    if (!tedUrl) return;
                    // 尝试解析 YouTube
                    const ytReg = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
                    const ytMatch = tedUrl.match(ytReg);
                    const ytId = (ytMatch && ytMatch[2].length === 11) ? ytMatch[2] : null;

                    if (ytId) {
                      navigate('/player', { state: { useYoutubeEmbed: true, youtubeVideoId: ytId } });
                      return;
                    }

                    // 尝试解析 TED
                    openTedInPlayer(tedUrl);
                  }}
                >
                  开始跟读
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'movie' && (
          <div className="coming-soon-state" style={{ padding: '100px', textAlign: 'center', color: '#fff' }}>
            <div className="lock-icon" style={{ fontSize: '64px', marginBottom: '20px' }}>🔒</div>
            <h3>功能开发中</h3>
            <p style={{ color: '#a1a1aa' }}>我们正在努力适配该功能，敬请期待！</p>
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


