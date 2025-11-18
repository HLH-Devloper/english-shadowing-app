// 尝试直接测试 engwithyoutube 网站的各种可能的API端点

async function testEndpoints(videoId) {
  console.log(`Testing possible API endpoints for video: ${videoId}\n`)

  const baseUrls = [
    `https://engwithyoutube.vercel.app`,
  ]

  const endpoints = [
    `/api/transcript/${videoId}`,
    `/api/transcript?videoId=${videoId}`,
    `/api/captions/${videoId}`,
    `/api/captions?videoId=${videoId}`,
    `/api/youtube/transcript/${videoId}`,
    `/api/youtube/${videoId}/transcript`,
    `/api/video/${videoId}`,
    `/api/video/${videoId}/transcript`,
    `/_next/data/build-id/video/${videoId}.json`,
  ]

  for (const base of baseUrls) {
    for (const endpoint of endpoints) {
      const url = `${base}${endpoint}`
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json, text/plain, */*',
          }
        })

        if (res.status === 200) {
          const contentType = res.headers.get('content-type')
          const text = await res.text()

          console.log(`✅ ${res.status} ${url}`)
          console.log(`   Content-Type: ${contentType}`)
          console.log(`   Length: ${text.length}`)

          if (text.length > 0 && text.length < 5000) {
            console.log(`   Response: ${text.substring(0, 300)}...\n`)
          } else if (text.length > 0) {
            console.log(`   Response preview: ${text.substring(0, 200)}...\n`)
          }

          // 尝试解析JSON
          if (contentType && contentType.includes('json')) {
            try {
              const json = JSON.parse(text)
              console.log(`   ✅ Valid JSON`)
              console.log(`   Keys: ${Object.keys(json).join(', ')}`)

              if (json.transcript || json.segments || json.captions) {
                console.log(`   🎯 FOUND TRANSCRIPT DATA!`)
                if (json.transcript) console.log(`      transcript length: ${json.transcript.length}`)
                if (json.segments) console.log(`      segments length: ${json.segments.length}`)
                if (json.captions) console.log(`      captions length: ${json.captions.length}`)
              }
            } catch (e) {
              // Not JSON
            }
          }
          console.log('')
        } else if (res.status !== 404) {
          console.log(`⚠️  ${res.status} ${url}`)
        }
      } catch (e) {
        // Silently skip errors
      }
    }
  }

  console.log('\n=== Testing Next.js build data ===')
  // Next.js 可能把数据存在 _next/data 路径下
  try {
    const buildIdRes = await fetch(`https://engwithyoutube.vercel.app/_next/data/`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    console.log(`Build ID endpoint: ${buildIdRes.status}`)
  } catch (e) {
    console.log(`Build ID endpoint: Error`)
  }
}

testEndpoints('Zg2_361CgzE').catch(console.error)
