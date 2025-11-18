// 测试Innertube API

async function test() {
  const videoId = 'Zg2_361CgzE'

  // 1. 获取watch页面
  console.log('1. Fetching watch page...')
  const watchRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.youtube.com/',
      'Cookie': 'CONSENT=YES+'
    }
  })
  const html = await watchRes.text()

  // 2. 提取ytcfg
  console.log('2. Extracting ytcfg...')
  const ytcfgMatch = html.match(/ytcfg\.set\((\{[\s\S]*?\})\)/)
  if (!ytcfgMatch) {
    console.log('ERROR: ytcfg not found')
    return
  }
  const ytcfg = JSON.parse(ytcfgMatch[1])
  const apiKey = ytcfg.INNERTUBE_API_KEY
  const clientVersion = ytcfg.INNERTUBE_CONTEXT?.client?.clientVersion
  console.log('   API Key:', apiKey)
  console.log('   Client Version:', clientVersion)

  // 3. 提取ytInitialData (查找transcriptEndpoint)
  console.log('3. Extracting ytInitialData...')
  let ytInitialData = null
  const markers = [
    ['var ytInitialData = ', '};'],
    ['window["ytInitialData"] = ', '};']
  ]
  for (const [start, end] of markers) {
    const idx = html.indexOf(start)
    if (idx >= 0) {
      const startPos = idx + start.length
      const endPos = html.indexOf(end, startPos) + 1
      ytInitialData = JSON.parse(html.slice(startPos, endPos))
      break
    }
  }

  if (!ytInitialData) {
    console.log('ERROR: ytInitialData not found')
    return
  }

  // 4. 深度搜索transcriptEndpoint
  console.log('4. Searching for transcriptEndpoint...')
  function deepFind(obj, predicate) {
    const stack = [obj]
    while (stack.length) {
      const cur = stack.pop()
      if (!cur || typeof cur !== 'object') continue
      try {
        if (predicate(cur)) return cur
      } catch {}
      for (const k in cur) {
        if (cur[k] && typeof cur[k] === 'object') stack.push(cur[k])
      }
    }
    return null
  }

  const node = deepFind(ytInitialData, (n) => !!n?.transcriptEndpoint?.params)
  if (!node || !node.transcriptEndpoint?.params) {
    console.log('ERROR: transcriptEndpoint.params not found')
    console.log('This video might not have transcripts available via Innertube API')
    return
  }

  const params = node.transcriptEndpoint.params
  console.log('   Found params:', params.substring(0, 50) + '...')

  // 5. 调用Innertube API
  console.log('\n5. Calling Innertube API...')
  const url = `https://www.youtube.com/youtubei/v1/get_transcript?key=${encodeURIComponent(apiKey)}`
  const body = {
    context: {
      client: {
        clientName: 'WEB',
        clientVersion: clientVersion,
        hl: 'en',
        gl: 'US'
      }
    },
    params: params
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      body: JSON.stringify(body)
    })

    console.log(`   Status: ${res.status}`)
    const json = await res.json()
    console.log(`   Response keys:`, Object.keys(json))

    if (json.actions) {
      console.log(`   actions length:`, json.actions.length)
      console.log(`   First action keys:`, Object.keys(json.actions[0] || {}))
    }
    if (json.error) {
      console.log(`   ERROR:`, json.error)
    }
  } catch (e) {
    console.log('   ERROR:', e.message)
  }
}

test().catch(console.error)
