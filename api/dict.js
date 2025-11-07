// Vercel Serverless Function: 有道词典代理接口
// 说明：读取查询参数 word，经由环境变量中的 AppKey 与 AppSecret 生成签名，
// 请求有道开放平台接口（https://openapi.youdao.com/api），返回简化后的释义结构。
// 安全性：不在前端暴露密钥，支持在 Vercel/本地 .env 中配置。

const crypto = require('crypto')

function md5(text) {
  return crypto.createHash('md5').update(text).digest('hex')
}

function buildYoudaoParams(q, appKey, appSecret) {
  const salt = String(Date.now())
  const from = 'en'
  const to = 'zh-CHS'
  const sign = md5(appKey + q + salt + appSecret)
  const params = new URLSearchParams({ q, from, to, appKey, salt, sign })
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
  // 根据有道返回结构简化：优先 basic.explains 与 phonetic
  const basic = json.basic || {}
  const explains = Array.isArray(basic.explains) ? basic.explains : []
  const phonetic = basic['phonetic'] || basic['uk-phonetic'] || basic['us-phonetic'] || ''
  const example = Array.isArray(json.web) && json.web.length > 0 && Array.isArray(json.web[0].value)
    ? json.web[0].value.slice(0, 2)
    : []
  return {
    word: q,
    phonetic,
    explains,
    example
  }
}

module.exports = async (req, res) => {
  try {
    const { word } = req.query || {}
    const q = String(word || '').trim().toLowerCase()
    if (!q) {
      res.status(400).json({ error: 'BadRequest', message: '缺少 word 参数' })
      return
    }
    const data = await queryYoudao(q)
    if (data && data.error) {
      res.status(200).json(data)
      return
    }
    res.setHeader('Cache-Control', 'public, max-age=300')
    res.status(200).json(data)
  } catch (e) {
    res.status(200).json({ error: 'ProxyError', message: String(e?.message || e) })
  }
}