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

  const handleSignOut = async () => { setConfirmLogoutOpen(true) }
  const confirmLogout = async () => {
    setConfirmLogoutOpen(false)
    try { await signOut(auth); showNotice('👋 已退出登录', 'success') } catch (e) { showNotice('⚠️ 操作失败，请稍后重试', 'error') }
  }

  return (
    <section className="upload-page">
      {/* 顶部页头：品牌 + 选项卡导航（仿小鹦看看）*/}
      <header className="page-header">
        <div className="brand">
          <span className="brand-title">跟读鸭</span>
          <span className="brand-subtitle">免费跟读学外语</span>
        </div>
        {/* 主题与教学下拉已删除，保持更简洁的页头 */}
        <nav className="header-tabs" role="tablist" aria-label="内容分区选择">
          <button
            className={`tab-btn ${activeTab === 'movie' ? 'active' : ''}`}
            role="tab"
            aria-selected={activeTab === 'movie'}
            onClick={() => setActiveTab('movie')}
          >影视</button>
          <button
            className={`tab-btn ${activeTab === 'ted' ? 'active' : ''}`}
            role="tab"
            aria-selected={activeTab === 'ted'}
            onClick={() => setActiveTab('ted')}
          >TED</button>
          <button
            className={`tab-btn ${activeTab === 'local' ? 'active' : ''}`}
            role="tab"
            aria-selected={activeTab === 'local'}
            onClick={() => setActiveTab('local')}
          >本地</button>
          <button
            className={`tab-btn ${activeTab === 'ai' ? 'active' : ''}`}
            role="tab"
            aria-selected={activeTab === 'ai'}
            onClick={() => setActiveTab('ai')}
          >AI 对话</button>
        </nav>
        {/* 右上角操作：注册/用户信息 */}
        <div className="header-actions" style={{ position: 'relative', gap: 12 }}>
          {currentUser ? (
            <>
              {userProfile?.membership !== 'member' && (
                <button
                  className="header-action-btn"
                  onClick={() => setMembershipOpen(true)}
                  title="开通会员"
                >开通会员</button>
              )}
              <div
                className="user-chip"
                role="button"
                tabIndex={0}
                title="打开用户菜单"
                onClick={() => setUserMenuOpen(v => !v)}
              >
                <span className="user-email">{currentUser.email}</span>
                <span className={`membership-badge ${userProfile?.membership || (currentUser ? 'free' : 'free')}`}>{userProfile?.membership || (currentUser ? 'free' : '游客')}</span>
              </div>
              {userMenuOpen && (
                <div className="dropdown-menu" style={{ position: 'absolute', top: '100%', right: 0, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 12px 24px rgba(0,0,0,0.12)', padding: 8, zIndex: 20 }}>
                  {userProfile?.membership !== 'member' && (
                    <button className="link-btn" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px' }} onClick={() => { setMembershipOpen(true); setUserMenuOpen(false) }}>💎 开通会员</button>
                  )}
                  <button className="link-btn" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px' }} onClick={() => { navigate('/password'); setUserMenuOpen(false) }}>🔐 账户安全（设置登录密码）</button>
                  <button className="link-btn" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px' }} onClick={() => { setConfirmLogoutOpen(true); setUserMenuOpen(false) }}>🚪 退出登录</button>
                </div>
              )}
            </>
          ) : (
            <>
              <button className="header-action-btn" onClick={() => navigate('/register', { state: { mode: 'login' } })}>登录</button>
              <button className="header-action-btn" onClick={() => setMembershipOpen(true)}>开通会员</button>
            </>
          )}
        </div>
      </header>

      {/* 新版首页 Hero 区：品牌宣言 + 快速开始 */}
      <section className="home-hero" aria-label="学习平台简介与快速开始">
        <div className="hero-copy">
          <div className="hero-title brand">
            <span className="duck-logo" aria-hidden>
              <BrandDuck src="/duck-follow-me.png" fallbackSrc="/duck-follow-me2.png" />
            </span>
            <span>跟读鸭 - 你的专属英语陪练</span>
          </div>
          <p className="hero-desc">导入影视/TED 视频，配合双语字幕，练听力与跟读，一站式提升听说能力。</p>
          <div className="hero-actions" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {!currentUser && (<button className="hero-secondary" onClick={() => navigate('/register', { state: { mode: 'login' } })}>登录</button>)}
            <span className="hint-text">会员状态：{userProfile?.membership || (currentUser ? 'free' : '游客')}</span>
            {/* 移除“升级会员”按钮 */}
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true" />
      </section>

      {/* 次级标题：仅 TED 分区显示，其余分区不显示标题 */}
      {activeTab === 'ted' && (
        <h2 className="page-title">TED英语演讲学习</h2>
      )}


      {/* 本地分区：保持现有上传功能 */}
      {activeTab === 'local' && (
        <div className="tab-content" role="tabpanel" aria-label="本地上传">
          <div className="upload-grid">
            <div className="upload-slot">
              <label className="upload-card" tabIndex="0">
                {/* 隐藏的文件输入，通过点击整个卡片触发 */}
                <input type="file" accept=".mp4,.webm,.mkv" onChange={handleVideoUpload} />
                <div className="upload-icon" aria-hidden>🎬</div>
                <div className="upload-text">点击上传视频文件</div>
                <div className="upload-subtext">支持 .mp4, .webm, .mkv 格式</div>
              </label>
              {videoFile && (
                <div className="selected-file" title={`已选视频：${videoFile.name}`}>已选视频：{truncateMiddle(videoFile.name)}</div>
              )}
            </div>

            <div className="upload-slot">
              <label className="upload-card" tabIndex="0">
                {/* 隐藏的文件输入，通过点击整个卡片触发 */}
                <input type="file" accept=".srt,.vtt,.ass" onChange={handleSubtitleUpload} />
                <div className="upload-icon" aria-hidden>📝</div>
                <div className="upload-text">点击上传字幕文件</div>
                <div className="upload-subtext">支持 .srt, .vtt, .ass 格式</div>
              </label>
              {subtitleFile && (
                <div className="selected-file" title={`已选字幕：${subtitleFile.name}`}>已选字幕：{truncateMiddle(subtitleFile.name)}</div>
              )}
            </div>
          </div>

          <div className="actions">
            <button className="primary-btn" onClick={handleStartLearning} disabled={!isReady}>
              开始学习
            </button>
            <span className="hint-text" role="status" aria-live="polite">推荐上传双语字幕文件以获得更好的学习体验</span>
            {!subtitleFile && videoFile && (
              <span className="hint-text" role="status" aria-live="polite">未选择字幕也可开始，进入后可继续添加</span>
            )}
          </div>
        </div>
      )}

      {/* TED 分区：暂未开放，与影视模块一致为占位提示 */}
      {activeTab === 'ted' && (
        <div className="tab-content" role="tabpanel" aria-label="TED 演讲">
          <div className="section" style={{ textAlign: 'center', padding: '28px 0' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>功能开发中，敬请期待</div>
            <div style={{ color: 'var(--muted)', marginTop: 8 }}>TED 模块正在适配中，将提供官方演讲的学习与跟读体验</div>
          </div>
        </div>
      )}

      {/* 影视分区：占位提示 */}
      {activeTab === 'movie' && (
        <div className="tab-content" role="tabpanel" aria-label="影视学习">
          <div className="section">
            <h3 className="section-title">影视学习</h3>
            <p className="section-desc">功能开发中，敬请期待。未来将支持官方源的合法播放与学习。</p>
          </div>
        </div>
      )}

      {/* AI 对话分区 */}
      {activeTab === 'ai' && (
        <div className="tab-content" role="tabpanel" aria-label="AI 对话">
          <div className="section">
            <h3 className="section-title">AI 口语陪练</h3>
            <p className="section-desc">选择一个话题，开始与 AI 进行一对一英语口语对话练习。</p>

            <div className="upload-grid" style={{ marginTop: '20px' }}>
              {[
                { id: 'free', title: 'Free Talk', icon: '☕', desc: '自由对话，聊聊任何你想说的话题' },
                { id: 'daily', title: 'Daily Life', icon: '🏠', desc: '日常生活，讨论天气、食物、爱好等' },
                { id: 'travel', title: 'Travel', icon: '✈️', desc: '旅行场景，问路、预订酒店、机场对话' },
                { id: 'business', title: 'Business', icon: '💼', desc: '职场英语，面试、会议、商务谈判' },
              ].map(topic => (
                <div key={topic.id} className="upload-slot" onClick={() => navigate('/conversation')}>
                  <div className="upload-card" style={{ cursor: 'pointer' }}>
                    <div className="upload-icon" style={{ fontSize: '48px' }}>{topic.icon}</div>
                    <div className="upload-text">{topic.title}</div>
                    <div className="upload-subtext">{topic.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* 确认退出登录 */}
      <ConfirmDialog
        isOpen={confirmLogoutOpen}
        title="⚠️ 确认退出登录？"
        message={"退出后将无法继续观看会员内容\n可随时再次登录恢复权限"}
        confirmText="确定"
        cancelText="取消"
        onConfirm={confirmLogout}
        onCancel={() => setConfirmLogoutOpen(false)}
      />
      {/* 会员开通/升级引导弹窗 */}
      <MembershipModal isOpen={membershipOpen} onClose={() => setMembershipOpen(false)} />
      {/* 未登录开始学习确认 */}
      <ConfirmDialog
        isOpen={confirmStartOpen}
        title="🎬 进入播放器开始学习？"
        message={"未登录也可进入播放器试看 1 分钟\n建议登录以保存学习进度"}
        confirmText="进入"
        cancelText="取消"
        onConfirm={() => { setConfirmStartOpen(false); navigate('/player', { state: { videoFile, subtitleFile: subtitleFile || null } }) }}
        onCancel={() => setConfirmStartOpen(false)}
      />
      {/* App 内提示：Toast */}
      <Toast message={toastMsg} type={toastType} onClose={dismissNotice} />
    </section>
  )
}


