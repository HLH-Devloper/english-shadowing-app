// 捕获完整的React Server Components流式响应

async function captureRSCStream(videoId) {
  console.log(`Capturing RSC stream for video: ${videoId}\n`)

  const url = `https://engwithyoutube.vercel.app/video/${videoId}`

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml'
    }
  })

  // 获取完整的响应体（包括流式内容）
  const fullHTML = await response.text()

  console.log(`Total response length: ${fullHTML.length} bytes\n`)

  // 查找所有的 <script> 标签
  const scriptMatches = [...fullHTML.matchAll(/<script[^>]*>(self\.__next_f[\s\S]*?)<\/script>/g)]

  console.log(`Found ${scriptMatches.length} Next.js data scripts\n`)

  for (let i = 0; i < scriptMatches.length; i++) {
    const scriptContent = scriptMatches[i][1]

    // 查找包含transcript/segment/caption的部分
    if (scriptContent.toLowerCase().includes('transcript') ||
        scriptContent.toLowerCase().includes('segment') ||
        scriptContent.toLowerCase().includes('caption') ||
        scriptContent.length > 10000) {  // 或者很长的script（可能包含数据）

      console.log(`=== Script ${i + 1} ===`)
      console.log(`Length: ${scriptContent.length}`)

      // 尝试提取和解码数据
      const pushMatch = scriptContent.match(/self\.__next_f\.push\(\[(.*?)\]\)/s)
      if (pushMatch) {
        try {
          const dataStr = pushMatch[1]
          // 尝试解析
          console.log(`Data preview: ${dataStr.substring(0, 500)}...`)

          // 查找特定关键词
          if (dataStr.includes('transcript') || dataStr.includes('segment')) {
            console.log(`\n🎯 FOUND TRANSCRIPT DATA IN SCRIPT ${i + 1}!`)
            console.log(`Full data: ${dataStr.substring(0, 2000)}...\n`)
          }
        } catch (e) {
          console.log(`Failed to parse: ${e.message}`)
        }
      }
      console.log('')
    }
  }

  // 保存完整的HTML用于进一步分析
  const fs = await import('fs')
  fs.writeFileSync('engwithyoutube-full.html', fullHTML)
  console.log('Full HTML saved to: engwithyoutube-full.html')
}

captureRSCStream('Zg2_361CgzE').catch(console.error)
