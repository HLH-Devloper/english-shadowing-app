// 测试 youtube-transcript 包

import { YoutubeTranscript } from 'youtube-transcript'

async function testTranscript(videoId) {
  console.log(`\n=== Testing video: ${videoId} ===`)

  try {
    const t0 = Date.now()
    const transcript = await YoutubeTranscript.fetchTranscript(videoId)
    const t1 = Date.now()

    console.log(`✅ SUCCESS!`)
    console.log(`   Time: ${t1 - t0}ms`)
    console.log(`   Segments: ${transcript.length}`)
    console.log(`\n   First 5 segments:`)
    transcript.slice(0, 5).forEach((seg, i) => {
      console.log(`   ${i + 1}. [${seg.offset}s] ${seg.text}`)
    })

    return { success: true, count: transcript.length }
  } catch (error) {
    console.log(`❌ FAILED: ${error.message}`)
    return { success: false, error: error.message }
  }
}

async function main() {
  console.log('Testing youtube-transcript package...\n')

  // 测试之前失败的视频
  const testVideos = [
    'Zg2_361CgzE',  // 之前测试失败的TED视频
    'dQw4w9WgXcQ',  // Rick Astley - Never Gonna Give You Up
    'jNQXAC9IVRw',  // Me at the zoo (第一个YouTube视频)
  ]

  const results = []
  for (const videoId of testVideos) {
    const result = await testTranscript(videoId)
    results.push({ videoId, ...result })
  }

  console.log('\n\n=== Summary ===')
  results.forEach(r => {
    const status = r.success ? '✅' : '❌'
    const info = r.success ? `${r.count} segments` : r.error
    console.log(`${status} ${r.videoId}: ${info}`)
  })
}

main().catch(console.error)
