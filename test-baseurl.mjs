// 快速测试脚本：验证baseUrl是否需要保持原样使用

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

  // 2. 提取ytInitialPlayerResponse
  console.log('2. Extracting ytInitialPlayerResponse...')
  const marker = 'var ytInitialPlayerResponse = '
  const startIdx = html.indexOf(marker)
  const start = startIdx + marker.length
  const endIdx = html.indexOf('};', start) + 1
  const jsonStr = html.slice(start, endIdx)
  const playerResponse = JSON.parse(jsonStr)

  // 3. 获取captionTracks
  const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || []
  console.log(`3. Found ${tracks.length} caption tracks`)

  // 4. 找到英文字幕轨道
  const enTrack = tracks.find(t => t.languageCode === 'en')
  if (!enTrack) {
    console.log('ERROR: No English track found')
    return
  }
  console.log('4. Found English track:', enTrack.name?.simpleText)
  console.log('   baseUrl:', enTrack.baseUrl.substring(0, 100) + '...')

  // 5. 测试1：直接使用baseUrl（不修改）
  console.log('\n=== Test 1: Use baseUrl as-is ===')
  try {
    const res1 = await fetch(enTrack.baseUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.youtube.com/',
        'Cookie': 'CONSENT=YES+'
      }
    })
    const text1 = await res1.text()
    console.log(`Status: ${res1.status}`)
    console.log(`Response length: ${text1.length}`)
    console.log(`First 200 chars: ${text1.substring(0, 200)}`)
  } catch (e) {
    console.log('ERROR:', e.message)
  }

  // 6. 测试2：在baseUrl后添加fmt=json3
  console.log('\n=== Test 2: Add fmt=json3 to baseUrl ===')
  try {
    const url2 = enTrack.baseUrl + '&fmt=json3'
    const res2 = await fetch(url2, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.youtube.com/',
        'Cookie': 'CONSENT=YES+'
      }
    })
    const text2 = await res2.text()
    console.log(`Status: ${res2.status}`)
    console.log(`Response length: ${text2.length}`)
    console.log(`First 200 chars: ${text2.substring(0, 200)}`)
  } catch (e) {
    console.log('ERROR:', e.message)
  }
}

test().catch(console.error)
