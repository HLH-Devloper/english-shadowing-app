// 检查所有字幕轨道，看是否有非ASR的

async function checkAllTracks(videoId) {
  console.log(`Checking all tracks for: ${videoId}\n`)

  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  })
  const html = await res.text()

  const match = html.match(/"captionTracks":\[([^\]]+)\]/)
  if (!match) {
    console.log('No captionTracks found')
    return
  }

  const captionsJSON = `[${match[1]}]`
  const tracks = JSON.parse(captionsJSON)

  console.log(`Total tracks: ${tracks.length}\n`)

  let asrCount = 0
  let manualCount = 0

  for (const track of tracks) {
    const url = new URL(track.baseUrl)
    const caps = url.searchParams.get('caps')
    const isASR = caps === 'asr'

    if (isASR) asrCount++
    else manualCount++

    console.log(`${track.languageCode.padEnd(10)} ${track.name?.simpleText?.padEnd(25)} caps=${caps || 'none'}`)
  }

  console.log(`\n统计:`)
  console.log(`  ASR字幕: ${asrCount}`)
  console.log(`  手动字幕: ${manualCount}`)

  // 测试一个非ASR的视频（如果存在）
  console.log(`\n\n=== Testing a video with manual captions ===`)
  await testManualCaptionVideo('jNQXAC9IVRw')  // "Me at the zoo" - 第一个YouTube视频
}

async function testManualCaptionVideo(videoId) {
  console.log(`Video: ${videoId}`)

  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  })
  const html = await res.text()

  const match = html.match(/"captionTracks":\[([^\]]+)\]/)
  if (!match) {
    console.log('  No captions')
    return
  }

  const tracks = JSON.parse(`[${match[1]}]`)
  console.log(`  Found ${tracks.length} tracks`)

  for (const track of tracks.slice(0, 3)) {
    const url = new URL(track.baseUrl)
    const caps = url.searchParams.get('caps')
    console.log(`  ${track.languageCode}: caps=${caps || 'none'}`)

    // 测试第一个
    if (tracks.indexOf(track) === 0) {
      try {
        const captionRes = await fetch(track.baseUrl)
        const text = await captionRes.text()
        console.log(`    -> Status ${captionRes.status}, Length: ${text.length}`)
        if (text.length > 0) {
          console.log(`    -> ✅ GOT CONTENT!`)
          console.log(`    -> First 200 chars: ${text.substring(0, 200)}`)
        }
      } catch (e) {
        console.log(`    -> Error: ${e.message}`)
      }
    }
  }
}

checkAllTracks('Zg2_361CgzE').catch(console.error)
