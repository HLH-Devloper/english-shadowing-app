// Vercel Serverless Function: 有道词典代理接口（中文释义优先、包含常见搭配）
// 说明：读取查询参数 word，经由环境变量中的 AppKey 与 AppSecret 生成签名，
// 请求有道开放平台接口（https://openapi.youdao.com/api），并按如下规则返回统一结构：
// {
//   word: string,              // 词头
//   phonetic: string,          // 音标（格式：英 [uk] 美 [us]；仅一侧则保留对应一项；若仅 basic.phonetic 则为 [phonetic]）
//   explains: string[],        // 中文释义（优先 basic.explains，否则 translation 字段作为回退）
//   webPhrases: { key: string, valueZh?: string }[], // 常见搭配，取 web 字段前 3~5 条
//   source: 'youdao'
// }
// 注意：按用户要求，本函数不再调用 dictionaryapi.dev，不进行英文长解释或例句翻译的兜底。
// 安全性：不在前端暴露密钥，支持在 Vercel/本地 .env 中配置。

import { createHash } from 'crypto'

function sha256(text) {
  return createHash('sha256').update(text).digest('hex')
}

// Youdao v3 签名：sha256(appKey + truncate(q) + salt + curtime + appSecret)
function truncate(q) {
  const len = q.length
  if (len <= 20) return q
  return q.substring(0, 10) + len + q.substring(len - 10)
}

function buildYoudaoParams(q, appKey, appSecret) {
  const salt = String(Date.now())
  const curtime = String(Math.floor(Date.now() / 1000))
  const signType = 'v3'
  const from = 'en'
  const to = 'zh-CHS'
  const sign = sha256(appKey + truncate(q) + salt + curtime + appSecret)
  const params = new URLSearchParams({ q, from, to, appKey, salt, curtime, sign, signType })
  return params.toString()
}

async function queryYoudao(q) {
  const appKey = process.env.YOUDAO_APP_KEY
  const appSecret = process.env.YOUDAO_APP_SECRET
  if (!appKey || !appSecret) {
    return { error: 'MissingCredentials', message: '未配置 Youdao AppKey 或 AppSecret' }
  }
  const qs = buildYoudaoParams(q, appKey, appSecret)
  const url = `https://openapi.youdao.com/api?${qs}`
  const res = await fetch(url, { method: 'GET' })
  if (!res.ok) {
    return { error: 'HttpError', status: res.status }
  }
  const json = await res.json()
  // 如果返回包含错误码且不为 0，视为失败（参考官方文档）
  if (json && typeof json.errorCode !== 'undefined' && String(json.errorCode) !== '0') {
    return { error: 'YoudaoError', code: String(json.errorCode || '') }
  }
  // 根据有道返回结构简化：中文释义优先（basic.explains，其次 translation）与音标
  const basic = json.basic || {}
  const uk = basic['uk-phonetic'] || ''
  const us = basic['us-phonetic'] || ''
  let phonetic = ''
  if (uk && us) phonetic = `英 [${uk}] 美 [${us}]`
  else if (uk) phonetic = `英 [${uk}]`
  else if (us) phonetic = `美 [${us}]`
  else phonetic = basic['phonetic'] ? `[${basic['phonetic']}]` : ''

  let explains = []
  if (Array.isArray(basic.explains) && basic.explains.length > 0) {
    explains = basic.explains
  } else if (Array.isArray(json.translation) && json.translation.length > 0) {
    explains = json.translation
  } else if (typeof json.translation === 'string' && json.translation) {
    explains = [json.translation]
  }

  // 常见搭配：从 web 字段中截取前 3~5 条
  let webPhrases = []
  try {
    if (Array.isArray(json.web) && json.web.length > 0) {
      const list = json.web.slice(0, 5)
      webPhrases = list.map(item => {
        const key = String(item.key || '').trim()
        const valueZh = Array.isArray(item.value) && item.value.length > 0 ? String(item.value[0]).trim() : undefined
        return { key, valueZh }
      }).filter(p => p.key)
      // 若条目过多，限制到前 3~5 条
      if (webPhrases.length > 5) webPhrases = webPhrases.slice(0, 5)
    }
  } catch {}

  return {
    word: q,
    phonetic,
    explains,
    webPhrases,
    source: 'youdao'
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
    const data = await queryYoudao(q)
    // 统一结构输出；若有 error 则返回友好结构（不做英文词典兜底）
    if (data && data.error) {
      res.status(200).json({ word: q, phonetic: '', explains: [], webPhrases: [], source: 'youdao', error: data.error, message: data.message || '' })
      return
    }
    res.setHeader('Cache-Control', 'public, max-age=300')
    res.status(200).json(data)
  } catch (e) {
    res.status(200).json({ word: '', phonetic: '', explains: [], webPhrases: [], source: 'youdao', error: 'ProxyError', message: String(e?.message || e) })
  }
}