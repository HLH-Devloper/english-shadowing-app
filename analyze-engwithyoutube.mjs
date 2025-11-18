// 分析 engwithyoutube.vercel.app 的实现

async function analyzeSite() {
  console.log('=== Analyzing engwithyoutube.vercel.app ===\n')

  const videoId = 'Zg2_361CgzE'
  const url = `https://engwithyoutube.vercel.app/video/${videoId}`

  console.log(`1. Fetching page: ${url}\n`)

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  })

  const html = await response.text()

  console.log(`   Status: ${response.status}`)
  console.log(`   Content length: ${html.length}\n`)

  // 检查是否有字幕数据
  console.log('2. Looking for transcript data...\n')

  // 查找常见的数据嵌入方式
  const patterns = [
    { name: 'JSON in script tag', regex: /<script[^>]*>(.*?transcript.*?)<\/script>/gi },
    { name: 'Next.js props', regex: /"transcript":\s*(\[.*?\])/g },
    { name: 'Inline data', regex: /data-transcript="([^"]*)"/g },
    { name: 'Window variable', regex: /window\.__NEXT_DATA__\s*=\s*({[\s\S]*?})<\/script>/g },
  ]

  for (const pattern of patterns) {
    const matches = html.match(pattern.regex)
    if (matches && matches.length > 0) {
      console.log(`   ✅ Found: ${pattern.name}`)
      console.log(`      Matches: ${matches.length}`)
      console.log(`      Sample: ${matches[0].substring(0, 200)}...\n`)
    } else {
      console.log(`   ❌ Not found: ${pattern.name}`)
    }
  }

  // 查找 __NEXT_DATA__
  console.log('\n3. Extracting Next.js data...\n')
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)

  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1])
      console.log('   ✅ Successfully parsed __NEXT_DATA__')

      // 深度搜索transcript相关数据
      function findTranscript(obj, path = '') {
        if (!obj || typeof obj !== 'object') return

        for (const key in obj) {
          const newPath = path ? `${path}.${key}` : key

          if (key.toLowerCase().includes('transcript') ||
              key.toLowerCase().includes('caption') ||
              key.toLowerCase().includes('segment')) {
            console.log(`   Found key "${key}" at: ${newPath}`)
            console.log(`   Value type: ${typeof obj[key]}`)
            if (Array.isArray(obj[key])) {
              console.log(`   Array length: ${obj[key].length}`)
              if (obj[key].length > 0) {
                console.log(`   First item: ${JSON.stringify(obj[key][0]).substring(0, 150)}...`)
              }
            }
          }

          if (typeof obj[key] === 'object') {
            findTranscript(obj[key], newPath)
          }
        }
      }

      findTranscript(nextData)
    } catch (e) {
      console.log(`   ❌ Failed to parse: ${e.message}`)
    }
  } else {
    console.log('   ❌ No __NEXT_DATA__ found')
  }

  // 检查是否有API调用
  console.log('\n4. Looking for API endpoints...\n')
  const apiPatterns = [
    /fetch\(['"`]([^'"`]*api[^'"`]*)['")`]/g,
    /axios\(['"`]([^'"`]*api[^'"`]*)['")`]/g,
    /\/api\/[a-zA-Z0-9_/-]+/g
  ]

  for (const pattern of apiPatterns) {
    const matches = [...html.matchAll(pattern)]
    if (matches.length > 0) {
      console.log(`   Found ${matches.length} potential API calls:`)
      matches.slice(0, 5).forEach(m => {
        console.log(`      - ${m[1] || m[0]}`)
      })
    }
  }

  // 检查是否加载外部脚本
  console.log('\n5. Checking external scripts...\n')
  const scriptMatches = html.matchAll(/<script[^>]*src="([^"]+)"[^>]*>/g)
  let count = 0
  for (const match of scriptMatches) {
    if (match[1].includes('youtube') || match[1].includes('transcript')) {
      console.log(`   Found: ${match[1]}`)
      count++
    }
  }
  if (count === 0) {
    console.log('   No YouTube or transcript related scripts')
  }
}

analyzeSite().catch(console.error)
