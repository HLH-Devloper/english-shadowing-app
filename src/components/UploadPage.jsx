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
}


