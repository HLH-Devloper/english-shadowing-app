// 详细检查 baseUrl 的结构

async function inspectBaseUrl(videoId) {
  console.log(`Inspecting video: ${videoId}\n`)

  // 获取 watch 页面
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  })
  const html = await res.text()

  // 提取完整的 captionTracks
  const match = html.match(/"captionTracks":\[([^\]]+)\]/)
  if (!match) {
    console.log('No captionTracks found')
    return
  }

  const captionsJSON = `[${match[1]}]`
  const tracks = JSON.parse(captionsJSON)

  console.log(`Found ${tracks.length} tracks\n`)

  // 检查第一个轨道
  const track = tracks[0]
  console.log('First track:')
  console.log(`  Language: ${track.languageCode}`)
  console.log(`  Name: ${track.name?.simpleText}`)
  console.log(`  Kind: ${track.kind}`)
  console.log(`\nbaseUrl structure:`)
  const url = new URL(track.baseUrl)
  console.log(`  Protocol: ${url.protocol}`)
  console.log(`  Host: ${url.host}`)
  console.log(`  Pathname: ${url.pathname}`)
  console.log(`\n  Query Parameters:`)
  for (const [key, value] of url.searchParams.entries()) {
    const displayValue = value.length > 50 ? value.substring(0, 50) + '...' : value
    console.log(`    ${key} = ${displayValue}`)
  }

  // 特别注意这些参数
  console.log(`\n  Key parameters:`)
  console.log(`    caps: ${url.searchParams.get('caps')}`)
  console.log(`    expire: ${url.searchParams.get('expire')}`)
  console.log(`    signature: ${url.searchParams.get('signature') ? 'present' : 'missing'}`)
  console.log(`    key: ${url.searchParams.get('key')}`)

  // 检查expire时间
  const expire = parseInt(url.searchParams.get('expire'))
  if (expire) {
    const now = Math.floor(Date.now() / 1000)
    const remaining = expire - now
    console.log(`\n  Expiration:`)
    console.log(`    Current time: ${now}`)
    console.log(`    Expire time: ${expire}`)
    console.log(`    Remaining: ${remaining} seconds (${(remaining / 3600).toFixed(1)} hours)`)
  }

  // 尝试直接请求完整的 baseUrl
  console.log(`\n=== Testing full baseUrl (as-is) ===`)
  try {
    const captionRes = await fetch(track.baseUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    const text = await captionRes.text()
    console.log(`Status: ${captionRes.status}`)
    console.log(`Length: ${text.length}`)

    if (text.length > 0) {
      console.log(`First 300 chars:\n${text.substring(0, 300)}`)
    }
  } catch (e) {
    console.log(`Error: ${e.message}`)
  }

  // 尝试从 ytInitialPlayerResponse 获取（如果有）
  console.log(`\n=== Checking ytInitialPlayerResponse ===`)
  const prMatch = html.match(/var ytInitialPlayerResponse = ({.+?});/)
  if (prMatch) {
    try {
      const pr = JSON.parse(prMatch[1])
      const prTracks = pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks
      if (prTracks && prTracks.length > 0) {
        console.log(`Found ${prTracks.length} tracks in ytInitialPlayerResponse`)
        const prTrack = prTracks[0]
        console.log(`First track baseUrl matches: ${prTrack.baseUrl === track.baseUrl}`)

        if (prTrack.baseUrl !== track.baseUrl) {
          console.log(`\nDifferent baseUrl found:`)
          console.log(`Original: ${track.baseUrl.substring(0, 100)}...`)
          console.log(`ytInitialPlayerResponse: ${prTrack.baseUrl.substring(0, 100)}...`)
        }
      }
    } catch (e) {
      console.log(`Failed to parse ytInitialPlayerResponse: ${e.message}`)
    }
  }
}

inspectBaseUrl('Zg2_361CgzE').catch(console.error)
