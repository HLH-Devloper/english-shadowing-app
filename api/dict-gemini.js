// Vercel Serverless Function: 按需 Gemini 查词 + Firebase 复用
// 流程：
// 1) 先查 Firestore 集合 wordDict（文档ID为小写单词）。若存在且 explains 非空，直接返回 source=firebase。
// 2) 若未命中，则使用 Gemini 生成严格 JSON（仅在服务端调用，使用环境变量 GEMINI_API_KEY）。
// 3) 将 Gemini 结果写回 Firestore，返回 source=gemini。
// 4) 失败时返回统一的友好结构，source=error。

import { GoogleGenerativeAI } from '@google/generative-ai'
import admin from 'firebase-admin'

// 避免重复初始化 Admin 应用
function ensureAdmin() {
  if (admin.apps && admin.apps.length > 0) {
    return admin.app()
  }
  // 优先使用 FIREBASE_SERVICE_ACCOUNT（JSON 字符串）
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT
  let credential = null
  let projectId = null
  if (svc) {
    try {
      const json = JSON.parse(svc)
      credential = admin.credential.cert(json)
      projectId = json.project_id || json.projectId || null
    } catch (e) {
      console.warn('FIREBASE_SERVICE_ACCOUNT 解析失败', e)
    }
  }
  // 兼容单独变量配置
  if (!credential) {
    const pid = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || null
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    let privateKey = process.env.FIREBASE_PRIVATE_KEY
    if (privateKey) {
      privateKey = privateKey.replace(/\\n/g, '\n')
    }
    if (pid && clientEmail && privateKey) {
      credential = admin.credential.cert({ projectId: pid, clientEmail, privateKey })
      projectId = pid
    }
  }
  // 若仍无凭据，返回 null，让调用方优雅兜底不触发 @google-cloud/firestore 的 ADC(Application Default Credentials) 错误
  if (!credential) {
    return null
  }
  try {
    return admin.initializeApp({ credential, projectId: projectId || undefined })
  } catch (e) {
    console.warn('Firebase Admin 初始化失败', e)
    return null
  }
}

function getDb() {
  const app = ensureAdmin()
  if (!app) return null
  try {
    return admin.firestore(app)
  } catch (e) {
    console.warn('获取 Firestore 实例失败', e)
    return null
  }
}

// 统一限制输出长度（守护）
function normalizeGeminiDict(input, q) {
  const safe = (v) => (typeof v === 'string' ? v.trim() : '')
  const word = safe(input?.word) || q
  const phonetic = safe(input?.phonetic)
  let explains = Array.isArray(input?.explains) ? input.explains.map(safe).filter(Boolean) : []
  let examples = Array.isArray(input?.examples)
    ? input.examples
        .map((e) => ({ en: safe(e?.en), zh: safe(e?.zh) }))
        .filter((e) => e.en)
    : []
  if (explains.length > 4) explains = explains.slice(0, 4)
  if (examples.length > 2) examples = examples.slice(0, 2)
  return { word, phonetic, explains, examples }
}

async function lookupFromFirestore(q) {
  try {
    const db = getDb()
    if (!db) return null
    const ref = db.collection('wordDict').doc(q)
    const snap = await ref.get()
    if (snap.exists) {
      const data = snap.data() || {}
      const explains = Array.isArray(data.explains) ? data.explains : []
      if (explains.length > 0) {
        return {
          word: q,
          phonetic: typeof data.phonetic === 'string' ? data.phonetic : '',
          explains,
          examples: Array.isArray(data.examples) ? data.examples : [],
          source: 'firebase'
        }
      }
    }
    return null
  } catch (e) {
    console.warn('读取 Firestore 失败', e)
    return null
  }
}

async function generateByGemini(q) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return { error: 'MissingGeminiKey' }
  }
  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    // 兼容不同可用模型与版本：优先使用环境变量 GEMINI_MODEL，其次采用一组后备名称
    const candidateModels = []
    const envModel = (process.env.GEMINI_MODEL || '').trim()
    if (envModel) candidateModels.push(envModel)
    candidateModels.push(
      // 优先尝试你指定的预览模型（若环境未显式指定也会作为候选）
      'gemini-2.5-flash-preview-09-2025',
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash-002',
      'gemini-1.5-pro-002',
      'gemini-1.5-pro-latest'
    )

    let lastError = null
    for (const name of candidateModels) {
      try {
        const model = genAI.getGenerativeModel({
          model: name,
          generationConfig: { responseMimeType: 'application/json' }
        })
        const prompt = `请为英文单词 "${q}" 生成严格的 JSON（仅输出 JSON，不要任何注释或额外文本）。\n结构如下：\n{\n  "word": "${q}",\n  "phonetic": "英 [uk] 美 [us]",\n  "explains": ["中文释义 1", "中文释义 2"],\n  "examples": [{"en": "英文例句", "zh": "中文翻译"}]\n}\n要求：\n- explains 最多 3-4 条，尽量简洁；\n- examples 最多 1-2 条；\n- phonetic 同时给出英式和美式（如果可得），否则留空字符串；\n- 所有中文均为简体中文；\n- 不要输出任何额外文本。`

        const result = await model.generateContent(prompt)
        const text = result?.response?.text?.() || ''
        if (!text) {
          lastError = new Error('EmptyGeminiResponse')
          continue
        }
        let parsed
        try {
          parsed = JSON.parse(text)
        } catch (e) {
          const m = text.match(/\{[\s\S]*\}/)
          if (m) {
            parsed = JSON.parse(m[0])
          } else {
            throw e
          }
        }
        const data = normalizeGeminiDict(parsed, q)
        return { ...data, source: 'gemini', model: name }
      } catch (err) {
        // 若为 404（模型不存在或不支持 generateContent），尝试下一个候选模型
        const status = err?.status || err?.code || null
        if (status === 404) {
          lastError = err
          continue
        }
        // 若为 403（未设置 API(Application Programming Interface) 密钥或权限不足），直接返回错误
        if (status === 403) {
          return { error: 'GeminiPermissionDenied', message: 'Gemini 权限不足或密钥无效', status }
        }
        lastError = err
      }
    }
    // 所有候选模型均不可用
    if (lastError) {
      return { error: 'GeminiModelUnavailable', message: String(lastError?.message || lastError) }
    }
    return { error: 'GeminiUnknownError' }
  } catch (e) {
    console.warn('Gemini 调用失败', e)
    return { error: 'GeminiError', message: String(e?.message || e) }
  }
}

async function writeToFirestore(q, data) {
  try {
    const db = getDb()
    if (!db) return false
    const ref = db.collection('wordDict').doc(q)
    const payload = {
      phonetic: data.phonetic || '',
      explains: Array.isArray(data.explains) ? data.explains : [],
      examples: Array.isArray(data.examples) ? data.examples : [],
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }
    const snap = await ref.get()
    if (!snap.exists) {
      payload.createdAt = admin.firestore.FieldValue.serverTimestamp()
    }
    await ref.set(payload, { merge: true })
    return true
  } catch (e) {
    console.warn('写入 Firestore 失败', e)
    return false
  }
}

export default async function handler(req, res) {
  try {
    const { word } = req.query || {}
    const q = String(word || '').trim().toLowerCase()
    if (!q) {
      res.status(400).json({ error: 'BadRequest', message: '缺少 word 参数' })
      return
    }

    // 先从 Firestore 命中
    const cached = await lookupFromFirestore(q)
    if (cached) {
      res.setHeader('Cache-Control', 'no-store')
      res.status(200).json(cached)
      return
    }

    // 调用 Gemini 生成
    const gen = await generateByGemini(q)
    if (gen && !gen.error) {
      // 写回 Firestore（忽略失败，不影响前端显示）
      await writeToFirestore(q, gen)
      res.setHeader('Cache-Control', 'no-store')
      res.status(200).json(gen)
      return
    }

    // 统一错误输出
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({ word: q, phonetic: '', explains: [], examples: [], source: 'error' })
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({ word: '', phonetic: '', explains: [], examples: [], source: 'error' })
  }
}