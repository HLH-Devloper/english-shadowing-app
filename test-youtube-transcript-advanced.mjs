// 测试 youtube-transcript 包的高级功能

import { YoutubeTranscript } from 'youtube-transcript'

async function testWithOptions(videoId) {
  console.log(`\n=== Testing ${videoId} with different options ===`)

  // 测试1：默认
  console.log('\n1. Default (no options):')
  try {
    const result1 = await YoutubeTranscript.fetchTranscript(videoId)
    console.log(`   ✅ Got ${result1.length} segments`)
    if (result1.length > 0) {
      console.log(`   Sample: ${result1[0].text}`)
    }
  } catch (e) {
    console.log(`   ❌ Error: ${e.message}`)
  }

  // 测试2：指定英文
  console.log('\n2. With lang=en:')
  try {
    const result2 = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' })
    console.log(`   ✅ Got ${result2.length} segments`)
    if (result2.length > 0) {
      console.log(`   Sample: ${result2[0].text}`)
    }
  } catch (e) {
    console.log(`   ❌ Error: ${e.message}`)
  }

  // 测试3：尝试获取所有可用语言
  console.log('\n3. Trying different language codes:')
  const langs = ['en', 'en-US', 'zh-Hans', 'zh-CN']
  for (const lang of langs) {
    try {
      const result = await YoutubeTranscript.fetchTranscript(videoId, { lang })
      console.log(`   ${lang}: ${result.length} segments`)
    } catch (e) {
      console.log(`   ${lang}: Error - ${e.message}`)
    }
  }
}

async function testKnownWorkingVideo() {
  console.log('\n=== Testing a known working video ===')
  // 这是一个我知道肯定有字幕的热门视频
  const popularVideos = [
    'JGwWNGJdvx8',  // Ed Sheeran - Shape of You
    '60ItHLz5WEA',  // Alan Walker - Faded
  ]

  for (const vid of popularVideos) {
    console.log(`\nTesting ${vid}:`)
    try {
      const result = await YoutubeTranscript.fetchTranscript(vid)
      console.log(`   ✅ SUCCESS: ${result.length} segments`)
      if (result.length > 0) {
        console.log(`   First line: ${result[0].text}`)
      }
    } catch (e) {
      console.log(`   ❌ Failed: ${e.message}`)
    }
  }
}

async function main() {
  await testWithOptions('Zg2_361CgzE')
  await testKnownWorkingVideo()
}

main().catch(console.error)
