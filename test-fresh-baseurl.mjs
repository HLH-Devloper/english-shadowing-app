// 测试最新的baseUrl

async function test() {
  const videoId = 'Zg2_361CgzE'

  // 1. 获取最新的watch页面
  console.log('1. Fetching fresh watch page...')
  const watchRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.youtube.com/',
      'Cookie': 'CONSENT=YES+'
    }
  })
  const html = await watchRes.text()

  // 2. 提取ytInitialPlayerResponse
  const marker = 'var ytInitialPlayerResponse = '
  const startIdx = html.indexOf(marker)
  const start = startIdx + marker.length
  const endIdx = html.indexOf('};', start) + 1
  const jsonStr = html.slice(start, endIdx)
  const playerResponse = JSON.parse(jsonStr)

  // 3. 获取英文字幕baseUrl
  const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || []
  const enTrack = tracks.find(t => t.languageCode === 'en')

  if (!enTrack) {
    console.log('ERROR: No English track')
    return
  }

  const baseUrl = enTrack.baseUrl
  console.log('2. Got fresh baseUrl:', baseUrl.substring(0, 120) + '...')
  console.log('   Full length:', baseUrl.length)

  // 3. 立即使用这个baseUrl（原样，不修改）
  console.log('\n3. Fetching captions with fresh baseUrl (no modifications)...')
  try {
    const res = await fetch(baseUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.youtube.com/',
        'Cookie': 'CONSENT=YES+'
      }
    })
    const text = await res.text()
    console.log(`   Status: ${res.status}`)
    console.log(`   Content-Type: ${res.headers.get('content-type')}`)
    console.log(`   Response length: ${text.length}`)
    if (text.length > 0) {
      console.log(`   First 500 chars:\n${text.substring(0, 500)}`)
      // 尝试解析
      if (text.startsWith('<?xml')) {
        console.log('   Format: XML')
        const matches = text.match(/<text[^>]*>/g)
        console.log(`   Found ${matches?.length || 0} text elements`)
      }
    } else {
      console.log('   Response is EMPTY!')
    }
  } catch (e) {
    console.log('   ERROR:', e.message)
  }

  // 4. 尝试在baseUrl基础上改变格式
  console.log('\n4. Testing different formats by modifying baseUrl...')

  const formats = ['json3', 'srv3', 'vtt', '']
  for (const fmt of formats) {
    const testUrl = fmt ? `${baseUrl}&fmt=${fmt}` : baseUrl
    const label = fmt || 'xml (default)'
    try {
      const res = await fetch(testUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.youtube.com/'
        }
      })
      const text = await res.text()
      console.log(`   ${label}: status=${res.status}, length=${text.length}`)
      if (text.length > 0 && text.length < 500) {
        console.log(`      Content: ${text}`)
      }
    } catch (e) {
      console.log(`   ${label}: ERROR - ${e.message}`)
    }
  }
}

test().catch(console.error)
