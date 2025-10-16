import { initializeApp } from 'firebase/app'
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, updatePassword, sendPasswordResetEmail } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// 使用 Vite 环境变量，请在 .env.local 中配置以下键：
// VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID,
// VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

// 将认证邮件语言设置为中文，以便用户收到中文正文内容
auth.languageCode = 'zh-CN'

// 已登录用户修改密码：需要使用当前密码进行“近期登录”重新验证
export async function changePassword(currentPassword, newPassword) {
  const user = auth.currentUser
  if (!user) throw new Error('not_logged_in')
  if (!user.email) throw new Error('missing_email')
  const credential = EmailAuthProvider.credential(user.email, currentPassword)
  await reauthenticateWithCredential(user, credential)
  await updatePassword(user, newPassword)
}

// 发送“忘记密码”重置邮件
export async function sendPasswordReset(email) {
  if (!email) throw new Error('missing_email')
  await sendPasswordResetEmail(auth, email)
}