// Vercel Serverless Function: 有道词典代理接口（中文释义优先、包含常见搭配）
// 说明：读取查询参数 word，经由环境变量中的 AppKey 与 AppSecret 生成签名，
// 请求有道开放平台词典接口（https://openapi.youdao.com/v2/dict），并按如下规则返回统一结构：
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

// v2/dict 词典接口参数：q、langType、dicts、appKey、salt、curtime、sign、signType
function buildYoudaoDictParams(q, appKey, appSecret) {
  const salt = String(Date.now())
  const curtime = String(Math.floor(Date.now() / 1000))
  const signType = 'v3'
  const langType = 'en' // 英文词条
  // 请求英汉(ec) + 英英(ee) 两种词典，以确保 basic.explains 更丰富；若后续需要汉英可加入 ce
  const dicts = 'ec,ee'
  const sign = sha256(appKey + truncate(q) + salt + curtime + appSecret)
  const params = new URLSearchParams({ q, langType, dicts, appKey, salt, curtime, sign, signType })
  return params.toString()
}

async function queryYoudao(q) {
  const appKey = process.env.YOUDAO_APP_KEY
  const appSecret = process.env.YOUDAO_APP_SECRET
  if (!appKey || !appSecret) {
    return { error: 'MissingCredentials', message: '未配置 Youdao AppKey 或 AppSecret' }
  }
  const qs = buildYoudaoDictParams(q, appKey, appSecret)
  const url = `https://openapi.youdao.com/v2/dict?${qs}`
  const res = await fetch(url, { method: 'GET' })
  if (!res.ok) {
    return { error: 'HttpError', status: res.status }
  }
  const json = await res.json()
  // 如果返回包含错误码且不为 0，视为失败（参考官方文档）
  if (json && typeof json.errorCode !== 'undefined' && String(json.errorCode) !== '0') {
    return { error: 'YoudaoError', code: String(json.errorCode || '') }
  }
  // v2/dict 的结构为：result: []，其中包含 ec/ee 等词典对象
  // 我们优先从 ec.basic 读取中文释义与音标；若不存在则尝试 ee.basic 作为兜底（只用于音标，不展示英英长释义）
  let ec = null
  let ee = null
  try {
    const arr = Array.isArray(json.result) ? json.result : []
    for (const item of arr) {
      if (item && item.ec) ec = item.ec
      if (item && item.ee) ee = item.ee
    }
  } catch {}

  const basic = (ec && ec.basic) || (ee && ee.basic) || {}
  // 字段名在 v2/dict 为 ukPhonetic/usPhonetic/phonetic
  const uk = basic.ukPhonetic || basic['uk-phonetic'] || ''
  const us = basic.usPhonetic || basic['us-phonetic'] || ''
  let phonetic = ''
  if (uk && us) phonetic = `英 [${uk}] 美 [${us}]`
  else if (uk) phonetic = `英 [${uk}]`
  else if (us) phonetic = `美 [${us}]`
  else phonetic = basic.phonetic ? `[${basic.phonetic}]` : ''

  let explains = []
  // 中文释义优先：ec.basic.explains
  if (ec && ec.basic && Array.isArray(ec.basic.explains) && ec.basic.explains.length > 0) {
    explains = ec.basic.explains
  }
  // 若 ec 不存在或无 explains，则尝试 ec.explains（部分返回结构将 explains 放在 ec 层级）
  if ((!explains || explains.length === 0) && ec && Array.isArray(ec.explains) && ec.explains.length > 0) {
    explains = ec.explains
  }
  // 如果仍为空，最后不再使用翻译接口结果，保持空数组，由前端友好提示

  // 常见搭配：从 web 字段中截取前 3~5 条
  let webPhrases = []
  try {
    // v2/dict 的网络释义位于 ec.web 或顶层 web；优先 ec.web
    const webArr = (ec && Array.isArray(ec.web) && ec.web.length > 0) ? ec.web : (Array.isArray(json.web) ? json.web : [])
    if (webArr && webArr.length > 0) {
      const list = webArr.slice(0, 5)
      webPhrases = list.map(item => {
        // 可能的字段：phrase/text/meaning 等，这里尽量兼容
        const key = String(item.phrase || item.text || item.key || '').trim()
        let valueZh
        const val = item.meaning || item.value
        if (Array.isArray(val) && val.length > 0) valueZh = String(val[0]).trim()
        else if (typeof val === 'string' && val) valueZh = String(val).trim()
        return { key, valueZh }
      }).filter(p => p.key)
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
    // 预览环境不缓存，避免“Vercel没有反应出来”的错觉；生产环境可适度缓存
    try {
      const env = String(process.env.VERCEL_ENV || '').toLowerCase()
      if (env === 'preview' || env === 'development') {
        res.setHeader('Cache-Control', 'no-store')
      } else {
        res.setHeader('Cache-Control', 'public, max-age=300')
      }
    } catch {
      res.setHeader('Cache-Control', 'public, max-age=300')
    }
    res.status(200).json(data)
  } catch (e) {
    res.status(200).json({ word: '', phonetic: '', explains: [], webPhrases: [], source: 'youdao', error: 'ProxyError', message: String(e?.message || e) })
  }
}