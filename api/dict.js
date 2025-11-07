// Vercel Serverless Function: 有道词典代理接口（中文释义优先）
// 说明：读取查询参数 word，经由环境变量中的 AppKey 与 AppSecret 生成签名，
// 请求有道开放平台接口（https://openapi.youdao.com/api），并按如下规则返回统一结构：
// {
//   word: string,              // 词头
//   phonetic: string,          // 音标（若同时有英式/美式则拼接）
//   explains: string[],        // 中文释义（优先 basic.explains，否则 translation）
//   example: string | null,    // 简单例句或短语（可为空）
//   source: 'youdao'|'fallback'
// }
// 若有道调用失败或超过配额，则触发英文词典兜底（dictionaryapi.dev），source 标记为 'fallback'。
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
  if (uk && us) phonetic = `UK /${uk}/ · US /${us}/`
  else if (uk) phonetic = `UK /${uk}/`
  else if (us) phonetic = `US /${us}/`
  else phonetic = basic['phonetic'] ? `/${basic['phonetic']}/` : ''

  let explains = []
  if (Array.isArray(basic.explains) && basic.explains.length > 0) {
    explains = basic.explains
  } else if (Array.isArray(json.translation) && json.translation.length > 0) {
    explains = json.translation
  } else if (typeof json.translation === 'string' && json.translation) {
    explains = [json.translation]
  }

  // 取一条 web 短语作为例子（若存在）
  let example = null
  try {
    if (Array.isArray(json.web) && json.web.length > 0) {
      const firstWeb = json.web.find(w => Array.isArray(w.value) && w.value.length > 0)
      if (firstWeb) example = String(firstWeb.value[0])
    }
  } catch {}

  return {
    word: q,
    phonetic,
    explains,
    example,
    source: 'youdao'
  }
}

// 兜底：英文免费词典（dictionaryapi.dev）统一结构
async function queryFallback(q) {
  try {
    const alt = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(q)}`)
    if (!alt.ok) {
      return { word: q, phonetic: '', explains: [], example: null, source: 'fallback', error: 'FallbackHttpError', status: alt.status }
    }
    const arr = await alt.json()
    const first = Array.isArray(arr) && arr[0] ? arr[0] : null
    const phonetic = first?.phonetic || (Array.isArray(first?.phonetics) ? (first.phonetics[0]?.text || '') : '')
    const defs = []
    if (Array.isArray(first?.meanings)) {
      for (const m of first.meanings) {
        if (Array.isArray(m?.definitions)) {
          for (const d of m.definitions) {
            if (d?.definition) defs.push(String(d.definition))
          }
        }
      }
    }
    const example = (Array.isArray(first?.meanings) && first.meanings[0]?.definitions?.[0]?.example) || null
    return { word: q, phonetic, explains: defs, example: example ? String(example) : null, source: 'fallback' }
  } catch (e) {
    return { word: q, phonetic: '', explains: [], example: null, source: 'fallback', error: 'FallbackError', message: String(e?.message || e) }
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
    let data = await queryYoudao(q)
    // 有道失败或无中文释义时，触发兜底（仅作为备用，不影响线上优先级逻辑）
    if (data && data.error) {
      data = await queryFallback(q)
    } else if (!Array.isArray(data?.explains) || data.explains.length === 0) {
      // 如果有道返回没有中文释义，也尝试兜底以给出基本英文解释
      const fb = await queryFallback(q)
      // 若兜底有内容，则返回兜底；否则仍返回有道结构
      if (Array.isArray(fb.explains) && fb.explains.length > 0) data = fb
    }
    res.setHeader('Cache-Control', 'public, max-age=300')
    res.status(200).json(data)
  } catch (e) {
    res.status(200).json({ error: 'ProxyError', message: String(e?.message || e) })
  }
}