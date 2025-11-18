// 测试不同的请求头组合

async function fetchWatchPage(videoId) {
  const url = `https://www.youtube.com/watch?v=${videoId}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'Referer': 'https://www.youtube.com/',
      'Cookie': 'CONSENT=YES+; PREF=hl=en'
    }
  })

  const html = await res.text()

  // 提取 captionTracks
  const match = html.match(/"captionTracks":\[(.*?)\]/)
  if (!match) {
    console.log('❌ No captionTracks found')
    return null
  }

  const captionsJSON = `[${match[1]}]`
  const tracks = JSON.parse(captionsJSON)
  console.log(`✅ Found ${tracks.length} caption tracks`)

  return tracks[0] // 返回第一个轨道
}

async function testBaseUrl(baseUrl) {
  console.log('\n=== Testing baseUrl with different headers ===')
  console.log(`URL: ${baseUrl.substring(0, 80)}...`)

  const headerSets = [
    {
      name: 'Minimal (current implementation)',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    },
    {
      name: 'Browser-like (full)',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.youtube.com/watch',
        'Origin': 'https://www.youtube.com',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Cookie': 'CONSENT=YES+'
      }
    },
    {
      name: 'With session cookies',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.youtube.com/',
        'Cookie': 'CONSENT=YES+; VISITOR_INFO1_LIVE=test; PREF=hl=en&gl=US'
      }
    }
  ]

  for (const set of headerSets) {
    console.log(`\n${set.name}:`)
    try {
      const res = await fetch(baseUrl, { headers: set.headers })
      const text = await res.text()
      console.log(`  Status: ${res.status}`)
      console.log(`  Content-Length: ${text.length}`)
      console.log(`  Content-Type: ${res.headers.get('content-type')}`)

      if (text.length > 0) {
        console.log(`  ✅ Got content!`)
        console.log(`  First 200 chars: ${text.substring(0, 200)}`)

        // 尝试解析
        const matches = text.match(/<text[^>]*>/g)
        if (matches) {
          console.log(`  Found ${matches.length} <text> elements`)
        }
      } else {
        console.log(`  ❌ Empty response`)
      }
    } catch (e) {
      console.log(`  ❌ Error: ${e.message}`)
    }
  }
}

async function main() {
  const videoId = 'Zg2_361CgzE'
  console.log(`Testing video: ${videoId}\n`)

  const track = await fetchWatchPage(videoId)
  if (track && track.baseUrl) {
    await testBaseUrl(track.baseUrl)
  }
}

main().catch(console.error)
